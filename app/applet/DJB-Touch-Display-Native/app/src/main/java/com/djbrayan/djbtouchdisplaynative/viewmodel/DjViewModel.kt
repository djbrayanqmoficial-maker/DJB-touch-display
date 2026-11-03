package com.djbrayan.djbtouchdisplaynative.viewmodel

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.djbrayan.djbtouchdisplaynative.audio.NativeAudioEngine
import com.djbrayan.djbtouchdisplaynative.audio.NativeEffectsEngine
import com.djbrayan.djbtouchdisplaynative.audio.NativeSamplerEngine
import com.djbrayan.djbtouchdisplaynative.midi.MidiEventListener
import com.djbrayan.djbtouchdisplaynative.midi.NativeMidiEngine
import com.djbrayan.djbtouchdisplaynative.model.CrossfaderCurve
import com.djbrayan.djbtouchdisplaynative.model.MainSection
import com.djbrayan.djbtouchdisplaynative.model.OperatingMode
import com.djbrayan.djbtouchdisplaynative.model.PerformancePadPage
import com.djbrayan.djbtouchdisplaynative.model.StoredTrackEntity
import com.djbrayan.djbtouchdisplaynative.storage.NativeStorageManager
import com.djbrayan.djbtouchdisplaynative.waveform.NativeWaveformEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class DjViewModel(application: Application) : AndroidViewModel(application), MidiEventListener {

    val audioEngine = NativeAudioEngine(application)
    val effectsEngine = NativeEffectsEngine()
    val samplerEngine = NativeSamplerEngine(application)
    val waveformEngine = NativeWaveformEngine(application)
    val midiEngine = NativeMidiEngine(application)
    val storageManager = NativeStorageManager(application)

    // Navigation and Operating Mode
    private val _operatingMode = MutableStateFlow(OperatingMode.STANDALONE)
    val operatingMode: StateFlow<OperatingMode> = _operatingMode.asStateFlow()

    private val _activeSection = MutableStateFlow(MainSection.DECKS)
    val activeSection: StateFlow<MainSection> = _activeSection.asStateFlow()

    private val _activePadPage = MutableStateFlow(PerformancePadPage.HOT_CUE)
    val activePadPage: StateFlow<PerformancePadPage> = _activePadPage.asStateFlow()

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()

    // Beat Grid Editor State
    private val _beatGridEditorOpen = MutableStateFlow(false)
    val beatGridEditorOpen: StateFlow<Boolean> = _beatGridEditorOpen.asStateFlow()

    private val _beatGridEditDeck = MutableStateFlow("A")
    val beatGridEditDeck: StateFlow<String> = _beatGridEditDeck.asStateFlow()

    private val _beatGridOffsetA = MutableStateFlow(0.0)
    val beatGridOffsetA: StateFlow<Double> = _beatGridOffsetA.asStateFlow()

    private val _beatGridOffsetB = MutableStateFlow(0.0)
    val beatGridOffsetB: StateFlow<Double> = _beatGridOffsetB.asStateFlow()

    init {
        midiEngine.listener = this
        midiEngine.initialize()

        // Hook real-time BPM and Key analysis from NativeWaveformEngine to DeckState & DSP
        waveformEngine.onAnalysisComplete = { deckId, analyzedBpm, analyzedKey ->
            viewModelScope.launch {
                if (deckId == "A") {
                    val cur = audioEngine.deckA.value
                    audioEngine.setPitchPercent("A", cur.pitchPercent)
                    audioEngine.dspProcessorA.effectiveBpm = analyzedBpm
                } else {
                    val cur = audioEngine.deckB.value
                    audioEngine.setPitchPercent("B", cur.pitchPercent)
                    audioEngine.dspProcessorB.effectiveBpm = analyzedBpm
                }
            }
        }

        viewModelScope.launch {
            storageManager.queryDeviceAudio()
        }
    }

    fun syncDspEffect(deckId: String, slotIndex: Int) {
        val fxUnits = if (deckId == "A") effectsEngine.fxA.value else effectsEngine.fxB.value
        val unit = fxUnits.getOrNull(slotIndex) ?: return
        audioEngine.updateDspEffect(
            deckId = deckId,
            effectType = unit.name,
            isEnabled = unit.isEnabled,
            wetDry = unit.wetDryPercent,
            parameter = unit.parameterPercent,
            beatMultiplier = unit.beatMultiplier
        )
    }

    fun setOperatingMode(mode: OperatingMode) {
        _operatingMode.value = mode
    }

    fun setActiveSection(section: MainSection) {
        _activeSection.value = section
    }

    fun setActivePadPage(page: PerformancePadPage) {
        _activePadPage.value = page
    }

    fun toggleRecording() {
        _isRecording.value = !_isRecording.value
    }

    fun toggleBeatGridEditor() {
        _beatGridEditorOpen.value = !_beatGridEditorOpen.value
    }

    fun setBeatGridEditDeck(deck: String) {
        _beatGridEditDeck.value = deck
    }

    fun shiftBeatGrid(deck: String, deltaSec: Double) {
        if (deck == "A") {
            _beatGridOffsetA.value += deltaSec
        } else {
            _beatGridOffsetB.value += deltaSec
        }
    }

    fun loadTrackIntoDeck(deckId: String, track: StoredTrackEntity) {
        audioEngine.loadTrack(deckId, track)
        waveformEngine.extractWaveform(deckId, track.uri)
    }

    fun registerDocumentUriAndLoad(deckId: String, uri: Uri) {
        viewModelScope.launch {
            val track = storageManager.registerSingleDocumentUri(uri)
            if (track != null) {
                loadTrackIntoDeck(deckId, track)
            }
        }
    }

    fun importCustomSample(deckId: String, slotIndex: Int, uri: Uri, customName: String) {
        samplerEngine.loadCustomSample(deckId, slotIndex, uri, customName)
    }

    // ==========================================
    // MIDI EVENT LISTENER IMPLEMENTATION
    // ==========================================

    override fun onPlayPause(deckId: String) {
        audioEngine.togglePlayPause(deckId)
    }

    override fun onCue(deckId: String) {
        audioEngine.cuePress(deckId)
    }

    override fun onSync(deckId: String) {
        audioEngine.toggleSync(deckId)
    }

    override fun onPfl(deckId: String) {
    }

    override fun onPitchChanged(deckId: String, value: Float) {
        audioEngine.setPitchPercent(deckId, value)
    }

    override fun onJogWheel(deckId: String, delta: Float) {
        audioEngine.pitchBendStep(deckId, delta * 0.1f)
    }

    override fun onVolumeChanged(deckId: String, volume: Float) {
        audioEngine.setChannelVolume(deckId, volume)
    }

    override fun onCrossfaderChanged(position: Float) {
        audioEngine.setCrossfaderPosition(position)
    }

    override fun onMasterVolumeChanged(volume: Float) {
        audioEngine.setMasterVolume(volume)
    }

    override fun onBrowserScroll(delta: Int) {
    }

    override fun onLoadTrack(deckId: String) {
        val tracks = storageManager.tracks.value
        if (tracks.isNotEmpty()) {
            loadTrackIntoDeck(deckId, tracks[0])
        }
    }

    override fun onCleared() {
        super.onCleared()
        audioEngine.release()
        samplerEngine.release()
        midiEngine.closeDevice()
    }
}
