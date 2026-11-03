package com.djbrayan.djbtouchdisplaynative.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.audio.FX_CATALOG
import com.djbrayan.djbtouchdisplaynative.model.MainSection
import com.djbrayan.djbtouchdisplaynative.ui.components.*
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors
import com.djbrayan.djbtouchdisplaynative.viewmodel.DjViewModel

/**
 * DJB Main Screen — Full performance shell integrating Top Header, Discrete Studio Navigation Bar,
 * Active Workspace View, Floating Beat Grid Editor, and Bottom Transport Bar.
 * Faithful reproduction of App.tsx.
 */
@Composable
fun MainDjScreen(
    viewModel: DjViewModel,
    onOpenFilePicker: () -> Unit,
    modifier: Modifier = Modifier
) {
    val deckA by viewModel.audioEngine.deckA.collectAsState()
    val deckB by viewModel.audioEngine.deckB.collectAsState()
    val mixer by viewModel.audioEngine.mixer.collectAsState()
    val waveformA by viewModel.waveformEngine.waveformA.collectAsState()
    val waveformB by viewModel.waveformEngine.waveformB.collectAsState()
    val fxA by viewModel.effectsEngine.fxA.collectAsState()
    val fxB by viewModel.effectsEngine.fxB.collectAsState()
    val samplerA by viewModel.samplerEngine.slotsA.collectAsState()
    val samplerB by viewModel.samplerEngine.slotsB.collectAsState()
    val tracks by viewModel.storageManager.tracks.collectAsState()
    val volumes by viewModel.storageManager.volumes.collectAsState()
    val selectedVolumeId by viewModel.storageManager.selectedVolumeId.collectAsState()

    val operatingMode by viewModel.operatingMode.collectAsState()
    val activeSection by viewModel.activeSection.collectAsState()
    val activePadPage by viewModel.activePadPage.collectAsState()
    val isRecording by viewModel.isRecording.collectAsState()

    val beatGridOpen by viewModel.beatGridEditorOpen.collectAsState()
    val beatGridDeck by viewModel.beatGridEditDeck.collectAsState()
    val connectedMidiDevice by viewModel.midiEngine.connectedDeviceName.collectAsState()
    val lastMidiPacket by viewModel.midiEngine.lastPacket.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF22252A))
    ) {
        // ==========================================
        // PERSISTENT TOP DECK HEADER BAR
        // ==========================================
        TopDeckHeaderBar(
            deckA = deckA,
            deckB = deckB,
            waveformA = waveformA,
            waveformB = waveformB,
            isRecording = isRecording,
            onToggleRecording = { viewModel.toggleRecording() },
            onOpenLibrary = { deckId -> viewModel.setActiveSection(MainSection.LIBRARY) },
            onSeekA = { pos -> viewModel.audioEngine.seekTo("A", pos) },
            onSeekB = { pos -> viewModel.audioEngine.seekTo("B", pos) },
            onToggleVinylA = { },
            onToggleVinylB = { }
        )

        // ==========================================
        // DISCRETE STUDIO VIEW NAVIGATION BAR
        // ==========================================
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(28.dp)
                .background(Color(0xFF15171B))
                .border(width = 1.dp, color = DjbColors.Border)
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                MainSection.values().forEach { sec ->
                    val active = activeSection == sec
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(2.dp))
                            .background(if (active) Color(0xFF2E333D) else Color.Transparent)
                            .clickable { viewModel.setActiveSection(sec) }
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = sec.label,
                            fontSize = 9.sp,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                            fontFamily = FontFamily.Monospace,
                            color = if (active) DjbColors.Cyan else DjbColors.TextSecondary
                        )
                    }
                }
            }

            // System Status / Mode Label
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (connectedMidiDevice != null) {
                    Text(
                        text = "MIDI ACTIVE",
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = DjbColors.Green
                    )
                }
                Text(
                    text = operatingMode.name,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = DjbColors.TextSecondary
                )
            }
        }

        // ==========================================
        // CENTER ACTIVE WORKSPACE AREA
        // ==========================================
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            when (activeSection) {
                MainSection.DECKS -> {
                    DecksView(
                        deckA = deckA,
                        deckB = deckB,
                        mixer = mixer,
                        beatGridOpen = beatGridOpen,
                        onToggleBeatGrid = { viewModel.toggleBeatGridEditor() },
                        onOpenWaveforms = { viewModel.setActiveSection(MainSection.WAVEFORMS) },
                        onOpenMixer = { viewModel.setActiveSection(MainSection.MIXER_EQ) },
                        onScratchA = { delta ->
                            val newPos = (deckA.currentPositionSec + delta).coerceIn(0.0, deckA.durationSec)
                            viewModel.audioEngine.seekTo("A", newPos)
                        },
                        onScratchB = { delta ->
                            val newPos = (deckB.currentPositionSec + delta).coerceIn(0.0, deckB.durationSec)
                            viewModel.audioEngine.seekTo("B", newPos)
                        },
                        onPitchBendA = { dir -> viewModel.audioEngine.pitchBendStep("A", dir) },
                        onPitchBendB = { dir -> viewModel.audioEngine.pitchBendStep("B", dir) },
                        onPitchChangeA = { p -> viewModel.audioEngine.setPitchPercent("A", p) },
                        onPitchChangeB = { p -> viewModel.audioEngine.setPitchPercent("B", p) },
                        onVolumeAChange = { v -> viewModel.audioEngine.setChannelVolume("A", v) },
                        onVolumeBChange = { v -> viewModel.audioEngine.setChannelVolume("B", v) },
                        onFilterAChange = { f -> viewModel.audioEngine.setFilter("A", f) },
                        onFilterBChange = { f -> viewModel.audioEngine.setFilter("B", f) },
                        onMasterChange = { m -> viewModel.audioEngine.setMasterVolume(m) },
                        onCrossfaderChange = { c -> viewModel.audioEngine.setCrossfaderPosition(c) }
                    )

                    // Floating Beat Grid Overlay
                    if (beatGridOpen) {
                        BeatGridEditorOverlay(
                            editDeck = beatGridDeck,
                            onToggleDeck = { viewModel.setBeatGridEditDeck(if (beatGridDeck == "A") "B" else "A") },
                            onShiftBack = { viewModel.shiftBeatGrid(beatGridDeck, -0.012) },
                            onShiftForward = { viewModel.shiftBeatGrid(beatGridDeck, 0.012) },
                            onHalveBpm = {
                                val p = if (beatGridDeck == "A") deckA.pitchPercent else deckB.pitchPercent
                                viewModel.audioEngine.setPitchPercent(beatGridDeck, p * 0.5f)
                            },
                            onDoubleBpm = {
                                val p = if (beatGridDeck == "A") deckA.pitchPercent else deckB.pitchPercent
                                viewModel.audioEngine.setPitchPercent(beatGridDeck, p * 2.0f)
                            },
                            onSetFirstBeat = { },
                            onReset = { viewModel.shiftBeatGrid(beatGridDeck, 0.0) },
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(start = 100.dp, top = 8.dp)
                        )
                    }
                }
                MainSection.WAVEFORMS -> {
                    ParallelWaveformsView(
                        deckA = deckA,
                        deckB = deckB,
                        waveformA = waveformA,
                        waveformB = waveformB,
                        onSeekA = { pos -> viewModel.audioEngine.seekTo("A", pos) },
                        onSeekB = { pos -> viewModel.audioEngine.seekTo("B", pos) }
                    )
                }
                MainSection.MIXER_EQ -> {
                    MixerSectionView(
                        deckA = deckA,
                        deckB = deckB,
                        mixer = mixer,
                        onEqChangeA = { h, m, l -> viewModel.audioEngine.setEq("A", h, m, l) },
                        onEqChangeB = { h, m, l -> viewModel.audioEngine.setEq("B", h, m, l) },
                        onFilterChangeA = { f -> viewModel.audioEngine.setFilter("A", f) },
                        onFilterChangeB = { f -> viewModel.audioEngine.setFilter("B", f) },
                        onVolumeAChange = { v -> viewModel.audioEngine.setChannelVolume("A", v) },
                        onVolumeBChange = { v -> viewModel.audioEngine.setChannelVolume("B", v) },
                        onCrossfaderChange = { c -> viewModel.audioEngine.setCrossfaderPosition(c) },
                        onMasterChange = { m -> viewModel.audioEngine.setMasterVolume(m) }
                    )
                }
                MainSection.LOOPS_HOTCUES -> {
                    LoopsHotCuesView(
                        deckA = deckA,
                        deckB = deckB,
                        onHotCueA = { idx -> viewModel.audioEngine.handleHotCue("A", idx) },
                        onHotCueB = { idx -> viewModel.audioEngine.handleHotCue("B", idx) },
                        onDeleteHotCueA = { idx -> viewModel.audioEngine.deleteHotCue("A", idx) },
                        onDeleteHotCueB = { idx -> viewModel.audioEngine.deleteHotCue("B", idx) },
                        onAutoLoopA = { beats -> viewModel.audioEngine.toggleAutoLoop("A", beats) },
                        onAutoLoopB = { beats -> viewModel.audioEngine.toggleAutoLoop("B", beats) },
                        onLoopInA = { viewModel.audioEngine.setLoopIn("A") },
                        onLoopOutA = { viewModel.audioEngine.setLoopOut("A") },
                        onLoopInB = { viewModel.audioEngine.setLoopIn("B") },
                        onLoopOutB = { viewModel.audioEngine.setLoopOut("B") }
                    )
                }
                MainSection.FX -> {
                    EffectsRackView(
                        fxUnitsA = fxA,
                        fxUnitsB = fxB,
                        onToggleFxA = { idx -> viewModel.effectsEngine.toggleFxSlot("A", idx) },
                        onToggleFxB = { idx -> viewModel.effectsEngine.toggleFxSlot("B", idx) },
                        onCycleEffectA = { idx ->
                            val current = fxA[idx].name
                            val curIdx = FX_CATALOG.indexOfFirst { it.value == current }
                            val nextIdx = (curIdx + 1) % FX_CATALOG.size
                            viewModel.effectsEngine.setFxEffect("A", idx, FX_CATALOG[nextIdx].value)
                        },
                        onCycleEffectB = { idx ->
                            val current = fxB[idx].name
                            val curIdx = FX_CATALOG.indexOfFirst { it.value == current }
                            val nextIdx = (curIdx + 1) % FX_CATALOG.size
                            viewModel.effectsEngine.setFxEffect("B", idx, FX_CATALOG[nextIdx].value)
                        },
                        onWetDryChangeA = { idx, p -> viewModel.effectsEngine.setFxWetDry("A", idx, p) },
                        onWetDryChangeB = { idx, p -> viewModel.effectsEngine.setFxWetDry("B", idx, p) },
                        onParamChangeA = { idx, p -> viewModel.effectsEngine.setFxParameter("A", idx, p) },
                        onParamChangeB = { idx, p -> viewModel.effectsEngine.setFxParameter("B", idx, p) }
                    )
                }
                MainSection.PERFORMANCE -> {
                    PerformancePadsView(
                        deckA = deckA,
                        deckB = deckB,
                        activePage = activePadPage,
                        samplerSlotsA = samplerA,
                        samplerSlotsB = samplerB,
                        onSelectPage = { page -> viewModel.setActivePadPage(page) },
                        onHotCueA = { idx -> viewModel.audioEngine.handleHotCue("A", idx) },
                        onHotCueB = { idx -> viewModel.audioEngine.handleHotCue("B", idx) },
                        onAutoLoopA = { beats -> viewModel.audioEngine.toggleAutoLoop("A", beats) },
                        onAutoLoopB = { beats -> viewModel.audioEngine.toggleAutoLoop("B", beats) },
                        onTriggerSampleA = { idx -> viewModel.samplerEngine.triggerSample("A", idx) },
                        onTriggerSampleB = { idx -> viewModel.samplerEngine.triggerSample("B", idx) },
                        onBeatJumpA = { beats, fwd -> viewModel.audioEngine.beatJump("A", beats, fwd) },
                        onBeatJumpB = { beats, fwd -> viewModel.audioEngine.beatJump("B", beats, fwd) }
                    )
                }
                MainSection.LIBRARY -> {
                    LibraryBrowserView(
                        tracks = tracks,
                        volumes = volumes,
                        selectedVolumeId = selectedVolumeId,
                        onSelectVolume = { vId -> viewModel.storageManager.selectVolume(vId) },
                        onLoadToDeckA = { trk -> viewModel.loadTrackIntoDeck("A", trk) },
                        onLoadToDeckB = { trk -> viewModel.loadTrackIntoDeck("B", trk) },
                        onOpenFilePicker = onOpenFilePicker
                    )
                }
                MainSection.SETTINGS -> {
                    SettingsView(
                        operatingMode = operatingMode,
                        onSelectMode = { m -> viewModel.setOperatingMode(m) },
                        connectedMidiDevice = connectedMidiDevice,
                        lastMidiPacket = lastMidiPacket
                    )
                }
            }
        }

        // ==========================================
        // PERSISTENT BOTTOM TRANSPORT BAR
        // ==========================================
        BottomTransportBar(
            deckA = deckA,
            deckB = deckB,
            crossfaderPos = mixer.crossfaderPosition,
            onPlayPauseA = { viewModel.audioEngine.togglePlayPause("A") },
            onPlayPauseB = { viewModel.audioEngine.togglePlayPause("B") },
            onCueA = { viewModel.audioEngine.cuePress("A") },
            onCueB = { viewModel.audioEngine.cuePress("B") },
            onSyncA = { viewModel.audioEngine.toggleSync("A") },
            onSyncB = { viewModel.audioEngine.toggleSync("B") },
            onPitchBendA = { dir -> viewModel.audioEngine.pitchBendStep("A", dir) },
            onPitchBendB = { dir -> viewModel.audioEngine.pitchBendStep("B", dir) },
            onCrossfaderChange = { pos -> viewModel.audioEngine.setCrossfaderPosition(pos) }
        )
    }
}
