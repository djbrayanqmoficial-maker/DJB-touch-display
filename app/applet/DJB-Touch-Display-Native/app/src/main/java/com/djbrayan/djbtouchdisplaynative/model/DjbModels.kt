package com.djbrayan.djbtouchdisplaynative.model

import android.net.Uri

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

enum class CrossfaderCurve {
    SMOOTH,
    SHARP,
    SCRATCH
}

data class HotCuePoint(
    val id: Int,
    val positionSec: Double = 0.0,
    val colorHex: String = "#0099DB",
    val label: String = "CUE $id",
    val isSet: Boolean = false
)

data class DeckState(
    val id: String = "A",
    val trackTitle: String = "NO TRACK LOADED",
    val artist: String = "TAP LIBRARY TO BROWSE",
    val album: String = "",
    val durationSec: Double = 0.0,
    val currentPositionSec: Double = 0.0,
    val isPlaying: Boolean = false,
    val isLoaded: Boolean = false,
    val pitchPercent: Float = 0.0f,
    val effectiveBpm: Double = 126.0,
    val originalBpm: Double = 126.0,
    val key: String = "8A",
    val isSync: Boolean = false,
    val isMaster: Boolean = false,
    val volume: Float = 1.0f,
    val gainDb: Float = 0.0f,
    val eqHighDb: Float = 0.0f,
    val eqMidDb: Float = 0.0f,
    val eqLowDb: Float = 0.0f,
    val filterValue: Float = 0.0f, // -100 (LPF) to 0 (bypass) to +100 (HPF)
    val isPfl: Boolean = false,
    val vinylMode: Boolean = true,
    val hotCues: List<HotCuePoint> = (1..8).map { HotCuePoint(id = it) },
    val loopActive: Boolean = false,
    val loopStartSec: Double = 0.0,
    val loopEndSec: Double = 0.0,
    val loopLengthBeats: Double = 4.0
)

data class MixerState(
    val crossfaderPosition: Float = 0.0f, // -1.0 (Deck A) .. 0.0 (Center) .. +1.0 (Deck B)
    val crossfaderCurve: CrossfaderCurve = CrossfaderCurve.SMOOTH,
    val masterVolume: Float = 0.85f,
    val pflVolume: Float = 0.75f,
    val cueMasterMix: Float = 0.0f,
    val vuMeterLeft: Float = 0.0f,
    val vuMeterRight: Float = 0.0f,
    val vuMeterDeckA: Float = 0.0f,
    val vuMeterDeckB: Float = 0.0f
)

data class FxSlotState(
    val name: String = "FILTER",
    val wetDryPercent: Float = 0.0f,
    val parameterPercent: Float = 50.0f,
    val beatMultiplier: Float = 1.0f,
    val isEnabled: Boolean = false
)

enum class PerformancePadPage(val label: String) {
    HOT_CUE("HOT CUE"),
    AUTO_LOOP("AUTO LOOP"),
    SAMPLER("SAMPLER"),
    BEAT_JUMP("BEAT JUMP")
}

data class SamplerSlotState(
    val slotIndex: Int,
    val name: String,
    val isPlaying: Boolean = false,
    val isLooping: Boolean = false,
    val volumePercent: Float = 80.0f,
    val durationSec: Double = 1.0
)

data class StoredTrackEntity(
    val id: String,
    val uri: Uri,
    val title: String,
    val artist: String,
    val album: String,
    val durationSec: Double,
    val bpm: Double = 126.0,
    val key: String = "8A",
    val genre: String = "Electronic",
    val folderPath: String = "",
    val fileName: String = "",
    val fileSize: Long = 0L
)

data class WaveformBinSample(
    val low: Float = 0f,
    val mid: Float = 0f,
    val high: Float = 0f
)

data class CachedWaveformData(
    val overviewBins: List<WaveformBinSample> = emptyList(),
    val scrollingBins: List<WaveformBinSample> = emptyList(),
    val detectedBpm: Double = 126.0,
    val detectedKey: String = "8A"
)

fun formatTimeCode(seconds: Double): String {
    val totalSec = seconds.toInt().coerceAtLeast(0)
    val mins = totalSec / 60
    val secs = totalSec % 60
    val millis = ((seconds - totalSec) * 100).toInt().coerceIn(0, 99)
    return String.format("%02d:%02d.%02d", mins, secs, millis)
}
