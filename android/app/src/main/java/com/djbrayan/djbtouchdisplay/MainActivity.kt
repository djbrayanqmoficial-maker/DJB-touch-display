package com.djbrayan.djbtouchdisplay

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.*
import com.djbrayan.djbtouchdisplay.core.audio.AndroidAudioEngine
import com.djbrayan.djbtouchdisplay.core.audio.AndroidEffectsEngine
import com.djbrayan.djbtouchdisplay.core.midi.AndroidMidiEngine
import com.djbrayan.djbtouchdisplay.core.midi.MidiActionListener
import com.djbrayan.djbtouchdisplay.core.storage.AndroidStorageManager
import com.djbrayan.djbtouchdisplay.core.waveform.AndroidWaveformEngine
import com.djbrayan.djbtouchdisplay.ui.components.*
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors
import com.djbrayan.djbtouchdisplay.ui.theme.DjbTouchTheme

/**
 * DJB Touch Display — Native Android DJ Console
 * Main Activity (Jetpack Compose Landscape Entry Point)
 * Faithful migration of the full React/TypeScript source of truth (src/App.tsx).
 * Created by DJ Brayan.
 */
class MainActivity : ComponentActivity(), MidiActionListener {

    private lateinit var audioEngine: AndroidAudioEngine
    private lateinit var effectsEngine: AndroidEffectsEngine
    private lateinit var waveformEngine: AndroidWaveformEngine
    private lateinit var midiEngine: AndroidMidiEngine
    private lateinit var storageManager: AndroidStorageManager

    // Real audio files only (NO fake demo songs)
    private val userTracks = mutableStateListOf<StoredTrackEntity>()

    // SAF Audio File Picker (ACTION_OPEN_DOCUMENT) with persistent URI permissions
    private val openAudioLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri?.let {
            try {
                contentResolver.takePersistableUriPermission(
                    it,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Exception) {}
            val newTrack = storageManager.extractMetadata(it)
            if (userTracks.none { t -> t.internalUri == newTrack.internalUri }) {
                userTracks.add(0, newTrack)
            }
        }
    }

