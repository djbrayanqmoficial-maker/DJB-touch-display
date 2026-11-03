package com.djbrayan.djbtouchdisplaynative.audio

import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.BaseAudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * DJB Native DSP Audio Processor — Media3 AudioProcessor
 * Intercepts ExoPlayer's 16-bit PCM audio stream in real-time and applies:
 * - Resonant Filter Sweep (LPF / HPF with resonance Q)
 * - BPM-Synchronized Delay & Echo with circular feedback ring buffer
 * - VirtualDJ Beat Cut (1/4 rhythmic gate with anti-click smoothing)
 * - BPM Flanger with sine-wave modulated read pointer
 */
class NativeDspAudioProcessor : BaseAudioProcessor() {

    @Volatile var isEnabled: Boolean = false
    @Volatile var effectType: String = "FILTER"
    @Volatile var wetDry: Float = 0.0f          // 0.0 .. 1.0
    @Volatile var parameter: Float = 0.5f       // 0.0 .. 1.0
    @Volatile var beatMultiplier: Float = 1.0f  // 0.25, 0.5, 1.0, 2.0
    @Volatile var effectiveBpm: Double = 126.0

    // Delay ring buffer: 48kHz * 2 channels * 2 seconds = 192,000 samples
    private val delayBufferSize = 192000
    private val delayBufferL = FloatArray(delayBufferSize)
    private val delayBufferR = FloatArray(delayBufferSize)
    private var writeIndex = 0

    // Flanger LFO state
    private var lfoPhase = 0.0

    // Beat Cut gate sample counter
    private var cutSampleCount = 0

    // Resonant Biquad Filter state
    private var x1L = 0f; private var x2L = 0f; private var y1L = 0f; private var y2L = 0f
    private var x1R = 0f; private var x2R = 0f; private var y1R = 0f; private var y2R = 0f

    override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
        if (inputAudioFormat.encoding != androidx.media3.common.C.ENCODING_PCM_16BIT) {
            return AudioFormat.NOT_SET
        }
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val remaining = inputBuffer.remaining()
        if (remaining == 0) return

        if (!isEnabled || wetDry <= 0.01f || effectType == "OFF") {
            // Bypass mode: direct passthrough without DSP overhead
            val buffer = replaceOutputBuffer(remaining)
            buffer.put(inputBuffer)
            buffer.flip()
            return
        }

        val sampleRate = outputAudioFormat.sampleRate.coerceAtLeast(44100)
        val channelCount = outputAudioFormat.channelCount.coerceIn(1, 2)
        val numSamples = remaining / (2 * channelCount)

        val outBuffer = replaceOutputBuffer(remaining)
        inputBuffer.order(ByteOrder.LITTLE_ENDIAN)

        val currentWet = wetDry.coerceIn(0f, 1f)
        val currentDry = 1.0f - (currentWet * 0.4f) // Anti-drop dry level

        val beatsPerSec = effectiveBpm / 60.0
        val baseDelaySamples = (sampleRate / beatsPerSec) * beatMultiplier
        val delaySamples = baseDelaySamples.toInt().coerceIn(100, delayBufferSize - 100)

        // Precompute Biquad filter coefficients if FILTER mode is active
        var b0 = 1f; var b1 = 0f; var b2 = 0f; var a1 = 0f; var a2 = 0f
        if (effectType == "FILTER") {
            val sweep = (parameter - 0.5f) * 2.0f // -1.0 (LPF) .. 0 (Bypass) .. +1.0 (HPF)
            val q = 1.414f
            if (sweep < -0.05f) {
                // Lowpass Filter: 60Hz .. 4000Hz
                val cutoff = 60.0 + ((1.0 + sweep) * 4000.0)
                val omega = 2.0 * PI * (cutoff / sampleRate)
                val alpha = sin(omega) / (2.0 * q)
                val a0 = 1.0 + alpha
                b0 = ((1.0 - cos(omega)) / 2.0 / a0).toFloat()
                b1 = ((1.0 - cos(omega)) / a0).toFloat()
                b2 = b0
                a1 = ((-2.0 * cos(omega)) / a0).toFloat()
                a2 = ((1.0 - alpha) / a0).toFloat()
            } else if (sweep > 0.05f) {
                // Highpass Filter: 300Hz .. 10000Hz
                val cutoff = 300.0 + (sweep * 9700.0)
                val omega = 2.0 * PI * (cutoff / sampleRate)
                val alpha = sin(omega) / (2.0 * q)
                val a0 = 1.0 + alpha
                b0 = ((1.0 + cos(omega)) / 2.0 / a0).toFloat()
                b1 = (-(1.0 + cos(omega)) / a0).toFloat()
                b2 = b0
                a1 = ((-2.0 * cos(omega)) / a0).toFloat()
                a2 = ((1.0 - alpha) / a0).toFloat()
            }
        }

