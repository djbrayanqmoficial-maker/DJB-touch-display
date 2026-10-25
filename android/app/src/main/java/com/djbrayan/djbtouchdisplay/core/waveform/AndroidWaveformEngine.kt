package com.djbrayan.djbtouchdisplay.core.waveform

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random

/**
 * DJB Core — Native Android Waveform Engine
 * Faithful migration of src/core/waveform/WaveformEngine.ts & WaveformCanvas.tsx.
 * Decodes real audio file samples via MediaExtractor/MediaCodec on a background worker thread.
 * Extracts Overview (600 bins) and Scrolling (4800 bins) multi-band amplitude data,
 * with in-memory caching and reactive update notifications.
 */
class AndroidWaveformEngine {

    private val engineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val cache = mutableMapOf<String, FloatArray>()
    private val analyzedUris = mutableSetOf<String>()

    private val _waveformUpdateTrigger = MutableStateFlow(0L)
    val waveformUpdateTrigger: StateFlow<Long> = _waveformUpdateTrigger.asStateFlow()

    private val _zoom = MutableStateFlow(2.0f) // 1.0 to 6.0
    val zoom: StateFlow<Float> = _zoom.asStateFlow()

    private val _showBeatgrid = MutableStateFlow(true)
    val showBeatgrid: StateFlow<Boolean> = _showBeatgrid.asStateFlow()

    // Beatgrid editor state (offset in sec, resolution multiplier)
    private val _gridOffsetA = MutableStateFlow(0f)
    val gridOffsetA: StateFlow<Float> = _gridOffsetA.asStateFlow()

    private val _gridOffsetB = MutableStateFlow(0f)
    val gridOffsetB: StateFlow<Float> = _gridOffsetB.asStateFlow()

    private val _gridResolutionA = MutableStateFlow(1f) // 0.5f, 1f, 2f
    val gridResolutionA: StateFlow<Float> = _gridResolutionA.asStateFlow()

    private val _gridResolutionB = MutableStateFlow(1f)
    val gridResolutionB: StateFlow<Float> = _gridResolutionB.asStateFlow()

    fun getOverviewPeaks(trackId: String, deckId: String): FloatArray {
        val key = "overview-$trackId-$deckId"
        return cache.getOrPut(key) {
            generateDeterministicWaveform(key, 600)
        }
    }

    fun getScrollingPeaks(trackId: String, deckId: String): FloatArray {
        val key = "scrolling-$trackId-$deckId"
        return cache.getOrPut(key) {
            generateDeterministicWaveform(key, 4800)
        }
    }

    /**
     * Extracts real PCM audio samples from the track's URI in a background coroutine
     * and updates the 600-bin Overview and 4800-bin Scrolling waveforms without blocking UI.
     */
    fun analyzeTrackWaveform(context: Context, uriString: String, trackId: String, deckId: String) {
        val cacheKey = "$trackId-$deckId"
        if (analyzedUris.contains(cacheKey)) return
        analyzedUris.add(cacheKey)

        engineScope.launch {
            try {
                val uri = Uri.parse(uriString)
                val extractor = MediaExtractor()
                extractor.setDataSource(context, uri, null)

                var audioTrackIndex = -1
                var format: MediaFormat? = null
                for (i in 0 until extractor.trackCount) {
                    val trackFormat = extractor.getTrackFormat(i)
                    val mime = trackFormat.getString(MediaFormat.KEY_MIME) ?: ""
                    if (mime.startsWith("audio/")) {
                        audioTrackIndex = i
                        format = trackFormat
                        break
                    }
                }

                if (audioTrackIndex < 0 || format == null) {
                    extractor.release()
                    return@launch
                }

                extractor.selectTrack(audioTrackIndex)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                val codec = MediaCodec.createDecoderByType(mime)
                codec.configure(format, null, null, 0)
                codec.start()

                val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) {
                    format.getLong(MediaFormat.KEY_DURATION)
                } else {
                    180_000_000L
                }

                val overviewBins = FloatArray(600)
                val scrollingBins = FloatArray(4800)
                val overviewCounts = IntArray(600)
                val scrollingCounts = IntArray(4800)

                val bufferInfo = MediaCodec.BufferInfo()
                var isEos = false
                val timeoutUs = 5000L
                var maxSampleVal = 1f

                while (!isEos) {
                    val inIndex = codec.dequeueInputBuffer(timeoutUs)
                    if (inIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inIndex)
                        if (inputBuffer != null) {
                            val sampleSize = extractor.readSampleData(inputBuffer, 0)
                            if (sampleSize < 0) {
                                codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                isEos = true
                            } else {
                                val timeUs = extractor.sampleTime
                                codec.queueInputBuffer(inIndex, 0, sampleSize, timeUs, 0)
                                extractor.advance()
                            }
                        }
                    }

                    var outIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
                    while (outIndex >= 0) {
                        val outputBuffer = codec.getOutputBuffer(outIndex)
                        if (outputBuffer != null && bufferInfo.size > 0) {
                            outputBuffer.position(bufferInfo.offset)
                            outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                            outputBuffer.order(ByteOrder.LITTLE_ENDIAN)

                            val timeRatio = (bufferInfo.presentationTimeUs.toFloat() / durationUs.toFloat()).coerceIn(0f, 1f)
                            val oIdx = (timeRatio * 599).toInt().coerceIn(0, 599)
                            val sIdx = (timeRatio * 4799).toInt().coerceIn(0, 4799)

                            // Read 16-bit PCM samples
                            var peakInChunk = 0f
                            while (outputBuffer.remaining() >= 2) {
                                val sample = abs(outputBuffer.short.toFloat())
                                if (sample > peakInChunk) peakInChunk = sample
                            }

                            if (peakInChunk > maxSampleVal) maxSampleVal = peakInChunk
                            if (peakInChunk > overviewBins[oIdx]) overviewBins[oIdx] = peakInChunk
                            if (peakInChunk > scrollingBins[sIdx]) scrollingBins[sIdx] = peakInChunk
                            overviewCounts[oIdx]++
                            scrollingCounts[sIdx]++
                        }

                        codec.releaseOutputBuffer(outIndex, false)
                        if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            isEos = true
                            break
                        }
                        outIndex = codec.dequeueOutputBuffer(bufferInfo, 0)
                    }
                }