    // SAF Audio Folder Picker (ACTION_OPEN_DOCUMENT_TREE) with persistent URI permissions
    private val openFolderLauncher = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri: Uri? ->
        uri?.let { treeUri ->
            try {
                contentResolver.takePersistableUriPermission(
                    treeUri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Exception) {}
            val folderTracks = storageManager.scanDocumentTreeForAudio(treeUri)
            folderTracks.forEach { track ->
                if (userTracks.none { it.internalUri == track.internalUri }) {
                    userTracks.add(track)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize core engines
        audioEngine = AndroidAudioEngine(applicationContext)
        effectsEngine = AndroidEffectsEngine()
        waveformEngine = AndroidWaveformEngine()
        midiEngine = AndroidMidiEngine(applicationContext)
        storageManager = AndroidStorageManager(applicationContext)

        // Bind hardware MIDI events to audio engine
        midiEngine.actionListener = this

        // Query real audio files from device MediaStore storage
        try {
            val deviceFiles = storageManager.queryAllDeviceAudioFiles()
            deviceFiles.forEach { file ->
                userTracks.add(
                    StoredTrackEntity(
                        id = "media-${file.uri.hashCode()}",
                        title = file.title.ifBlank { file.fileName },
                        artist = file.artist.ifBlank { "Unknown Artist" },
                        album = file.album,
                        durationSec = if (file.durationMs > 0) file.durationMs / 1000f else 180f,
                        bpm = 126.0f,
                        musicalKey = "--",
                        format = file.mimeType,
                        internalUri = file.uri
                    )
                )
            }
        } catch (_: Exception) {
        }

        setContent {
            DjbTouchTheme {
                var operatingMode by remember { mutableStateOf(OperatingMode.STANDALONE) }
                var activeSection by remember { mutableStateOf(MainSection.DECKS) }
                var isRecording by remember { mutableStateOf(false) }
                var vinylModeA by remember { mutableStateOf(true) }
                var vinylModeB by remember { mutableStateOf(true) }

                // Collect Reactive Audio State
                val deckA by audioEngine.deckAState.collectAsState()
                val deckB by audioEngine.deckBState.collectAsState()
                val mixerState by audioEngine.mixerState.collectAsState()
                val masterVu by audioEngine.masterVu.collectAsState()

                // Waveform data
                val waveformTrigger by waveformEngine.waveformUpdateTrigger.collectAsState()
                val overviewA = remember(deckA.trackId, waveformTrigger) { waveformEngine.getOverviewPeaks(deckA.trackId, "A") }
                val overviewB = remember(deckB.trackId, waveformTrigger) { waveformEngine.getOverviewPeaks(deckB.trackId, "B") }
                val scrollingA = remember(deckA.trackId, waveformTrigger) { waveformEngine.getScrollingPeaks(deckA.trackId, "A") }
                val scrollingB = remember(deckB.trackId, waveformTrigger) { waveformEngine.getScrollingPeaks(deckB.trackId, "B") }

                // MIDI state
                val lastMidiPacket by midiEngine.lastPacket.collectAsState()
                val midiDevices by midiEngine.devices.collectAsState()
                val activeProfile by midiEngine.activeProfile.collectAsState()
                val midiLearnAction by midiEngine.midiLearnTargetAction.collectAsState()

                // Mounted storage volumes
                val mountedVolumes = remember { storageManager.discoverMountedVolumes() }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DjbColors.Background
                ) {
                    if (operatingMode == OperatingMode.UNSELECTED) {
                        ModeSelectionScreen(onSelectMode = { operatingMode = it })
                    } else {
                        // Main DJ Performance Shell
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(DjbColors.Background)
                        ) {
                            // 1. Persistent Top Deck Header Bar (68dp)
                            TopDeckHeaderBar(
                                deckA = deckA,
                                deckB = deckB,
                                overviewPeaksA = overviewA,
                                overviewPeaksB = overviewB,
                                operatingMode = operatingMode,
                                isRecording = isRecording,
                                vinylModeA = vinylModeA,
                                vinylModeB = vinylModeB,
                                onToggleRecording = { isRecording = !isRecording },
                                onOpenLibraryForDeck = { deckId ->
                                    activeSection = MainSection.LIBRARY
                                },
                                onSeekDeckA = { audioEngine.seek("A", it) },
                                onSeekDeckB = { audioEngine.seek("B", it) },
                                onTogglePflA = { audioEngine.togglePfl("A") },
                                onTogglePflB = { audioEngine.togglePfl("B") },
                                onToggleVinylA = { vinylModeA = !vinylModeA },
                                onToggleVinylB = { vinylModeB = !vinylModeB }
                            )

                            // 2. Discrete Studio View Navigation Bar (28dp)
                            StudioViewNavigationBar(
                                activeSection = activeSection,
                                operatingMode = operatingMode,
                                lastPacket = lastMidiPacket,
                                onSelectSection = { activeSection = it },
                                onOpenModeSelector = { operatingMode = OperatingMode.UNSELECTED }
                            )

                            // 3. Center Workspace Area
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f)
                            ) {
                                when (activeSection) {
                                    MainSection.DECKS -> {
                                        DecksWorkspaceView(
                                            deckA = deckA,
                                            deckB = deckB,
                                            activeSection = activeSection,
                                            onSelectSection = { activeSection = it },
                                            masterVu = masterVu,
                                            waveformEngine = waveformEngine,
                                            onChangePitchA = { audioEngine.setPitchPercent("A", it) },
                                            onChangePitchB = { audioEngine.setPitchPercent("B", it) },
                                            onNudgeA = { audioEngine.nudgeJog("A", it) },
                                            onNudgeB = { audioEngine.nudgeJog("B", it) }
                                        )
                                    }
                                    MainSection.WAVEFORMS -> {
                                        WaveformsWorkspaceView(
                                            deckA = deckA,
                                            deckB = deckB,
                                            peaksA = scrollingA,
                                            peaksB = scrollingB,
                                            waveformEngine = waveformEngine,
                                            onReturnToDecks = { activeSection = MainSection.DECKS },
                                            onSeekA = { audioEngine.seek("A", it) },
                                            onSeekB = { audioEngine.seek("B", it) },
                                            onNudgeA = { audioEngine.nudgeJog("A", it) },
                                            onNudgeB = { audioEngine.nudgeJog("B", it) }
                                        )
                                    }
                                    MainSection.MIXER_EQ -> {
                                        MixerEqWorkspaceView(
                                            deckA = deckA,
                                            deckB = deckB,
                                            activeSection = activeSection,
                                            onSelectSection = { activeSection = it },
                                            masterVu = masterVu,
                                            onChangeGainA = { audioEngine.setEqGain("A", it) },
                                            onChangeVolA = { audioEngine.setVolumeFader("A", it) },
                                            onChangeLowA = { audioEngine.setEqLow("A", it) },
                                            onChangeMidA = { audioEngine.setEqMid("A", it) },
                                            onChangeHiA = { audioEngine.setEqHigh("A", it) },
                                            onChangeFilterA = { audioEngine.setEqFilter("A", it) },
                                            onTogglePflA = { audioEngine.togglePfl("A") },
                                            onChangeGainB = { audioEngine.setEqGain("B", it) },
                                            onChangeVolB = { audioEngine.setVolumeFader("B", it) },
                                            onChangeLowB = { audioEngine.setEqLow("B", it) },
                                            onChangeMidB = { audioEngine.setEqMid("B", it) },
                                            onChangeHiB = { audioEngine.setEqHigh("B", it) },
                                            onChangeFilterB = { audioEngine.setEqFilter("B", it) },
                                            onTogglePflB = { audioEngine.togglePfl("B") }
                                        )
                                    }
                                    MainSection.LOOPS_HOTCUES -> {
                                        LoopsCuesWorkspaceView(
                                            deckA = deckA,
                                            deckB = deckB,
                                            activeSection = activeSection,
                                            onSelectSection = { activeSection = it },
                                            masterVu = masterVu,
                                            onToggleLoopA = { audioEngine.toggleLoop("A") },
                                            onToggleLoopB = { audioEngine.toggleLoop("B") },
                                            onStepLoopA = { audioEngine.stepLoopLength("A", it) },
                                            onStepLoopB = { audioEngine.stepLoopLength("B", it) },
                                            onTriggerCueA = { idx, clear -> audioEngine.triggerHotCue("A", idx, clear) },
                                            onTriggerCueB = { idx, clear -> audioEngine.triggerHotCue("B", idx, clear) }
                                        )
                                    }
                                    MainSection.FX -> {
                                        FxWorkspaceView(
                                            effectsEngine = effectsEngine,
                                            activeSection = activeSection,
                                            onSelectSection = { activeSection = it },
                                            masterVu = masterVu
                                        )
                                    }
                                    MainSection.PERFORMANCE -> {
                                        PerformancePadsWorkspaceView(
                                            deckA = deckA,
                                            deckB = deckB,
                                            onTriggerCueA = { idx, clear -> audioEngine.triggerHotCue("A", idx, clear) },
                                            onTriggerCueB = { idx, clear -> audioEngine.triggerHotCue("B", idx, clear) },
                                            onNudgeA = { audioEngine.nudgeJog("A", it) },
                                            onNudgeB = { audioEngine.nudgeJog("B", it) }
                                        )
                                    }
                                    MainSection.LIBRARY -> {
                                        LibraryPanel(
                                            volumes = mountedVolumes,
                                            tracks = userTracks,
                                            onOpenFilePicker = { openAudioLauncher.launch(arrayOf("audio/*")) },
                                            onOpenFolderPicker = { openFolderLauncher.launch(null) },
                                            onLoadTrackToDeckA = {
                                                audioEngine.loadTrack("A", it)
                                                waveformEngine.analyzeTrackWaveform(applicationContext, it.internalUri, it.id, "A")
                                                activeSection = MainSection.DECKS
                                            },
                                            onLoadTrackToDeckB = {
                                                audioEngine.loadTrack("B", it)
                                                waveformEngine.analyzeTrackWaveform(applicationContext, it.internalUri, it.id, "B")
                                                activeSection = MainSection.DECKS
                                            }
                                        )
                                    }
                                    MainSection.SETTINGS -> {
                                        MidiPanel(
                                            devices = midiDevices,
                                            activeProfile = activeProfile,
                                            lastPacket = lastMidiPacket,
                                            midiLearnAction = midiLearnAction,
                                            onRefreshDevices = { midiEngine.refreshDevices() },
                                            onConnectDevice = { midiEngine.connectDevice(it) },
                                            onDisconnectDevice = { midiEngine.disconnectCurrentDevice() },
                                            onStartLearn = { midiEngine.startMidiLearn(it) },
                                            onCancelLearn = { midiEngine.cancelMidiLearn() }
                                        )
                                    }
                                }
                            }

                            // 4. Persistent Bottom Transport & Crossfader Bar (68dp)
                            BottomTransportBar(
                                deckA = deckA,
                                deckB = deckB,
                                crossfader = mixerState.crossfader,
                                onChangeCrossfader = { audioEngine.setCrossfader(it) },
                                onCueDownA = { audioEngine.cueDown("A") },
                                onCueUpA = { audioEngine.cueUp("A") },
                                onPlayA = { audioEngine.togglePlay("A") },
                                onSyncA = { audioEngine.toggleSync("A") },
                                onCueDownB = { audioEngine.cueDown("B") },
                                onCueUpB = { audioEngine.cueUp("B") },
                                onPlayB = { audioEngine.togglePlay("B") },
                                onSyncB = { audioEngine.toggleSync("B") }
                            )
                        }
                    }
                }
            }
        }
    }

    // --- MidiActionListener Hardware Dispatch ---
    override fun onPlayPause(deckId: String) = audioEngine.togglePlay(if (deckId == "deck-a") "A" else "B")
    override fun onCue(deckId: String) = audioEngine.cueDown(if (deckId == "deck-a") "A" else "B")
    override fun onSync(deckId: String) = audioEngine.toggleSync(if (deckId == "deck-a") "A" else "B")
    override fun onPitchChanged(deckId: String, value: Float) = audioEngine.setPitchPercent(if (deckId == "deck-a") "A" else "B", value)
    override fun onJogNudge(deckId: String, delta: Float) = audioEngine.nudgeJog(if (deckId == "deck-a") "A" else "B", delta)
    override fun onCrossfaderChanged(value: Float) = audioEngine.setCrossfader((value * 200f) - 100f)
    override fun onMasterVolumeChanged(value: Float) = audioEngine.setMasterLevel(value * 100f)
    override fun onHeadphonesCueToggled(deckId: String) = audioEngine.togglePfl(if (deckId == "deck-a") "A" else "B")
    override fun onVolumeChanged(deckId: String, value: Float) = audioEngine.setVolumeFader(if (deckId == "deck-a") "A" else "B", value * 100f)
    override fun onPitchBendStep(deckId: String, stepDelta: Float) = audioEngine.nudgeJog(if (deckId == "deck-a") "A" else "B", stepDelta * 2.5f)

    override fun onDestroy() {
        super.onDestroy()
        audioEngine.release()
        midiEngine.release()
    }
}

