package com.djbrayan.djbtouchdisplay.core

/**
 * DJB Core — Architecture & State Contracts
 * Migrated with 100% fidelity from src/core/dj/DjEngine.ts
 * Created by DJ Brayan for DJB Touch Display
 */

enum class OperatingMode {
    UNSELECTED,
    STANDALONE,
    VIRTUALDJ,
    MOBILE_ONLY
}

enum class MainSection(val label: String) {
    DECKS("DECKS"),
    WAVEFORMS("WAVEFORMS"),
    MIXER_EQ("MIXER / EQ"),
    LOOPS_HOTCUES("LOOPS / CUES"),
    FX("FX"),
    PERFORMANCE("PADS"),
    LIBRARY("LIBRARY"),
    SETTINGS("SETTINGS")
}

data class HotCueSlot(
    val index: Int, // 1 - 8
    val label: String = "EMPTY",
    val positionSec: Float? = null,
    val active: Boolean = false
)

data class LoopState(
    val active: Boolean = false,
    val lengthBeats: Float = 4.0f, // 0.25, 0.5, 1, 2, 4, 8, 16, 32
    val inPointSec: Float? = null,
    val outPointSec: Float? = null
)

data class DeckEqState(
    val high: Float = 0f,   // -12 to +12 dB
    val mid: Float = 0f,    // -12 to +12 dB
    val low: Float = 0f,    // -12 to +12 dB
    val filter: Float = 0f, // -100 (LPF) to +100 (HPF), 0 center
    val gain: Float = 80f   // 0 to 100
)

data class DeckState(
    val id: String, // "A" or "B"
    val trackId: String = "",
    val title: String = if (id == "A") "DECK A · SIN PISTA CARGADA" else "DECK B · SIN PISTA CARGADA",
    val artist: String = "<BIBLIOTECA>",
    val key: String = "--",
    val baseBpm: Float = 120.0f,
    val currentBpm: Float = 120.0f,
    val pitchPercent: Float = 0.0f, // -pitchRange% to +pitchRange%
    val pitchRange: Int = 8,        // 8, 16, 50
    val isPlaying: Boolean = false,
    val isCueing: Boolean = false,
    val isSyncActive: Boolean = false,
    val keyLock: Boolean = true,
    val pflHeadphoneCue: Boolean = (id == "A"),
    val positionSec: Float = 0f,
    val durationSec: Float = 0f,
    val jogAngleDeg: Float = 0f,
    val volumeFader: Float = 85f,   // 0 - 100
    val vuMeterLevel: Float = 0f,   // 0 - 100
    val eq: DeckEqState = DeckEqState(),
    val hotCues: List<HotCueSlot> = createEmptyHotCues(),
    val loop: LoopState = LoopState()
)

data class FxSlotState(
    val id: Int, // 1, 2, 3
    val name: String = "FILTER", // FILTER, ECHO, DELAY, REVERB, CUT, PING_PONG, FLANGER, PHASER, TRANS, FILTER_LFO
    val enabledDeckA: Boolean = false,
    val enabledDeckB: Boolean = false,
    val active: Boolean = false,
    val wetDry: Float = 50f, // 0 - 100
    val beatDivision: String = "1/2" // 1/4, 1/2, 3/4, 1, 2, 4
)

enum class CrossfaderCurve {
    SMOOTH,
    FAST_CUT,
    LINEAR
}

data class MixerState(
    val crossfader: Float = 0f, // -100 (Deck A) to +100 (Deck B), 0 center
    val crossfaderCurve: CrossfaderCurve = CrossfaderCurve.SMOOTH,
    val masterLevel: Float = 85f, // 0 - 100
    val boothLevel: Float = 75f,
    val headphoneLevel: Float = 80f,
    val headphoneMix: Float = 50f // 0 (Cue) to 100 (Master)
)

data class MasterVuMeterState(
    val left: Float = 0f,
    val right: Float = 0f,
    val peakLeft: Float = 0f,
    val peakRight: Float = 0f
)

fun createEmptyHotCues(): List<HotCueSlot> {
    return (1..8).map { idx ->
        HotCueSlot(index = idx, label = "EMPTY", positionSec = null, active = false)
    }
}

fun formatTimeCode(seconds: Float): String {
    val totalSec = seconds.coerceAtLeast(0f)
    val mins = (totalSec / 60).toInt()
    val secs = (totalSec % 60).toInt()
    val millis = ((totalSec - totalSec.toInt()) * 10).toInt()
    return "%02d:%02d.%d".format(mins, secs, millis)
}

enum class PerformancePadPageId {
    HOT_CUES,
    BEAT_JUMP,
    STEMS,
    SAMPLER
}

data class StoredTrackEntity(
    val id: String,
    val title: String,
    val artist: String = "Unknown",
    val album: String = "Unknown",
    val genre: String = "Unknown",
    val durationSec: Float = 0f,
    val bpm: Float? = null,
    val musicalKey: String = "--",
    val format: String = "AUDIO",
    val internalUri: String
)
