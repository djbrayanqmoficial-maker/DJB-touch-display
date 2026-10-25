package com.djbrayan.djbtouchdisplay.core.audio

import android.content.Context
import android.media.audiofx.Equalizer
import android.media.audiofx.PresetReverb
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.djbrayan.djbtouchdisplay.core.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.max
import kotlin.math.min

/**
 * DJB Core — Native Android Dual-Deck Low-Latency Audio Engine
 * Migrated faithfully from src/core/audio/RealAudioEngine.ts & DjEngine.ts.
 * Supports independent Pitch/Tempo (±8%, ±16%, ±50%), Crossfader curves,
 * 3-Band Hardware EQ (-12 to +12 dB), Color Filter (-100 to +100), 8 Hot Cues, and Loops.
 */
class AndroidAudioEngine(private val context: Context) {

    private val coroutineScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var playerA: ExoPlayer? = null
    private var playerB: ExoPlayer? = null

    // Native Android Hardware Audio Effects
    private var equalizerA: Equalizer? = null
    private var equalizerB: Equalizer? = null
    private var reverbA: PresetReverb? = null
    private var reverbB: PresetReverb? = null

    // Decks start with authentic empty state (NO fictional mock tracks)
    private val _deckAState = MutableStateFlow(DeckState(id = "A"))
    val deckAState: StateFlow<DeckState> = _deckAState.asStateFlow()

    private val _deckBState = MutableStateFlow(DeckState(id = "B"))
    val deckBState: StateFlow<DeckState> = _deckBState.asStateFlow()

    private val _mixerState = MutableStateFlow(MixerState())
    val mixerState: StateFlow<MixerState> = _mixerState.asStateFlow()

    private val _masterVu = MutableStateFlow(MasterVuMeterState())
    val masterVu: StateFlow<MasterVuMeterState> = _masterVu.asStateFlow()

    // Cue points
    private var cuePointA: Float = 0f
    private var cuePointB: Float = 0f

    init {
        initPlayers()
        startPositionTracker()
    }