                codec.stop()
                codec.release()
                extractor.release()

                // Normalize waveforms to 0.04f .. 1.0f range
                val normScale = if (maxSampleVal > 0) 1.0f / maxSampleVal else 1.0f
                for (i in overviewBins.indices) {
                    overviewBins[i] = (overviewBins[i] * normScale).coerceIn(0.04f, 1.0f)
                }
                for (i in scrollingBins.indices) {
                    scrollingBins[i] = (scrollingBins[i] * normScale).coerceIn(0.04f, 1.0f)
                }

                // Update cache with real PCM peak arrays
                cache["overview-$trackId-$deckId"] = overviewBins
                cache["scrolling-$trackId-$deckId"] = scrollingBins

                // Trigger reactive recomposition in Compose
                _waveformUpdateTrigger.value = System.currentTimeMillis()
            } catch (_: Exception) {
                // If decoding fails, fallback to deterministic envelope
            }
    }

    private fun generateDeterministicWaveform(seedKey: String, count: Int): FloatArray {
        val seed = seedKey.hashCode().toLong()
        val rng = Random(seed)
        val arr = FloatArray(count)

        for (i in 0 until count) {
            val progress = i.toFloat() / count.toFloat()
            val introFade = (progress * 15f).coerceIn(0f, 1f)
            val outroFade = ((1f - progress) * 15f).coerceIn(0f, 1f)
            val envelope = introFade * outroFade

            // Beat pulse every 8 bins
            val beatPulse = if (i % 8 == 0) 0.55f else 0.1f
            val wave = (sin(i.toDouble() * 0.15).toFloat() * 0.15f)
            val noise = rng.nextFloat() * 0.35f

            arr[i] = ((0.2f + beatPulse + wave + noise) * envelope).coerceIn(0.04f, 1.0f)
        }
        return arr
    }

    fun zoomIn() {
        val next = (_zoom.value + 0.5f).coerceAtMost(6.0f)
        _zoom.value = next
    }

    fun zoomOut() {
        val next = (_zoom.value - 0.5f).coerceAtLeast(1.0f)
        _zoom.value = next
    }

    fun toggleBeatgrid() {
        _showBeatgrid.value = !_showBeatgrid.value
    }

    fun shiftGrid(deckId: String, deltaSec: Float) {
        if (deckId == "A") {
            _gridOffsetA.value += deltaSec
        } else {
            _gridOffsetB.value += deltaSec
        }
    }

    fun cycleGridResolution(deckId: String) {
        if (deckId == "A") {
            _gridResolutionA.value = when (_gridResolutionA.value) {
                0.5f -> 1.0f
                1.0f -> 2.0f
                else -> 0.5f
            }
        } else {
            _gridResolutionB.value = when (_gridResolutionB.value) {
                0.5f -> 1.0f
                1.0f -> 2.0f
                else -> 0.5f
            }
        }
    }

    fun resetGrid(deckId: String) {
        if (deckId == "A") {
            _gridOffsetA.value = 0f
            _gridResolutionA.value = 1f
        } else {
            _gridOffsetB.value = 0f
            _gridResolutionB.value = 1f
        }
    }
}
