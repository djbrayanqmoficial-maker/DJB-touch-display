package com.djbrayan.djbtouchdisplaynative.audio

import com.djbrayan.djbtouchdisplaynative.model.FxSlotState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class FxOption(
    val value: String,
    val label: String
)

val FX_CATALOG = listOf(
    FxOption("FILTER", "Filter Sweep"),
    FxOption("ECHO", "BPM Echo"),
    FxOption("DELAY", "Digital Delay"),
    FxOption("REVERB", "Stereo Hall Reverb"),
    FxOption("CUT", "Beat Cut (1/4)"),
    FxOption("PING_PONG", "Ping Pong Delay"),
    FxOption("FLANGER", "BPM Flanger"),
    FxOption("PHASER", "Stereo Phaser"),
    FxOption("TRANS", "Trans Gate"),
    FxOption("FILTER_LFO", "Filter LFO")
)

val FX_BEAT_DIVISIONS = listOf(0.125f, 0.25f, 0.5f, 0.75f, 1.0f, 2.0f)

class NativeEffectsEngine {

    private val _fxA = MutableStateFlow(
        listOf(
            FxSlotState(name = "FILTER", wetDryPercent = 0f, parameterPercent = 50f, isEnabled = false),
            FxSlotState(name = "ECHO", wetDryPercent = 0f, parameterPercent = 50f, isEnabled = false),
            FxSlotState(name = "REVERB", wetDryPercent = 0f, parameterPercent = 50f, isEnabled = false)
        )
    )
    val fxA: StateFlow<List<FxSlotState>> = _fxA.asStateFlow()

    private val _fxB = MutableStateFlow(
        listOf(
            FxSlotState(name = "FILTER", wetDryPercent = 0f, parameterPercent = 50f, isEnabled = false),
            FxSlotState(name = "ECHO", wetDryPercent = 0f, parameterPercent = 50f, isEnabled = false),
            FxSlotState(name = "REVERB", wetDryPercent = 0f, parameterPercent = 50f, isEnabled = false)
        )
    )
    val fxB: StateFlow<List<FxSlotState>> = _fxB.asStateFlow()

    fun toggleFxSlot(deckId: String, slotIndex: Int) {
        val target = if (deckId == "A") _fxA else _fxB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(isEnabled = !cur.isEnabled)
        target.value = list
    }

    fun setFxEffect(deckId: String, slotIndex: Int, fxName: String) {
        val target = if (deckId == "A") _fxA else _fxB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(name = fxName)
        target.value = list
    }

    fun setFxWetDry(deckId: String, slotIndex: Int, percent: Float) {
        val target = if (deckId == "A") _fxA else _fxB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(wetDryPercent = percent.coerceIn(0f, 100f))
        target.value = list
    }

    fun setFxParameter(deckId: String, slotIndex: Int, percent: Float) {
        val target = if (deckId == "A") _fxA else _fxB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(parameterPercent = percent.coerceIn(0f, 100f))
        target.value = list
    }

    fun setFxBeatMultiplier(deckId: String, slotIndex: Int, mult: Float) {
        val target = if (deckId == "A") _fxA else _fxB
        val list = target.value.toMutableList()
        val cur = list.getOrNull(slotIndex) ?: return
        list[slotIndex] = cur.copy(beatMultiplier = mult)
        target.value = list
    }
}