/**
 * Discrete Studio View Navigation Bar (28dp) — Migrated from src/App.tsx
 */
@Composable
fun StudioViewNavigationBar(
    activeSection: MainSection,
    operatingMode: OperatingMode,
    lastPacket: com.djbrayan.djbtouchdisplay.core.midi.MidiMessagePacket?,
    onSelectSection: (MainSection) -> Unit,
    onOpenModeSelector: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(28.dp)
            .background(DjbColors.NavigationBg)
            .border(width = 1.dp, color = Color(0xFF2A2E36))
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Section Navigation Buttons
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            MainSection.entries.forEach { section ->
                val active = activeSection == section
                Box(
                    modifier = Modifier
                        .background(
                            if (active) Color(0xFF2E333D) else Color.Transparent,
                            RoundedCornerShape(2.dp)
                        )
                        .clickable { onSelectSection(section) }
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = section.label,
                        color = if (active) DjbColors.Cyan else DjbColors.TextSecondary,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }
        }

        // Right Info: MIDI status and Mode badge
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (lastPacket != null) {
                Text(
                    text = "MIDI CH${lastPacket.channel} D1:${lastPacket.data1} D2:${lastPacket.data2}",
                    color = DjbColors.TextSecondary,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            Text(
                text = if (operatingMode == OperatingMode.VIRTUALDJ) "VIRTUALDJ MODE" else "STANDALONE MODE",
                color = DjbColors.Cyan,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onOpenModeSelector() }
            )
        }
    }
}

