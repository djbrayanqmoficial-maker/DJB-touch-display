package com.djbrayan.djbtouchdisplaynative.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import com.djbrayan.djbtouchdisplaynative.model.SamplerSlotState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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

class NativeSamplerEngine(private val context: Context) {

    private val soundPool: SoundPool

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
    }

    fun triggerSample(deckId: String, slotIndex: Int) {
        val target = if (deckId == "A") _slotsA else _slotsB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return

        // Toggle state visually and pulse
        list[slotIndex] = cur.copy(isPlaying = true)
        target.value = list
    }

    fun stopSample(deckId: String, slotIndex: Int) {
        val target = if (deckId == "A") _slotsA else _slotsB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(isPlaying = false)
        target.value = list
    }

    fun setSlotVolume(deckId: String, slotIndex: Int, volumePercent: Float) {
        val target = if (deckId == "A") _slotsA else _slotsB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(volumePercent = volumePercent.coerceIn(0f, 100f))
        target.value = list
    }

    fun release() {
        soundPool.release()
    }
}
