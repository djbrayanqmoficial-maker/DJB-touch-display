package com.djbrayan.djbtouchdisplaynative.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.net.Uri
import com.djbrayan.djbtouchdisplaynative.model.SamplerSlotState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

val DEFAULT_SAMPLER_NAMES_A = listOf(
    "909 Kick",
    "909 Snare",
    "909 Closed Hat",
    "909 Open Hat",
    "909 Clap",
    "909 Ride",
    "Rimshot",
    "Crash"
)

val DEFAULT_SAMPLER_NAMES_B = listOf(
    "Air Horn",
    "Laser Siren",
    "Sub Drop",
    "Gunshot",
    "Police Siren",
    "Impact Gong",
    "Rewind FX",
    "Vocal Yeah"
)

/**
 * DJB Native Sampler Engine — 16 Independent Polyphonic Sampler Voices
 * Features:
 * - Procedural synthesized 16-bit PCM drums & sound FX generated on initialization
 * - Support for loading user WAV / OGG files from device storage via SAF Document URI
 * - Dedicated volume and loop management independent of Deck A & B audio pipelines
 */
class NativeSamplerEngine(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val soundPool: SoundPool

    private val soundIdsA = IntArray(8) { -1 }
    private val soundIdsB = IntArray(8) { -1 }
    private val streamIdsA = IntArray(8) { 0 }
    private val streamIdsB = IntArray(8) { 0 }

    private val _slotsA = MutableStateFlow(
        DEFAULT_SAMPLER_NAMES_A.mapIndexed { index, name ->
            SamplerSlotState(slotIndex = index, name = name)
        }
    )
    val slotsA: StateFlow<List<SamplerSlotState>> = _slotsA.asStateFlow()

    private val _slotsB = MutableStateFlow(
        DEFAULT_SAMPLER_NAMES_B.mapIndexed { index, name ->
            SamplerSlotState(slotIndex = index, name = name)
        }
    )
    val slotsB: StateFlow<List<SamplerSlotState>> = _slotsB.asStateFlow()

    init {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(16)
            .setAudioAttributes(audioAttributes)
            .build()

        // Generate synthetic drum and sound FX WAV files in background cache and load into SoundPool
        scope.launch {
            generateAndLoadProceduralSamples()
        }
    }

    private fun generateAndLoadProceduralSamples() {
        val sampleRate = 44100
        val cacheDir = context.cacheDir

        // 8 Deck A drum voices
        for (i in 0..7) {
            val file = File(cacheDir, "sample_a_$i.wav")
            generateWavFile(file, sampleRate, i, isDeckA = true)
            if (file.exists()) {
                val soundId = soundPool.load(file.absolutePath, 1)
                soundIdsA[i] = soundId
            }
        }

        // 8 Deck B FX voices
        for (i in 0..7) {
            val file = File(cacheDir, "sample_b_$i.wav")
            generateWavFile(file, sampleRate, i, isDeckA = false)
            if (file.exists()) {
                val soundId = soundPool.load(file.absolutePath, 1)
                soundIdsB[i] = soundId
            }
        }
    }

    private fun generateWavFile(file: File, sampleRate: Int, soundIndex: Int, isDeckA: Boolean) {
        val durationSec = when {
            isDeckA && soundIndex == 0 -> 0.35 // Kick
            isDeckA && soundIndex == 1 -> 0.25 // Snare
            isDeckA -> 0.2
            soundIndex == 0 -> 0.6 // Air Horn
            soundIndex == 1 -> 0.5 // Siren
            soundIndex == 2 -> 0.8 // Sub drop
            else -> 0.4
        }

        val totalSamples = (sampleRate * durationSec).toInt()
        val pcmData = ShortArray(totalSamples)

        for (n in 0 until totalSamples) {
            val t = n.toDouble() / sampleRate
            val progress = n.toDouble() / totalSamples
            val sampleVal: Double = if (isDeckA) {
                when (soundIndex) {
                    0 -> { // 909 Kick: fast pitch drop 150Hz -> 45Hz with exponential decay
                        val freq = 45.0 + (110.0 * exp(-t * 28.0))
                        val env = exp(-t * 9.0)
                        sin(2.0 * PI * freq * t) * env
                    }
                    1 -> { // 909 Snare: 200Hz tone + noise burst
                        val tone = sin(2.0 * PI * 185.0 * t) * exp(-t * 18.0) * 0.5
                        val noise = ((Math.random() * 2.0) - 1.0) * exp(-t * 14.0) * 0.5
                        tone + noise
                    }
                    2 -> { // Closed Hat: high metallic noise band
                        ((Math.random() * 2.0) - 1.0) * exp(-t * 45.0) * 0.7
                    }
                    3 -> { // Open Hat: longer noise ring
                        ((Math.random() * 2.0) - 1.0) * exp(-t * 12.0) * 0.7
                    }
                    4 -> { // Clap: multi-trigger burst
                        val multiBurst = if (t < 0.03) (t % 0.01) * 100.0 else exp(-t * 16.0)
                        ((Math.random() * 2.0) - 1.0) * multiBurst * 0.6
                    }
                    else -> { // Ride/Rim/Crash
                        val noise = ((Math.random() * 2.0) - 1.0) * exp(-t * 8.0) * 0.4
                        val ring = sin(2.0 * PI * 850.0 * t) * exp(-t * 10.0) * 0.3
                        noise + ring
                    }
                }
            } else {
                when (soundIndex) {
                    0 -> { // Air Horn: layered brass pulse (F# / A)
                        val b1 = sin(2.0 * PI * 370.0 * t)
                        val b2 = sin(2.0 * PI * 440.0 * t) * 0.7
                        (b1 + b2) * 0.5 * (1.0 - progress)
                    }
                    1 -> { // Laser Siren: pitch sweep 800Hz -> 200Hz
                        val freq = 200.0 + (600.0 * (1.0 - (progress % 0.25) * 4.0))
                        sin(2.0 * PI * freq * t) * 0.7 * (1.0 - progress)
                    }
                    2 -> { // Sub Drop: 90Hz -> 30Hz deep sub
                        val freq = 30.0 + (60.0 * (1.0 - progress))
                        sin(2.0 * PI * freq * t) * 0.9 * (1.0 - progress)
                    }
                    else -> { // Gunshot / Gong / Siren
                        val noise = ((Math.random() * 2.0) - 1.0) * exp(-t * 6.0) * 0.8
                        val low = sin(2.0 * PI * 80.0 * t) * exp(-t * 4.0) * 0.5
                        noise + low
                    }
                }
            }
            pcmData[n] = (sampleVal.coerceIn(-1.0, 1.0) * 32760.0).toInt().toShort()
        }

        // Write canonical 16-bit Mono WAV header & data
        try {
            FileOutputStream(file).use { fos ->
                val byteRate = sampleRate * 2
                val dataSize = totalSamples * 2
                val chunkSize = 36 + dataSize
                val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)

                header.put("RIFF".toByteArray())
                header.putInt(chunkSize)
                header.put("WAVE".toByteArray())
                header.put("fmt ".toByteArray())
                header.putInt(16) // Subchunk1Size
                header.putShort(1) // AudioFormat (1 = PCM)
                header.putShort(1) // NumChannels (1 = Mono)
                header.putInt(sampleRate)
                header.putInt(byteRate)
                header.putShort(2) // BlockAlign
                header.putShort(16) // BitsPerSample
                header.put("data".toByteArray())
                header.putInt(dataSize)

                fos.write(header.array())
                val buffer = ByteBuffer.allocate(dataSize).order(ByteOrder.LITTLE_ENDIAN)
                for (s in pcmData) buffer.putShort(s)
                fos.write(buffer.array())
            }
        } catch (_: Exception) {}
    }

    fun triggerSample(deckId: String, slotIndex: Int) {
        val soundId = if (deckId == "A") soundIdsA.getOrNull(slotIndex) ?: -1 else soundIdsB.getOrNull(slotIndex) ?: -1
        val slots = if (deckId == "A") _slotsA else _slotsB
        val list = slots.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return

        val vol = (cur.volumePercent / 100f).coerceIn(0f, 1f)
        val loop = if (cur.isLooping) -1 else 0

        if (soundId > 0) {
            val streamId = soundPool.play(soundId, vol, vol, 1, loop, 1.0f)
            if (deckId == "A") streamIdsA[slotIndex] = streamId else streamIdsB[slotIndex] = streamId
        }

        list[slotIndex] = cur.copy(isPlaying = true)
        slots.value = list
    }

    fun stopSample(deckId: String, slotIndex: Int) {
        val streamId = if (deckId == "A") streamIdsA.getOrNull(slotIndex) ?: 0 else streamIdsB.getOrNull(slotIndex) ?: 0
        if (streamId > 0) {
            soundPool.stop(streamId)
        }
        val slots = if (deckId == "A") _slotsA else _slotsB
        val list = slots.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(isPlaying = false)
        slots.value = list
    }

    fun loadCustomSample(deckId: String, slotIndex: Int, uri: Uri, customName: String) {
        scope.launch {
            try {
                context.contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                    val soundId = soundPool.load(pfd.fileDescriptor, 0, pfd.statSize, 1)
                    if (deckId == "A") {
                        soundIdsA[slotIndex] = soundId
                        val list = _slotsA.value.toMutableList()
                        list[slotIndex] = list[slotIndex].copy(name = customName)
                        _slotsA.value = list
                    } else {
                        soundIdsB[slotIndex] = soundId
                        val list = _slotsB.value.toMutableList()
                        list[slotIndex] = list[slotIndex].copy(name = customName)
                        _slotsB.value = list
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun setSlotVolume(deckId: String, slotIndex: Int, volumePercent: Float) {
        val target = if (deckId == "A") _slotsA else _slotsB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(volumePercent = volumePercent.coerceIn(0f, 100f))
        target.value = list

        val streamId = if (deckId == "A") streamIdsA.getOrNull(slotIndex) ?: 0 else streamIdsB.getOrNull(slotIndex) ?: 0
        if (streamId > 0) {
            val v = (volumePercent / 100f).coerceIn(0f, 1f)
            soundPool.setVolume(streamId, v, v)
        }
    }

    fun release() {
        soundPool.release()
    }
}