/**
 * Operating Mode Selection Screen — Migrated from src/App.tsx
 */
@Composable
fun ModeSelectionScreen(onSelectMode: (OperatingMode) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DjbColors.Background)
            .padding(24.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "DJB TOUCH DISPLAY",
                color = DjbColors.TextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "CREATED BY DJ BRAYAN · NATIVE ANDROID DJ CONSOLE",
                color = DjbColors.Cyan,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(vertical = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            ModeSelectionCard(
                title = "STANDALONE MODE",
                subtitle = "Aplicación DJ independiente completa inspirada en Cross DJ Pro con dos decks, jogwheels táctiles, mezclador, EQ, loops, hot cues y soporte USB MIDI.",
                accentColor = DjbColors.Cyan,
                modifier = Modifier.weight(1f),
                onClick = { onSelectMode(OperatingMode.STANDALONE) }
            )
            ModeSelectionCard(
                title = "VIRTUALDJ MODE",
                subtitle = "Pantalla táctil y controlador preparado para conexión USB y Windows Bridge.",
                accentColor = DjbColors.Orange,
                modifier = Modifier.weight(1f),
                onClick = { onSelectMode(OperatingMode.VIRTUALDJ) }
            )
        }
    }
}

@Composable
fun ModeSelectionCard(
    title: String,
    subtitle: String,
    accentColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(Color(0xFF101317), RoundedCornerShape(12.dp))
            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(24.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(text = title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(10.dp))
            Text(text = subtitle, color = DjbColors.TextSecondary, fontSize = 13.sp, lineHeight = 18.sp)
        }
        Text(
            text = "LAUNCH MODE →",
            color = accentColor,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