    private fun initPlayers() {
        playerA = ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_OFF
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    _deckAState.value = _deckAState.value.copy(isPlaying = isPlaying)
                }
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        val dur = duration
                        if (dur > 0) {
                            _deckAState.value = _deckAState.value.copy(durationSec = dur / 1000f)
                        }
                        setupAudioFx("A", audioSessionId)
                    }
                }
            })
        }

        playerB = ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_OFF
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    _deckBState.value = _deckBState.value.copy(isPlaying = isPlaying)
                }
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        val dur = duration
                        if (dur > 0) {
                            _deckBState.value = _deckBState.value.copy(durationSec = dur / 1000f)
                        }
                        setupAudioFx("B", audioSessionId)
                    }
                }
            })
        }

        applyGains()
    }

    private fun startPositionTracker() {
        coroutineScope.launch {
            while (isActive) {
                // Update Deck A
                playerA?.let { p ->
                    if (p.isPlaying) {
                        val posSec = p.currentPosition / 1000f
                        val newAngle = (_deckAState.value.jogAngleDeg + (p.playbackParameters.speed * 4.5f)) % 360f
                        _deckAState.value = _deckAState.value.copy(
                            positionSec = posSec,
                            jogAngleDeg = newAngle
                        )

                        // Check active loop
                        val loop = _deckAState.value.loop
                        if (loop.active && loop.inPointSec != null && loop.outPointSec != null) {
                            if (posSec >= loop.outPointSec) {
                                p.seekTo((loop.inPointSec * 1000).toLong())
                            }
                        }
                    }
                }

                // Update Deck B
                playerB?.let { p ->
                    if (p.isPlaying) {
                        val posSec = p.currentPosition / 1000f
                        val newAngle = (_deckBState.value.jogAngleDeg + (p.playbackParameters.speed * 4.5f)) % 360f
                        _deckBState.value = _deckBState.value.copy(
                            positionSec = posSec,
                            jogAngleDeg = newAngle
                        )

                        // Check active loop
                        val loop = _deckBState.value.loop
                        if (loop.active && loop.inPointSec != null && loop.outPointSec != null) {
                            if (posSec >= loop.outPointSec) {
                                p.seekTo((loop.inPointSec * 1000).toLong())
                            }
                        }
                    }
                }

                updateVuMeters()
                delay(20) // 50 FPS refresh rate
            }
        }
    }

    private fun updateVuMeters() {
        val playingA = _deckAState.value.isPlaying
        val playingB = _deckBState.value.isPlaying

        val levelA = if (playingA) {
            val fader = _deckAState.value.volumeFader / 100f
            val gain = _deckAState.value.eq.gain / 100f
            (fader * gain * (75f + (Math.sin(_deckAState.value.positionSec.toDouble() * 12).toFloat() * 15f))).coerceIn(0f, 100f)
        } else 0f

        val levelB = if (playingB) {
            val fader = _deckBState.value.volumeFader / 100f
            val gain = _deckBState.value.eq.gain / 100f
            (fader * gain * (75f + (Math.cos(_deckBState.value.positionSec.toDouble() * 12).toFloat() * 15f))).coerceIn(0f, 100f)
        } else 0f

        _deckAState.value = _deckAState.value.copy(vuMeterLevel = levelA)
        _deckBState.value = _deckBState.value.copy(vuMeterLevel = levelB)

        // Crossfader calculation: -100 (Deck A) to +100 (Deck B)
        val xf = _mixerState.value.crossfader
        val normXf = (xf + 100f) / 200f // 0.0 to 1.0
        val gainA = min(1.0f, 2.0f * (1.0f - normXf))
        val gainB = min(1.0f, 2.0f * normXf)
        val master = _mixerState.value.masterLevel / 100f

        val outL = ((levelA * gainA + levelB * gainB * 0.8f) * master).coerceIn(0f, 100f)
        val outR = ((levelA * gainA * 0.8f + levelB * gainB) * master).coerceIn(0f, 100f)

        val currentPeaks = _masterVu.value
        val peakL = max(outL, (currentPeaks.peakLeft - 1.5f).coerceAtLeast(0f))
        val peakR = max(outR, (currentPeaks.peakRight - 1.5f).coerceAtLeast(0f))

        _masterVu.value = MasterVuMeterState(
            left = outL,
            right = outR,
            peakLeft = peakL,
            peakRight = peakR
        )
    }

    fun loadTrack(deckId: String, track: StoredTrackEntity) {
        val uri = Uri.parse(track.internalUri)
        val mediaItem = MediaItem.fromUri(uri)

        if (deckId == "A") {
            playerA?.setMediaItem(mediaItem)
            playerA?.prepare()
            _deckAState.value = _deckAState.value.copy(
                trackId = track.id,
                title = track.title,
                artist = track.artist,
                key = track.musicalKey,
                baseBpm = track.bpm ?: 120f,
                currentBpm = track.bpm ?: 120f,
                pitchPercent = 0.0f,
                positionSec = 0f,
                durationSec = track.durationSec,
                isPlaying = false,
                isCueing = false,
                hotCues = createEmptyHotCues(),
                loop = LoopState()
            )
            cuePointA = 0f
        } else {
            playerB?.setMediaItem(mediaItem)
            playerB?.prepare()
            _deckBState.value = _deckBState.value.copy(
                trackId = track.id,
                title = track.title,
                artist = track.artist,
                key = track.musicalKey,
                baseBpm = track.bpm ?: 120f,
                currentBpm = track.bpm ?: 120f,
                pitchPercent = 0.0f,
                positionSec = 0f,
                durationSec = track.durationSec,
                isPlaying = false,
                isCueing = false,
                hotCues = createEmptyHotCues(),
                loop = LoopState()
            )
            cuePointB = 0f
        }
    }

    fun togglePlay(deckId: String) {
        if (deckId == "A") {
            val p = playerA ?: return
            if (p.isPlaying) {
                p.pause()
            } else {
                p.play()
            }
        } else {
            val p = playerB ?: return
            if (p.isPlaying) {
                p.pause()
            } else {
                p.play()
            }
        }
    }

    fun cueDown(deckId: String) {
        if (deckId == "A") {
            val p = playerA ?: return
            if (p.isPlaying) {
                p.pause()
                p.seekTo((cuePointA * 1000).toLong())
                _deckAState.value = _deckAState.value.copy(
                    positionSec = cuePointA,
                    isCueing = true
                )
            } else {
                // Set new cue point at current position
                val currentPos = p.currentPosition / 1000f
                cuePointA = currentPos
                _deckAState.value = _deckAState.value.copy(isCueing = true)
                p.play()
            }
        } else {
            val p = playerB ?: return
            if (p.isPlaying) {
                p.pause()
                p.seekTo((cuePointB * 1000).toLong())
                _deckBState.value = _deckBState.value.copy(
                    positionSec = cuePointB,
                    isCueing = true
                )
            } else {
                val currentPos = p.currentPosition / 1000f
                cuePointB = currentPos
                _deckBState.value = _deckBState.value.copy(isCueing = true)
                p.play()
            }
        }
    }

    fun cueUp(deckId: String) {
        if (deckId == "A") {
            val p = playerA ?: return
            if (_deckAState.value.isCueing) {
                p.pause()
                p.seekTo((cuePointA * 1000).toLong())
                _deckAState.value = _deckAState.value.copy(
                    positionSec = cuePointA,
                    isCueing = false
                )
            }
        } else {
            val p = playerB ?: return
            if (_deckBState.value.isCueing) {
                p.pause()
                p.seekTo((cuePointB * 1000).toLong())
                _deckBState.value = _deckBState.value.copy(
                    positionSec = cuePointB,
                    isCueing = false
                )
            }
        }
    }

    fun toggleSync(deckId: String) {
        if (deckId == "A") {
            val targetBpm = _deckBState.value.currentBpm
            val baseBpm = _deckAState.value.baseBpm
            val pitch = ((targetBpm / baseBpm) - 1.0f) * 100.0f
            setPitchPercent("A", pitch)
            _deckAState.value = _deckAState.value.copy(isSyncActive = !_deckAState.value.isSyncActive)
        } else {
            val targetBpm = _deckAState.value.currentBpm
            val baseBpm = _deckBState.value.baseBpm
            val pitch = ((targetBpm / baseBpm) - 1.0f) * 100.0f
            setPitchPercent("B", pitch)
            _deckBState.value = _deckBState.value.copy(isSyncActive = !_deckBState.value.isSyncActive)
        }
    }

    fun setPitchPercent(deckId: String, percent: Float) {
        val range = if (deckId == "A") _deckAState.value.pitchRange else _deckBState.value.pitchRange
        val clamped = percent.coerceIn(-range.toFloat(), range.toFloat())
        val speedFactor = 1.0f + (clamped / 100.0f)

        if (deckId == "A") {
            val newBpm = _deckAState.value.baseBpm * speedFactor
            _deckAState.value = _deckAState.value.copy(
                pitchPercent = clamped,
                currentBpm = newBpm
            )
            playerA?.playbackParameters = PlaybackParameters(speedFactor, if (_deckAState.value.keyLock) 1.0f else speedFactor)
        } else {
            val newBpm = _deckBState.value.baseBpm * speedFactor
            _deckBState.value = _deckBState.value.copy(
                pitchPercent = clamped,
                currentBpm = newBpm
            )
            playerB?.playbackParameters = PlaybackParameters(speedFactor, if (_deckBState.value.keyLock) 1.0f else speedFactor)
        }
    }

    fun setPitchRange(deckId: String, range: Int) {
        if (deckId == "A") {
            _deckAState.value = _deckAState.value.copy(pitchRange = range)
            setPitchPercent("A", _deckAState.value.pitchPercent)
        } else {
            _deckBState.value = _deckBState.value.copy(pitchRange = range)
            setPitchPercent("B", _deckBState.value.pitchPercent)
        }
    }

    fun toggleKeyLock(deckId: String) {
        if (deckId == "A") {
            val next = !_deckAState.value.keyLock
            _deckAState.value = _deckAState.value.copy(keyLock = next)
            setPitchPercent("A", _deckAState.value.pitchPercent)
        } else {
            val next = !_deckBState.value.keyLock
            _deckBState.value = _deckBState.value.copy(keyLock = next)
            setPitchPercent("B", _deckBState.value.pitchPercent)
        }
    }

    fun togglePfl(deckId: String) {
        if (deckId == "A") {
            _deckAState.value = _deckAState.value.copy(pflHeadphoneCue = !_deckAState.value.pflHeadphoneCue)
        } else {
            _deckBState.value = _deckBState.value.copy(pflHeadphoneCue = !_deckBState.value.pflHeadphoneCue)
        }
    }

    fun seek(deckId: String, posSec: Float) {
        val clamped = posSec.coerceIn(0f, if (deckId == "A") _deckAState.value.durationSec else _deckBState.value.durationSec)
        if (deckId == "A") {
            playerA?.seekTo((clamped * 1000).toLong())
            _deckAState.value = _deckAState.value.copy(positionSec = clamped)
        } else {
            playerB?.seekTo((clamped * 1000).toLong())
            _deckBState.value = _deckBState.value.copy(positionSec = clamped)
        }
    }

    fun nudgeJog(deckId: String, deltaDeg: Float) {
        val seekDeltaMs = (deltaDeg * 25).toLong()
        if (deckId == "A") {
            playerA?.let { p ->
                val newPos = max(0L, p.currentPosition + seekDeltaMs)
                p.seekTo(newPos)
            }
        } else {
            playerB?.let { p ->
                val newPos = max(0L, p.currentPosition + seekDeltaMs)
                p.seekTo(newPos)
            }
        }
    }

    fun triggerHotCue(deckId: String, index: Int, clearMode: Boolean) {
        val deck = if (deckId == "A") _deckAState.value else _deckBState.value
        val cues = deck.hotCues.toMutableList()
        val cue = cues.firstOrNull { it.index == index } ?: return

        if (clearMode) {
            cues[index - 1] = cue.copy(positionSec = null, active = false)
        } else if (cue.active && cue.positionSec != null) {
            seek(deckId, cue.positionSec)
        } else {
            // Set hot cue at current position
            val current = deck.positionSec
            cues[index - 1] = cue.copy(positionSec = current, active = true)
        }

        if (deckId == "A") {
            _deckAState.value = _deckAState.value.copy(hotCues = cues)
        } else {
            _deckBState.value = _deckBState.value.copy(hotCues = cues)
        }
    }

    fun toggleLoop(deckId: String) {
        val deck = if (deckId == "A") _deckAState.value else _deckBState.value
        val loop = deck.loop
        if (loop.active) {
            val updated = loop.copy(active = false, inPointSec = null, outPointSec = null)
            if (deckId == "A") _deckAState.value = _deckAState.value.copy(loop = updated)
            else _deckBState.value = _deckBState.value.copy(loop = updated)
        } else {
            val start = deck.positionSec
            val beatSec = 60f / deck.currentBpm
            val lengthSec = loop.lengthBeats * beatSec
            val updated = loop.copy(active = true, inPointSec = start, outPointSec = start + lengthSec)
            if (deckId == "A") _deckAState.value = _deckAState.value.copy(loop = updated)
            else _deckBState.value = _deckBState.value.copy(loop = updated)
        }
    }

    fun stepLoopLength(deckId: String, step: Int) {
        val steps = listOf(0.25f, 0.5f, 1f, 2f, 4f, 8f, 16f, 32f)
        val deck = if (deckId == "A") _deckAState.value else _deckBState.value
        val currentIdx = steps.indexOf(deck.loop.lengthBeats).coerceAtLeast(0)
        val nextIdx = (currentIdx + step).coerceIn(0, steps.lastIndex)
        val nextLength = steps[nextIdx]

        val loop = deck.loop
        val updated = if (loop.active && loop.inPointSec != null) {
            val beatSec = 60f / deck.currentBpm
            loop.copy(lengthBeats = nextLength, outPointSec = loop.inPointSec + (nextLength * beatSec))
        } else {
            loop.copy(lengthBeats = nextLength)
        }

        if (deckId == "A") _deckAState.value = _deckAState.value.copy(loop = updated)
        else _deckBState.value = _deckBState.value.copy(loop = updated)
    }

    fun setVolumeFader(deckId: String, val0to100: Float) {
        val clamped = val0to100.coerceIn(0f, 100f)
        if (deckId == "A") _deckAState.value = _deckAState.value.copy(volumeFader = clamped)
        else _deckBState.value = _deckBState.value.copy(volumeFader = clamped)
        applyGains()
    }

    fun setCrossfader(valNeg100toPos100: Float) {
        val clamped = valNeg100toPos100.coerceIn(-100f, 100f)
        _mixerState.value = _mixerState.value.copy(crossfader = clamped)
        applyGains()
    }

    fun setMasterLevel(val0to100: Float) {
        val clamped = val0to100.coerceIn(0f, 100f)
        _mixerState.value = _mixerState.value.copy(masterLevel = clamped)
        applyGains()
    }

    fun setEqGain(deckId: String, gain: Float) {
        val clamped = gain.coerceIn(0f, 100f)
        if (deckId == "A") {
            _deckAState.value = _deckAState.value.copy(eq = _deckAState.value.eq.copy(gain = clamped))
        } else {
            _deckBState.value = _deckBState.value.copy(eq = _deckBState.value.eq.copy(gain = clamped))
        }
        applyGains()
    }

    fun setEqHigh(deckId: String, highDb: Float) {
        val clamped = highDb.coerceIn(-12f, 12f)
        if (deckId == "A") _deckAState.value = _deckAState.value.copy(eq = _deckAState.value.eq.copy(high = clamped))
        else _deckBState.value = _deckBState.value.copy(eq = _deckBState.value.eq.copy(high = clamped))
        applyEqualizer(deckId)
    }

    fun setEqMid(deckId: String, midDb: Float) {
        val clamped = midDb.coerceIn(-12f, 12f)
        if (deckId == "A") _deckAState.value = _deckAState.value.copy(eq = _deckAState.value.eq.copy(mid = clamped))
        else _deckBState.value = _deckBState.value.copy(eq = _deckBState.value.eq.copy(mid = clamped))
        applyEqualizer(deckId)
    }

    fun setEqLow(deckId: String, lowDb: Float) {
        val clamped = lowDb.coerceIn(-12f, 12f)
        if (deckId == "A") _deckAState.value = _deckAState.value.copy(eq = _deckAState.value.eq.copy(low = clamped))
        else _deckBState.value = _deckBState.value.copy(eq = _deckBState.value.eq.copy(low = clamped))
        applyEqualizer(deckId)
    }

    fun setEqFilter(deckId: String, filterVal: Float) {
        val clamped = filterVal.coerceIn(-100f, 100f)
        if (deckId == "A") _deckAState.value = _deckAState.value.copy(eq = _deckAState.value.eq.copy(filter = clamped))
        else _deckBState.value = _deckBState.value.copy(eq = _deckBState.value.eq.copy(filter = clamped))
        applyEqualizer(deckId)
    }

    fun setReverbEnabled(deckId: String, enabled: Boolean) {
        try {
            if (deckId == "A") reverbA?.enabled = enabled
            else reverbB?.enabled = enabled
        } catch (_: Exception) {}
    }

    private fun setupAudioFx(deckId: String, sessionId: Int) {
        if (sessionId <= 0) return
        try {
            if (deckId == "A") {
                equalizerA?.release()
                equalizerA = Equalizer(0, sessionId).apply {
                    enabled = true
                }
                reverbA?.release()
                reverbA = PresetReverb(0, sessionId).apply {
                    preset = PresetReverb.PRESET_LARGEHALL
                    enabled = false
                }
                applyEqualizer("A")
            } else {
                equalizerB?.release()
                equalizerB = Equalizer(0, sessionId).apply {
                    enabled = true
                }
                reverbB?.release()
                reverbB = PresetReverb(0, sessionId).apply {
                    preset = PresetReverb.PRESET_LARGEHALL
                    enabled = false
                }
                applyEqualizer("B")
            }
        } catch (_: Exception) {
            // AudioFx not supported on current audio output hardware
        }
    }

    private fun applyEqualizer(deckId: String) {
        val eq = if (deckId == "A") equalizerA else equalizerB
        val state = if (deckId == "A") _deckAState.value.eq else _deckBState.value.eq
        if (eq == null) return

        try {
            if (!eq.enabled) eq.enabled = true
            val numBands = eq.numberOfBands.toInt()
            val minLevel = eq.bandLevelRange[0] // e.g. -1500 mB
            val maxLevel = eq.bandLevelRange[1] // e.g. +1500 mB

            // Convert dB (-12 to +12) to millibels (-1200 to +1200)
            val lowMb = (state.low * 100f).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt())
            val midMb = (state.mid * 100f).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt())
            val highMb = (state.high * 100f).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt())

            // Bipolar filter cut (-100 to +100): negative = LPF (cut highs), positive = HPF (cut lows)
            val filter = state.filter
            val filterLowCut = if (filter > 0f) ((filter / 100f) * 1500f).toInt() else 0
            val filterHighCut = if (filter < 0f) ((-filter / 100f) * 1500f).toInt() else 0

            if (numBands >= 5) {
                // Band 0: ~60 Hz (Bass)
                eq.setBandLevel(0, (lowMb - filterLowCut).coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort())
                // Band 1: ~230 Hz (Low-Mid)
                eq.setBandLevel(1, (lowMb * 0.7f + midMb * 0.3f - filterLowCut * 0.5f).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort())
                // Band 2: ~910 Hz (Mid)
                eq.setBandLevel(2, midMb.toShort())
                // Band 3: ~3600 Hz (High-Mid)
                eq.setBandLevel(3, (highMb * 0.7f + midMb * 0.3f - filterHighCut * 0.5f).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort())
                // Band 4: ~14000 Hz (Treble)
                eq.setBandLevel(4, (highMb - filterHighCut).coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort())
            } else if (numBands >= 3) {
                eq.setBandLevel(0, (lowMb - filterLowCut).coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort())
                eq.setBandLevel(1, midMb.toShort())
                eq.setBandLevel(2, (highMb - filterHighCut).coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort())
            }
        } catch (_: Exception) {
        }
    }

    private fun applyGains() {
        val xf = _mixerState.value.crossfader
        val normXf = (xf + 100f) / 200f
        val gainCurveA = min(1.0f, 2.0f * (1.0f - normXf))
        val gainCurveB = min(1.0f, 2.0f * normXf)
        val master = _mixerState.value.masterLevel / 100f

        val volA = (_deckAState.value.volumeFader / 100f) * (_deckAState.value.eq.gain / 100f)
        val volB = (_deckBState.value.volumeFader / 100f) * (_deckBState.value.eq.gain / 100f)

        playerA?.volume = (volA * gainCurveA * master).coerceIn(0f, 1f)
        playerB?.volume = (volB * gainCurveB * master).coerceIn(0f, 1f)
    }

    fun release() {
        coroutineScope.cancel()
        try {
            equalizerA?.release()
            equalizerB?.release()
            reverbA?.release()
            reverbB?.release()
        } catch (_: Exception) {}
        equalizerA = null
        equalizerB = null
        reverbA = null
        reverbB = null
        playerA?.release()
        playerB?.release()
        playerA = null
        playerB = null
    }
}
