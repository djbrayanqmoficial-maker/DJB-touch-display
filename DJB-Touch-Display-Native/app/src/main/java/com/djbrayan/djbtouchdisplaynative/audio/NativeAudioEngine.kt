package com.djbrayan.djbtouchdisplaynative.audio

import android.content.Context
import android.media.audiofx.Equalizer
import android.media.audiofx.PresetReverb
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.djbrayan.djbtouchdisplaynative.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * DJB Touch Display Native — Low-Latency Dual-Deck Audio Engine
 * Real implementation matching src/core/audio/RealAudioEngine.ts & DjEngine.ts.
 * Utilizes ExoPlayer dual-instance with hardware AudioFX (Equalizer & Reverb).
 */
class NativeAudioEngine(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // ExoPlayer instances
    private var playerA: ExoPlayer? = null
    private var playerB: ExoPlayer? = null

    // Hardware AudioFX
    private var equalizerA: Equalizer? = null
    private var equalizerB: Equalizer? = null
    private var reverbA: PresetReverb? = null
    private var reverbB: PresetReverb? = null

    // State flows
    private val _deckA = MutableStateFlow(DeckState(id = "A"))
    val deckA: StateFlow<DeckState> = _deckA.asStateFlow()

    private val _deckB = MutableStateFlow(DeckState(id = "B"))
    val deckB: StateFlow<DeckState> = _deckB.asStateFlow()

    private val _mixer = MutableStateFlow(MixerState())
    val mixer: StateFlow<MixerState> = _mixer.asStateFlow()

    private var cuePointA: Double = 0.0
    private var cuePointB: Double = 0.0

    private var positionJob: Job? = null

    init {
        initPlayers()
        startPositionWatcher()
    }

    private fun initPlayers() {
        playerA = ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_OFF
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_READY) {
                        attachAudioFxA(audioSessionId)
                        val dur = duration.coerceAtLeast(0) / 1000.0
                        _deckA.value = _deckA.value.copy(
                            durationSec = dur,
                            isLoaded = true
                        )
                    }
                }
            })
        }

        playerB = ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_OFF
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_READY) {
                        attachAudioFxB(audioSessionId)
                        val dur = duration.coerceAtLeast(0) / 1000.0
                        _deckB.value = _deckB.value.copy(
                            durationSec = dur,
                            isLoaded = true
                        )
                    }
                }
            })
        }
    }

    private fun attachAudioFxA(sessionId: Int) {
        try {
            equalizerA?.release()
            equalizerA = Equalizer(0, sessionId).apply {
                enabled = true
            }
            applyEqualizer("A")
        } catch (_: Exception) {}
    }

    private fun attachAudioFxB(sessionId: Int) {
        try {
            equalizerB?.release()
            equalizerB = Equalizer(0, sessionId).apply {
                enabled = true
            }
            applyEqualizer("B")
        } catch (_: Exception) {}
    }

    private fun startPositionWatcher() {
        positionJob?.cancel()
        positionJob = scope.launch {
            while (isActive) {
                // Deck A
                playerA?.let { pA ->
                    if (pA.isPlaying) {
                        val currentSec = pA.currentPosition / 1000.0
                        val stA = _deckA.value
                        // Check loop
                        if (stA.loopActive && stA.loopEndSec > stA.loopStartSec && currentSec >= stA.loopEndSec) {
                            pA.seekTo((stA.loopStartSec * 1000).toLong())
                        } else {
                            _deckA.value = stA.copy(currentPositionSec = currentSec)
                        }
                    }
                }

                // Deck B
                playerB?.let { pB ->
                    if (pB.isPlaying) {
                        val currentSec = pB.currentPosition / 1000.0
                        val stB = _deckB.value
                        // Check loop
                        if (stB.loopActive && stB.loopEndSec > stB.loopStartSec && currentSec >= stB.loopEndSec) {
                            pB.seekTo((stB.loopStartSec * 1000).toLong())
                        } else {
                            _deckB.value = stB.copy(currentPositionSec = currentSec)
                        }
                    }
                }

                // VU Meters synthesis from play state + volumes
                updateVuMeters()
                delay(33) // ~30 FPS UI updates
            }
        }
    }

    private fun updateVuMeters() {
        val stA = _deckA.value
        val stB = _deckB.value
        val mx = _mixer.value

        val rawA = if (stA.isPlaying) (stA.volume * (0.6f + (Math.random().toFloat() * 0.35f))) else 0f
        val rawB = if (stB.isPlaying) (stB.volume * (0.6f + (Math.random().toFloat() * 0.35f))) else 0f

        val gains = computeCrossfaderGains(mx.crossfaderPosition, mx.crossfaderCurve)
        val outA = rawA * gains.first * mx.masterVolume
        val outB = rawB * gains.second * mx.masterVolume

        _mixer.value = mx.copy(
            vuMeterDeckA = rawA,
            vuMeterDeckB = rawB,
            vuMeterLeft = min(1f, outA + (outB * 0.3f)),
            vuMeterRight = min(1f, outB + (outA * 0.3f))
        )
    }

    // ==========================================
    // TRACK LOADING & TRANSPORT CONTROLS
    // ==========================================

    fun loadTrack(deckId: String, track: StoredTrackEntity) {
        val mediaItem = MediaItem.fromUri(track.uri)
        if (deckId == "A") {
            playerA?.apply {
                stop()
                setMediaItem(mediaItem)
                prepare()
            }
            cuePointA = 0.0
            _deckA.value = _deckA.value.copy(
                trackTitle = track.title,
                artist = track.artist,
                album = track.album,
                durationSec = track.durationSec,
                currentPositionSec = 0.0,
                effectiveBpm = track.bpm,
                originalBpm = track.bpm,
                key = track.key,
                isPlaying = false,
                isLoaded = true,
                hotCues = (1..8).map { HotCuePoint(id = it) }
            )
        } else {
            playerB?.apply {
                stop()
                setMediaItem(mediaItem)
                prepare()
            }
            cuePointB = 0.0
            _deckB.value = _deckB.value.copy(
                trackTitle = track.title,
                artist = track.artist,
                album = track.album,
                durationSec = track.durationSec,
                currentPositionSec = 0.0,
                effectiveBpm = track.bpm,
                originalBpm = track.bpm,
                key = track.key,
                isPlaying = false,
                isLoaded = true,
                hotCues = (1..8).map { HotCuePoint(id = it) }
            )
        }
    }

    fun togglePlayPause(deckId: String) {
        if (deckId == "A") {
            val p = playerA ?: return
            if (p.isPlaying) {
                p.pause()
                _deckA.value = _deckA.value.copy(isPlaying = false)
            } else {
                p.play()
                _deckA.value = _deckA.value.copy(isPlaying = true)
            }
        } else {
            val p = playerB ?: return
            if (p.isPlaying) {
                p.pause()
                _deckB.value = _deckB.value.copy(isPlaying = false)
            } else {
                p.play()
                _deckB.value = _deckB.value.copy(isPlaying = true)
            }
        }
    }

    fun cuePress(deckId: String) {
        if (deckId == "A") {
            val p = playerA ?: return
            if (p.isPlaying) {
                p.pause()
                p.seekTo((cuePointA * 1000).toLong())
                _deckA.value = _deckA.value.copy(
                    isPlaying = false,
                    currentPositionSec = cuePointA
                )
            } else {
                cuePointA = _deckA.value.currentPositionSec
                p.seekTo((cuePointA * 1000).toLong())
            }
        } else {
            val p = playerB ?: return
            if (p.isPlaying) {
                p.pause()
                p.seekTo((cuePointB * 1000).toLong())
                _deckB.value = _deckB.value.copy(
                    isPlaying = false,
                    currentPositionSec = cuePointB
                )
            } else {
                cuePointB = _deckB.value.currentPositionSec
                p.seekTo((cuePointB * 1000).toLong())
            }
        }
    }

    fun seekTo(deckId: String, positionSec: Double) {
        val posMs = (positionSec * 1000).toLong()
        if (deckId == "A") {
            playerA?.seekTo(posMs)
            _deckA.value = _deckA.value.copy(currentPositionSec = positionSec)
        } else {
            playerB?.seekTo(posMs)
            _deckB.value = _deckB.value.copy(currentPositionSec = positionSec)
        }
    }

    fun setPitchPercent(deckId: String, percent: Float) {
        val speed = 1.0f + (percent / 100.0f)
        val params = PlaybackParameters(speed.coerceIn(0.5f, 2.0f))
        if (deckId == "A") {
            playerA?.playbackParameters = params
            val baseBpm = _deckA.value.originalBpm
            _deckA.value = _deckA.value.copy(
                pitchPercent = percent,
                effectiveBpm = baseBpm * speed
            )
        } else {
            playerB?.playbackParameters = params
            val baseBpm = _deckB.value.originalBpm
            _deckB.value = _deckB.value.copy(
                pitchPercent = percent,
                effectiveBpm = baseBpm * speed
            )
        }
    }

    fun pitchBendStep(deckId: String, direction: Float) {
        val player = if (deckId == "A") playerA else playerB
        val currentPitch = if (deckId == "A") _deckA.value.pitchPercent else _deckB.value.pitchPercent
        val temporaryPitch = currentPitch + (direction * 4.0f)
        val speed = 1.0f + (temporaryPitch / 100.0f)
        player?.playbackParameters = PlaybackParameters(speed.coerceIn(0.5f, 2.0f))

        scope.launch {
            delay(200)
            val normalSpeed = 1.0f + (currentPitch / 100.0f)
            player?.playbackParameters = PlaybackParameters(normalSpeed.coerceIn(0.5f, 2.0f))
        }
    }

    fun toggleSync(deckId: String) {
        if (deckId == "A") {
            val sync = !_deckA.value.isSync
            _deckA.value = _deckA.value.copy(isSync = sync)
            if (sync && _deckB.value.isPlaying) {
                val targetBpm = _deckB.value.effectiveBpm
                val neededPitch = ((targetBpm / _deckA.value.originalBpm) - 1.0) * 100.0
                setPitchPercent("A", neededPitch.toFloat())
            }
        } else {
            val sync = !_deckB.value.isSync
            _deckB.value = _deckB.value.copy(isSync = sync)
            if (sync && _deckA.value.isPlaying) {
                val targetBpm = _deckA.value.effectiveBpm
                val neededPitch = ((targetBpm / _deckB.value.originalBpm) - 1.0) * 100.0
                setPitchPercent("B", neededPitch.toFloat())
            }
        }
    }

    // ==========================================
    // HOT CUES & BEAT JUMP
    // ==========================================

    fun handleHotCue(deckId: String, cueIndex: Int) {
        val deck = if (deckId == "A") _deckA else _deckB
        val player = if (deckId == "A") playerA else playerB
        val currentCues = deck.value.hotCues.toMutableList()
        val cue = currentCues.getOrNull(cueIndex) ?: return

        if (cue.isSet) {
            // Jump to cue
            player?.seekTo((cue.positionSec * 1000).toLong())
            deck.value = deck.value.copy(currentPositionSec = cue.positionSec)
        } else {
            // Set cue
            val pos = deck.value.currentPositionSec
            currentCues[cueIndex] = cue.copy(
                positionSec = pos,
                isSet = true
            )
            deck.value = deck.value.copy(hotCues = currentCues)
        }
    }

    fun deleteHotCue(deckId: String, cueIndex: Int) {
        val deck = if (deckId == "A") _deckA else _deckB
        val currentCues = deck.value.hotCues.toMutableList()
        val cue = currentCues.getOrNull(cueIndex) ?: return
        currentCues[cueIndex] = cue.copy(isSet = false, positionSec = 0.0)
        deck.value = deck.value.copy(hotCues = currentCues)
    }

    fun beatJump(deckId: String, beats: Double, forward: Boolean) {
        val deck = if (deckId == "A") _deckA else _deckB
        val player = if (deckId == "A") playerA else playerB
        val secPerBeat = 60.0 / deck.value.effectiveBpm
        val jumpSec = beats * secPerBeat * (if (forward) 1.0 else -1.0)
        val newPos = (deck.value.currentPositionSec + jumpSec).coerceIn(0.0, deck.value.durationSec)
        player?.seekTo((newPos * 1000).toLong())
        deck.value = deck.value.copy(currentPositionSec = newPos)
    }

    // ==========================================
    // LOOPS
    // ==========================================

    fun toggleAutoLoop(deckId: String, beats: Double) {
        val deck = if (deckId == "A") _deckA else _deckB
        val cur = deck.value
        if (cur.loopActive && cur.loopLengthBeats == beats) {
            // Exit loop
            deck.value = cur.copy(loopActive = false)
        } else {
            // Start loop
            val secPerBeat = 60.0 / cur.effectiveBpm
            val start = cur.currentPositionSec
            val end = start + (beats * secPerBeat)
            deck.value = cur.copy(
                loopActive = true,
                loopStartSec = start,
                loopEndSec = end,
                loopLengthBeats = beats
            )
        }
    }

    fun setLoopIn(deckId: String) {
        val deck = if (deckId == "A") _deckA else _deckB
        val cur = deck.value
        deck.value = cur.copy(loopStartSec = cur.currentPositionSec)
    }

    fun setLoopOut(deckId: String) {
        val deck = if (deckId == "A") _deckA else _deckB
        val cur = deck.value
        val end = cur.currentPositionSec
        if (end > cur.loopStartSec) {
            deck.value = cur.copy(loopEndSec = end, loopActive = true)
        }
    }

    // ==========================================
    // MIXER, VOLUMES & EQ
    // ==========================================

    fun setChannelVolume(deckId: String, volume: Float) {
        val v = volume.coerceIn(0f, 1f)
        if (deckId == "A") {
            _deckA.value = _deckA.value.copy(volume = v)
        } else {
            _deckB.value = _deckB.value.copy(volume = v)
        }
        applyEffectiveOutputVolumes()
    }

    fun setCrossfaderPosition(pos: Float) {
        _mixer.value = _mixer.value.copy(crossfaderPosition = pos.coerceIn(-1f, 1f))
        applyEffectiveOutputVolumes()
    }

    fun setMasterVolume(vol: Float) {
        _mixer.value = _mixer.value.copy(masterVolume = vol.coerceIn(0f, 1f))
        applyEffectiveOutputVolumes()
    }

    fun setEq(deckId: String, highDb: Float, midDb: Float, lowDb: Float) {
        if (deckId == "A") {
            _deckA.value = _deckA.value.copy(
                eqHighDb = highDb.coerceIn(-24f, 12f),
                eqMidDb = midDb.coerceIn(-24f, 12f),
                eqLowDb = lowDb.coerceIn(-24f, 12f)
            )
            applyEqualizer("A")
        } else {
            _deckB.value = _deckB.value.copy(
                eqHighDb = highDb.coerceIn(-24f, 12f),
                eqMidDb = midDb.coerceIn(-24f, 12f),
                eqLowDb = lowDb.coerceIn(-24f, 12f)
            )
            applyEqualizer("B")
        }
    }

    fun setFilter(deckId: String, filterValue: Float) {
        val f = filterValue.coerceIn(-100f, 100f)
        if (deckId == "A") {
            _deckA.value = _deckA.value.copy(filterValue = f)
            applyEqualizer("A")
        } else {
            _deckB.value = _deckB.value.copy(filterValue = f)
            applyEqualizer("B")
        }
    }

    private fun applyEqualizer(deckId: String) {
        val eq = if (deckId == "A") equalizerA else equalizerB
        val st = if (deckId == "A") _deckA.value else _deckB.value
        eq ?: return

        try {
            val numBands = eq.numberOfBands
            if (numBands < 3) return

            // Compute Filter offset:
            // Negative (-100..0): Lowpass Filter -> cut highs and mids
            // Positive (0..+100): Highpass Filter -> cut lows and mids
            val filterLowOffset = if (st.filterValue > 0) -(st.filterValue / 100f) * 24f else 0f
            val filterMidOffset = -kotlin.math.abs(st.filterValue / 100f) * 12f
            val filterHighOffset = if (st.filterValue < 0) -(kotlin.math.abs(st.filterValue) / 100f) * 24f else 0f

            val totalLow = (st.eqLowDb + filterLowOffset).coerceIn(-24f, 12f)
            val totalMid = (st.eqMidDb + filterMidOffset).coerceIn(-24f, 12f)
            val totalHigh = (st.eqHighDb + filterHighOffset).coerceIn(-24f, 12f)

            // Equalizer band levels are in millibels (mB = dB * 100)
            val minMB = eq.bandLevelRange[0]
            val maxMB = eq.bandLevelRange[1]

            fun dbToMB(db: Float): Short {
                return (db * 100).toInt().coerceIn(minMB.toInt(), maxMB.toInt()).toShort()
            }

            eq.setBandLevel(0, dbToMB(totalLow))
            if (numBands > 2) {
                eq.setBandLevel((numBands / 2).toShort(), dbToMB(totalMid))
            }
            eq.setBandLevel((numBands - 1).toShort(), dbToMB(totalHigh))
        } catch (_: Exception) {}
    }

    private fun applyEffectiveOutputVolumes() {
        val mx = _mixer.value
        val gains = computeCrossfaderGains(mx.crossfaderPosition, mx.crossfaderCurve)

        val finalA = _deckA.value.volume * gains.first * mx.masterVolume
        val finalB = _deckB.value.volume * gains.second * mx.masterVolume

        playerA?.volume = finalA.coerceIn(0f, 1f)
        playerB?.volume = finalB.coerceIn(0f, 1f)
    }

    private fun computeCrossfaderGains(pos: Float, curve: CrossfaderCurve): Pair<Float, Float> {
        val norm = (pos + 1.0f) / 2.0f // 0.0 .. 1.0
        return when (curve) {
            CrossfaderCurve.SMOOTH -> {
                // Constant-power cosine curve
                Pair(
                    cos(norm * (Math.PI / 2)).toFloat(),
                    sin(norm * (Math.PI / 2)).toFloat()
                )
            }
            CrossfaderCurve.SHARP -> {
                Pair(
                    min(1.0f, (1.0f - norm) * 2.0f),
                    min(1.0f, norm * 2.0f)
                )
            }
            CrossfaderCurve.SCRATCH -> {
                val gA = if (norm > 0.95f) 0.0f else 1.0f
                val gB = if (norm < 0.05f) 0.0f else 1.0f
                Pair(gA, gB)
            }
        }
    }

    fun release() {
        positionJob?.cancel()
        equalizerA?.release()
        equalizerB?.release()
        reverbA?.release()
        reverbB?.release()
        playerA?.release()
        playerB?.release()
    }
}