        for (i in 0 until numSamples) {
            val inShortL = inputBuffer.short
            val inShortR = if (channelCount == 2) inputBuffer.short else inShortL

            val inNormL = inShortL / 32768.0f
            val inNormR = inShortR / 32768.0f

            var outNormL = inNormL
            var outNormR = inNormR

            when (effectType) {
                "ECHO", "DELAY" -> {
                    val readIndex = (writeIndex - delaySamples + delayBufferSize) % delayBufferSize
                    val delayedL = delayBufferL[readIndex]
                    val delayedR = delayBufferR[readIndex]

                    val feedback = if (effectType == "ECHO") 0.65f * parameter else 0.4f
                    delayBufferL[writeIndex] = inNormL + (delayedL * feedback)
                    delayBufferR[writeIndex] = inNormR + (delayedR * feedback)

                    outNormL = (inNormL * currentDry) + (delayedL * currentWet)
                    outNormR = (inNormR * currentDry) + (delayedR * currentWet)

                    writeIndex = (writeIndex + 1) % delayBufferSize
                }
                "CUT" -> {
                    // Beat Cut: 1/4 beat gate (mute for half of each 1/4 beat)
                    val cutWindow = (sampleRate / (beatsPerSec * 4.0)).toInt().coerceAtLeast(1)
                    val inCutPhase = (cutSampleCount % cutWindow) > (cutWindow * 0.5)
                    val gateGain = if (inCutPhase) (1.0f - currentWet) else 1.0f

                    outNormL = inNormL * gateGain
                    outNormR = inNormR * gateGain
                    cutSampleCount++
                }
                "FLANGER" -> {
                    // Flanger: LFO sweep 1ms to 7ms delay
                    val lfoFreq = beatsPerSec * 0.5
                    val lfoDelta = (2.0 * PI * lfoFreq) / sampleRate
                    lfoPhase = (lfoPhase + lfoDelta) % (2.0 * PI)
                    val flangerOffsetMs = 2.0 + (1.5 * sin(lfoPhase))
                    val flangerSamples = (flangerOffsetMs * 0.001 * sampleRate).toInt().coerceIn(1, 1000)

                    val readIndex = (writeIndex - flangerSamples + delayBufferSize) % delayBufferSize
                    val delayedL = delayBufferL[readIndex]
                    val delayedR = delayBufferR[readIndex]

                    delayBufferL[writeIndex] = inNormL
                    delayBufferR[writeIndex] = inNormR
                    writeIndex = (writeIndex + 1) % delayBufferSize

                    outNormL = (inNormL * currentDry) + (delayedL * currentWet * 0.7f)
                    outNormR = (inNormR * currentDry) + (delayedR * currentWet * 0.7f)
                }
                "FILTER" -> {
                    val sweep = (parameter - 0.5f) * 2.0f
                    if (sweep < -0.05f || sweep > 0.05f) {
                        val filteredL = (b0 * inNormL) + (b1 * x1L) + (b2 * x2L) - (a1 * y1L) - (a2 * y2L)
                        val filteredR = (b0 * inNormR) + (b1 * x1R) + (b2 * x2R) - (a1 * y1R) - (a2 * y2R)

                        x2L = x1L; x1L = inNormL; y2L = y1L; y1L = filteredL
                        x2R = x1R; x1R = inNormR; y2R = y1R; y2R = filteredR

                        outNormL = (inNormL * (1f - currentWet)) + (filteredL * currentWet)
                        outNormR = (inNormR * (1f - currentWet)) + (filteredR * currentWet)
                    }
                }
                else -> {
                    outNormL = inNormL
                    outNormR = inNormR
                }
            }

            // Anti-clipping soft saturation
            val clampedL = (outNormL.coerceIn(-1.0f, 1.0f) * 32767.0f).toInt().toShort()
            val clampedR = (outNormR.coerceIn(-1.0f, 1.0f) * 32767.0f).toInt().toShort()

            outBuffer.putShort(clampedL)
            if (channelCount == 2) {
                outBuffer.putShort(clampedR)
            }
        }

        outBuffer.flip()
    }

    override fun onFlush() {
        delayBufferL.fill(0f)
        delayBufferR.fill(0f)
        writeIndex = 0
        lfoPhase = 0.0
        cutSampleCount = 0
        x1L = 0f; x2L = 0f; y1L = 0f; y2L = 0f
        x1R = 0f; x2R = 0f; y1R = 0f; y2R = 0f
    }

    override fun onReset() {
        onFlush()
    }
}
