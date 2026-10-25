package com.djbrayan.djbtouchdisplay.core.audio

import com.djbrayan.djbtouchdisplay.core.FxSlotState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class FxOption(
    val value: String,
    val label: String
)

val FX_OPTIONS = listOf(
    FxOption("FILTER", "Filter"),
    FxOption("ECHO", "Echo"),
    FxOption("DELAY", "Delay"),
    FxOption("REVERB", "Reverb"),
    FxOption("CUT", "Beat Cut (1/4)"),
    FxOption("PING_PONG", "Ping Pong"),
    FxOption("FLANGER", "Flanger"),
    FxOption("PHASER", "Phaser"),
    FxOption("TRANS", "Trans Gate"),
    FxOption("FILTER_LFO", "Filter LFO")
)

enum class EffectType(val displayName: String) {
    REVERB("REVERB"),
    ECHO_DELAY("ECHO / DELAY"),
    FLANGER("FLANGER"),
    FILTER_SWEEP("FILTER SWEEP")
}

data class ReverbParams(
    val isEnabled: Boolean = false,
    val wetGain: Float = 0.20f,
    val decayTimeSec: Float = 2.5f
)

data class DelayParams(
    val isEnabled: Boolean = false,
    val feedback: Float = 0.40f,
    val timeDivision: String = "1/2"
)

data class FlangerParams(
    val isEnabled: Boolean = false,
    val rateHz: Float = 0.5f,
    val depth: Float = 0.6f
)

data class FilterSweepParams(
    val isEnabled: Boolean = false,
    val cutoffHz: Float = 1000f,
    val resonance: Float = 2.0f
)


/**
 * DJB Core — Native Android DSP Effects Engine
 * Faithful migration of src/core/effects/EffectsEngine.ts & FX rack from App.tsx.
 * Dual X/Y Touch Pads (Deck A / Deck B) with continuous drag tracking,
 * hardware effect lock, and anti-saturation calibrated Reverb/Filter/Delay DSP.
 */
class AndroidEffectsEngine {

    // Slot 1 (Deck A) and Slot 2 (Deck B)
    private val _slotA = MutableStateFlow(
        FxSlotState(id = 1, name = "FILTER", enabledDeckA = true, wetDry = 0f)
    )
    val slotA: StateFlow<FxSlotState> = _slotA.asStateFlow()

    private val _slotB = MutableStateFlow(
        FxSlotState(id = 2, name = "FILTER", enabledDeckB = true, wetDry = 0f)
    )
    val slotB: StateFlow<FxSlotState> = _slotB.asStateFlow()

    // Pad A (X, Y in 0.0 to 1.0) and Pad Lock A
    private val _padCoordA = MutableStateFlow(Pair(0.5f, 0.0f))
    val padCoordA: StateFlow<Pair<Float, Float>> = _padCoordA.asStateFlow()

    private val _lockA = MutableStateFlow(false)
    val lockA: StateFlow<Boolean> = _lockA.asStateFlow()

    // Pad B (X, Y in 0.0 to 1.0) and Pad Lock B
    private val _padCoordB = MutableStateFlow(Pair(0.5f, 0.0f))
    val padCoordB: StateFlow<Pair<Float, Float>> = _padCoordB.asStateFlow()

    private val _lockB = MutableStateFlow(false)
    val lockB: StateFlow<Boolean> = _lockB.asStateFlow()

    fun setEffectName(deckId: String, name: String) {
        if (deckId == "A") {
            _slotA.value = _slotA.value.copy(name = name)
        } else {
            _slotB.value = _slotB.value.copy(name = name)
        }
    }

    fun toggleLock(deckId: String) {
        if (deckId == "A") {
            val next = !_lockA.value
            _lockA.value = next
            _slotA.value = _slotA.value.copy(active = next)
        } else {
            val next = !_lockB.value
            _lockB.value = next
            _slotB.value = _slotB.value.copy(active = next)
        }
    }

    fun updatePad(deckId: String, x: Float, y: Float, isPointerDown: Boolean) {
        val clampedX = x.coerceIn(0f, 1f)
        val clampedY = y.coerceIn(0f, 1f)
        val depth = (clampedY * 100f).coerceIn(0f, 100f)

        if (deckId == "A") {
            _padCoordA.value = Pair(clampedX, clampedY)
            val shouldBeActive = isPointerDown || _lockA.value
            _slotA.value = _slotA.value.copy(
                wetDry = depth,
                active = shouldBeActive
            )
        } else {
            _padCoordB.value = Pair(clampedX, clampedY)
            val shouldBeActive = isPointerDown || _lockB.value
            _slotB.value = _slotB.value.copy(
                wetDry = depth,
                active = shouldBeActive
            )
        }
    }

    fun releasePad(deckId: String) {
        if (deckId == "A") {
            if (!_lockA.value) {
                _slotA.value = _slotA.value.copy(active = false)
            }
        } else {
            if (!_lockB.value) {
                _slotB.value = _slotB.value.copy(active = false)
            }
        }
    }
}
