package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.*
import com.djbrayan.djbtouchdisplay.core.audio.*
import com.djbrayan.djbtouchdisplay.core.storage.AndroidStorageVolumeDescriptor
import com.djbrayan.djbtouchdisplay.core.waveform.AndroidWaveformEngine
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

/**
 * Main Central Workspace Views — Faithful Migration of src/App.tsx views:
 * VIEW 1: DECKS (Turntables Platter)
 * VIEW 2: WAVEFORMS (Stacked Parallel HD Waveforms)
 * VIEW 3: MIXER_EQ (5 Vertical Faders per Deck + Gain)
 * VIEW 4: LOOPS_HOTCUES (Loop Bar + 8 Hot Cues per Deck)
 * VIEW 5: FX (Dual X/Y Touch Pads + 10 DSP Effects)
 * VIEW 6: PERFORMANCE PADS (Hot Cues, Beat Jump, Sampler)
 * VIEW 7: LIBRARY (Real Device Storage & Files - No Dummy Tracks)
 * VIEW 8: SETTINGS (Audio, MIDI & System)
 */

// ============================================================================
// VIEW 1: DECKS (TURNTABLE PLATTERS + TEMPO FADERS + CENTER RACK)
// ============================================================================
@Composable
fun DecksWorkspaceView(
    deckA: DeckState,
    deckB: DeckState,
    activeSection: MainSection,
    onSelectSection: (MainSection) -> Unit,
    masterVu: MasterVuMeterState,
    waveformEngine: AndroidWaveformEngine,
    onChangePitchA: (Float) -> Unit,
    onChangePitchB: (Float) -> Unit,
    onNudgeA: (Float) -> Unit,
    onNudgeB: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    var beatGridEditorOpen by remember { mutableStateOf(false) }
    var beatGridEditDeck by remember { mutableStateOf("A") }
    val gridResA by waveformEngine.gridResolutionA.collectAsState()
    val gridResB by waveformEngine.gridResolutionB.collectAsState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        // --- Top-Left Circular Waveform Toggle & Grid Editor Cluster ---
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(top = 4.dp, start = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Waveform Toggle
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(Color(0xFF25282F), CircleShape)
                    .border(1.dp, Color(0xFF525761), CircleShape)
                    .clickable { onSelectSection(MainSection.WAVEFORMS) },
                contentAlignment = Alignment.Center
            ) {
                Text("∿", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }

            // Grid Editor Button
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(if (beatGridEditorOpen) Color(0xFF3A3E46) else Color(0xFF25282F), CircleShape)
                    .border(1.dp, if (beatGridEditorOpen) DjbColors.Cyan else Color(0xFF525761), CircleShape)
                    .clickable { beatGridEditorOpen = !beatGridEditorOpen },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "GRID",
                    color = if (beatGridEditorOpen) DjbColors.Cyan else Color.White,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            // Expandable Grid Tools
            if (beatGridEditorOpen) {
                Row(
                    modifier = Modifier
                        .background(Color(0xE615171B), RoundedCornerShape(20.dp))
                        .border(1.dp, Color(0xFF383D47), RoundedCornerShape(20.dp))
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(DjbColors.Cyan, CircleShape)
                            .clickable { beatGridEditDeck = if (beatGridEditDeck == "A") "B" else "A" },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(beatGridEditDeck, color = Color(0xFF0B0C0E), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(Color(0xFF25282F), CircleShape)
                            .clickable { waveformEngine.shiftGrid(beatGridEditDeck, -0.012f) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("◄", color = Color.White, fontSize = 10.sp)
                    }
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(Color(0xFF25282F), CircleShape)
                            .clickable { waveformEngine.shiftGrid(beatGridEditDeck, 0.012f) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("►", color = Color.White, fontSize = 10.sp)
                    }
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(Color(0xFF25282F), CircleShape)
                            .clickable { waveformEngine.cycleGridResolution(beatGridEditDeck) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            if (beatGridEditDeck == "A") "${gridResA.toInt()}x" else "${gridResB.toInt()}x",
                            color = DjbColors.Cyan,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(Color(0xFF25282F), CircleShape)
                            .clickable { waveformEngine.resetGrid(beatGridEditDeck) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("RST", color = DjbColors.TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // --- Top-Right Settings Gear Button ---
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 4.dp, end = 4.dp)
                .size(40.dp)
                .background(Color(0xFF25282F), CircleShape)
                .border(1.dp, Color(0xFF525761), CircleShape)
                .clickable { onSelectSection(MainSection.SETTINGS) },
            contentAlignment = Alignment.Center
        ) {
            Text("⚙", color = Color.White, fontSize = 18.sp)
        }

        // --- Main Horizontal Layout: Pitch A | Platter A | Center Rack | Platter B | Pitch B ---
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Deck A TEMPO Fader
            VerticalFader(
                label = "%+.1f%%".format(deckA.pitchPercent),
                value = deckA.pitchPercent,
                min = -deckA.pitchRange.toFloat(),
                max = deckA.pitchRange.toFloat(),
                defaultValue = 0f,
                capStyle = "tempo",
                bottomCaption = "TEMPO",
                onChange = onChangePitchA
            )

            // Platter A
            TurntablePlatter(
                deckId = "A",
                angleDeg = deckA.jogAngleDeg,
                isPlaying = deckA.isPlaying,
                onNudge = onNudgeA,
                modifier = Modifier.weight(1f)
            )

            // Center Rack Column
            CenterRackColumn(
                activeSection = activeSection,
                onSelectSection = onSelectSection,
                masterVu = masterVu,
                musicalKeyLabel = deckB.key
            )

            // Platter B
            TurntablePlatter(
                deckId = "B",
                angleDeg = deckB.jogAngleDeg,
                isPlaying = deckB.isPlaying,
                onNudge = onNudgeB,
                modifier = Modifier.weight(1f)
            )

            // Deck B TEMPO Fader
            VerticalFader(
                label = "%+.1f%%".format(deckB.pitchPercent),
                value = deckB.pitchPercent,
                min = -deckB.pitchRange.toFloat(),
                max = deckB.pitchRange.toFloat(),
                defaultValue = 0f,
                capStyle = "tempo",
                bottomCaption = "TEMPO",
                onChange = onChangePitchB
            )
        }
    }
}

// ============================================================================
// VIEW 2: WAVEFORMS (STACKED PARALLEL SCROLLING HD WAVEFORMS)
// ============================================================================
@Composable
fun WaveformsWorkspaceView(
    deckA: DeckState,
    deckB: DeckState,
    peaksA: FloatArray,
    peaksB: FloatArray,
    waveformEngine: AndroidWaveformEngine,
    onReturnToDecks: () -> Unit,
    onSeekA: (Float) -> Unit,
    onSeekB: (Float) -> Unit,
    onNudgeA: (Float) -> Unit,
    onNudgeB: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    val zoom by waveformEngine.zoom.collectAsState()
    val showBeatgrid by waveformEngine.showBeatgrid.collectAsState()
    val offsetA by waveformEngine.gridOffsetA.collectAsState()
    val offsetB by waveformEngine.gridOffsetB.collectAsState()
    val resA by waveformEngine.gridResolutionA.collectAsState()
    val resB by waveformEngine.gridResolutionB.collectAsState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF181A1E))
    ) {
        // Upper Half: Deck A
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.5f)
                .align(Alignment.TopCenter)
        ) {
            ScrollingWaveformHD(
                peaks = peaksA,
                positionSec = deckA.positionSec,
                durationSec = deckA.durationSec,
                bpm = deckA.currentBpm,
                zoom = zoom,
                showBeatgrid = showBeatgrid,
                gridOffsetSec = offsetA,
                gridResolutionMultiplier = resA,
                hotCues = deckA.hotCues,
                loop = deckA.loop,
                cuePointSec = 0f,
                accentColor = DjbColors.Cyan,
                onSeek = onSeekA,
                onNudge = onNudgeA
            )
        }

        // Lower Half: Deck B
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.5f)
                .align(Alignment.BottomCenter)
        ) {
            ScrollingWaveformHD(
                peaks = peaksB,
                positionSec = deckB.positionSec,
                durationSec = deckB.durationSec,
                bpm = deckB.currentBpm,
                zoom = zoom,
                showBeatgrid = showBeatgrid,
                gridOffsetSec = offsetB,
                gridResolutionMultiplier = resB,
                hotCues = deckB.hotCues,
                loop = deckB.loop,
                cuePointSec = 0f,
                accentColor = DjbColors.Cyan,
                onSeek = onSeekB,
                onNudge = onNudgeB
            )
        }

        // Center Zoom (−) and (+) Overlay Buttons
        Row(
            modifier = Modifier
                .align(Alignment.Center)
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(40.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(Color(0x99000000), RoundedCornerShape(6.dp))
                    .border(1.dp, Color(0xFF525761), RoundedCornerShape(6.dp))
                    .clickable { waveformEngine.zoomOut() },
                contentAlignment = Alignment.Center
            ) {
                Text("−", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(Color(0x99000000), RoundedCornerShape(6.dp))
                    .border(1.dp, Color(0xFF525761), RoundedCornerShape(6.dp))
                    .clickable { waveformEngine.zoomIn() },
                contentAlignment = Alignment.Center
            ) {
                Text("+", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
        }

        // Top-Left Controls: Return to Decks & Beatgrid Toggle
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(Color(0xFF3A3E47), CircleShape)
                    .border(1.dp, Color.White, CircleShape)
                    .clickable { onReturnToDecks() },
                contentAlignment = Alignment.Center
            ) {
                Text("∿", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(if (showBeatgrid) Color(0xFF22262E) else Color(0xFF1D2026), CircleShape)
                    .border(1.dp, if (showBeatgrid) DjbColors.Cyan else Color(0xFF4B505A), CircleShape)
                    .clickable { waveformEngine.toggleBeatgrid() },
                contentAlignment = Alignment.Center
            ) {
                Text("|ılı|", color = if (showBeatgrid) Color.White else DjbColors.TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ============================================================================
// VIEW 3: MIXER / EQ (5 VERTICAL FADERS PER DECK + GAIN KNOBS + CENTER RACK)
// ============================================================================
@Composable
fun MixerEqWorkspaceView(
    deckA: DeckState,
    deckB: DeckState,
    activeSection: MainSection,
    onSelectSection: (MainSection) -> Unit,
    masterVu: MasterVuMeterState,
    onChangeGainA: (Float) -> Unit,
    onChangeVolA: (Float) -> Unit,
    onChangeLowA: (Float) -> Unit,
    onChangeMidA: (Float) -> Unit,
    onChangeHiA: (Float) -> Unit,
    onChangeFilterA: (Float) -> Unit,
    onTogglePflA: () -> Unit,
    onChangeGainB: (Float) -> Unit,
    onChangeVolB: (Float) -> Unit,
    onChangeLowB: (Float) -> Unit,
    onChangeMidB: (Float) -> Unit,
    onChangeHiB: (Float) -> Unit,
    onChangeFilterB: (Float) -> Unit,
    onTogglePflB: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Deck A 5 Vertical Faders (VOL, LOW, MID, HI, FLT) + GAIN
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TouchKnob(label = "GAIN", value = deckA.eq.gain, min = 0f, max = 100f, defaultValue = 80f, onChange = onChangeGainA)
                Spacer(modifier = Modifier.width(12.dp))
                Box(
                    modifier = Modifier
                        .height(30.dp)
                        .background(if (deckA.pflHeadphoneCue) DjbColors.Cyan else Color(0xFF25282F), RoundedCornerShape(4.dp))
                        .border(1.dp, if (deckA.pflHeadphoneCue) DjbColors.CyanBright else Color(0xFF525761), RoundedCornerShape(4.dp))
                        .clickable { onTogglePflA() }
                        .padding(horizontal = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("PFL A", color = if (deckA.pflHeadphoneCue) Color(0xFF0B0C0E) else Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                VerticalFader("VOL", deckA.volumeFader, 0f, 100f, 85f, "light", null, onChangeVolA)
                VerticalFader("LOW", deckA.eq.low, -12f, 12f, 0f, "light", null, onChangeLowA)
                VerticalFader("MID", deckA.eq.mid, -12f, 12f, 0f, "light", null, onChangeMidA)
                VerticalFader("HI", deckA.eq.high, -12f, 12f, 0f, "light", null, onChangeHiA)
                VerticalFader("FLT.", deckA.eq.filter, -100f, 100f, 0f, "dark", null, onChangeFilterA)
            }
        }

        // Center Rack Column
        CenterRackColumn(
            activeSection = activeSection,
            onSelectSection = onSelectSection,
            masterVu = masterVu,
            musicalKeyLabel = deckB.key
        )

        // Deck B 5 Vertical Faders (FLT, LOW, MID, HI, VOL) + GAIN
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .height(30.dp)
                        .background(if (deckB.pflHeadphoneCue) DjbColors.Cyan else Color(0xFF25282F), RoundedCornerShape(4.dp))
                        .border(1.dp, if (deckB.pflHeadphoneCue) DjbColors.CyanBright else Color(0xFF525761), RoundedCornerShape(4.dp))
                        .clickable { onTogglePflB() }
                        .padding(horizontal = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("PFL B", color = if (deckB.pflHeadphoneCue) Color(0xFF0B0C0E) else Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.width(12.dp))
                TouchKnob(label = "GAIN", value = deckB.eq.gain, min = 0f, max = 100f, defaultValue = 80f, onChange = onChangeGainB)
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                VerticalFader("FLT.", deckB.eq.filter, -100f, 100f, 0f, "dark", null, onChangeFilterB)
                VerticalFader("LOW", deckB.eq.low, -12f, 12f, 0f, "light", null, onChangeLowB)
                VerticalFader("MID", deckB.eq.mid, -12f, 12f, 0f, "light", null, onChangeMidB)
                VerticalFader("HI", deckB.eq.high, -12f, 12f, 0f, "light", null, onChangeHiB)
                VerticalFader("VOL", deckB.volumeFader, 0f, 100f, 85f, "light", null, onChangeVolB)
            }
        }
    }
}

// ============================================================================
// VIEW 4: LOOPS & HOT CUES (LOOP CONTROLS + 8 CUES PER DECK)
// ============================================================================
@Composable
fun LoopsCuesWorkspaceView(
    deckA: DeckState,
    deckB: DeckState,
    activeSection: MainSection,
    onSelectSection: (MainSection) -> Unit,
    masterVu: MasterVuMeterState,
    onToggleLoopA: () -> Unit,
    onToggleLoopB: () -> Unit,
    onStepLoopA: (Int) -> Unit,
    onStepLoopB: (Int) -> Unit,
    onTriggerCueA: (Int, Boolean) -> Unit,
    onTriggerCueB: (Int, Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    var clearCueA by remember { mutableStateOf(false) }
    var clearCueB by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Deck A Panel
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(if (clearCueA) Color(0xFF991B1B) else Color(0xFF262930), RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFF454A54), RoundedCornerShape(4.dp))
                        .clickable { clearCueA = !clearCueA },
                    contentAlignment = Alignment.Center
                ) {
                    Text("X", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Loop Bar A
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .background(Color(0xFF565B63), RoundedCornerShape(6.dp))
                        .clickable { onStepLoopA(-1) },
                    contentAlignment = Alignment.Center
                ) {
                    Text("◄", color = Color.White, fontSize = 16.sp)
                }
                Spacer(modifier = Modifier.width(10.dp))
                Box(
                    modifier = Modifier
                        .height(46.dp)
                        .width(90.dp)
                        .background(if (deckA.loop.active) DjbColors.Cyan else Color(0xFF565B63), RoundedCornerShape(6.dp))
                        .clickable { onToggleLoopA() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "${deckA.loop.lengthBeats.toInt()}B",
                        color = if (deckA.loop.active) Color(0xFF0B0C0E) else Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .background(Color(0xFF565B63), RoundedCornerShape(6.dp))
                        .clickable { onStepLoopA(1) },
                    contentAlignment = Alignment.Center
                ) {
                    Text("►", color = Color.White, fontSize = 16.sp)
                }
            }

            // 8 Hot Cue Pads Grid (2x4)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    (1..4).forEach { idx ->
                        HotCuePad(cue = deckA.hotCues[idx - 1], onClick = { onTriggerCueA(idx, clearCueA) }, modifier = Modifier.weight(1f))
                    }
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    (5..8).forEach { idx ->
                        HotCuePad(cue = deckA.hotCues[idx - 1], onClick = { onTriggerCueA(idx, clearCueA) }, modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        // Center Rack
        CenterRackColumn(
            activeSection = activeSection,
            onSelectSection = onSelectSection,
            masterVu = masterVu,
            musicalKeyLabel = deckB.key
        )

        // Deck B Panel
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(if (clearCueB) Color(0xFF991B1B) else Color(0xFF262930), RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFF454A54), RoundedCornerShape(4.dp))
                        .clickable { clearCueB = !clearCueB },
                    contentAlignment = Alignment.Center
                ) {
                    Text("X", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Loop Bar B
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .background(Color(0xFF565B63), RoundedCornerShape(6.dp))
                        .clickable { onStepLoopB(-1) },
                    contentAlignment = Alignment.Center
                ) {
                    Text("◄", color = Color.White, fontSize = 16.sp)
                }
                Spacer(modifier = Modifier.width(10.dp))
                Box(
                    modifier = Modifier
                        .height(46.dp)
                        .width(90.dp)
                        .background(if (deckB.loop.active) DjbColors.Cyan else Color(0xFF565B63), RoundedCornerShape(6.dp))
                        .clickable { onToggleLoopB() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "${deckB.loop.lengthBeats.toInt()}B",
                        color = if (deckB.loop.active) Color(0xFF0B0C0E) else Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .background(Color(0xFF565B63), RoundedCornerShape(6.dp))
                        .clickable { onStepLoopB(1) },
                    contentAlignment = Alignment.Center
                ) {
                    Text("►", color = Color.White, fontSize = 16.sp)
                }
            }

            // 8 Hot Cue Pads Grid (2x4)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    (1..4).forEach { idx ->
                        HotCuePad(cue = deckB.hotCues[idx - 1], onClick = { onTriggerCueB(idx, clearCueB) }, modifier = Modifier.weight(1f))
                    }
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    (5..8).forEach { idx ->
                        HotCuePad(cue = deckB.hotCues[idx - 1], onClick = { onTriggerCueB(idx, clearCueB) }, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
fun HotCuePad(
    cue: HotCueSlot,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(46.dp)
            .background(if (cue.active) Color(0xFF5E646E) else Color(0xFF4E535B), RoundedCornerShape(4.dp))
            .border(1.dp, if (cue.active) DjbColors.Cyan else Color(0xFF3E4249), RoundedCornerShape(4.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${cue.index}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            if (cue.active && cue.positionSec != null) {
                Text(
                    formatTimeCode(cue.positionSec).slice(0..3),
                    color = DjbColors.Cyan,
                    fontSize = 8.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

// ============================================================================
// VIEW 5: FX (DUAL X/Y TOUCH PADS + 10 DSP EFFECTS + PADLOCK LOCK)
// ============================================================================
@Composable
fun FxWorkspaceView(
    effectsEngine: AndroidEffectsEngine,
    activeSection: MainSection,
    onSelectSection: (MainSection) -> Unit,
    masterVu: MasterVuMeterState,
    modifier: Modifier = Modifier
) {
    val slotA by effectsEngine.slotA.collectAsState()
    val slotB by effectsEngine.slotB.collectAsState()
    val coordA by effectsEngine.padCoordA.collectAsState()
    val coordB by effectsEngine.padCoordB.collectAsState()
    val lockA by effectsEngine.lockA.collectAsState()
    val lockB by effectsEngine.lockB.collectAsState()

    var dropdownOpenA by remember { mutableStateOf(false) }
    var dropdownOpenB by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left FX Unit (Deck A)
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Header Bar with Dropdown & Padlock
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(40.dp)
                    .background(Color(0xFF25282F), RoundedCornerShape(4.dp))
                    .border(1.dp, Color(0xFF454A54), RoundedCornerShape(4.dp)),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Effect Name Dropdown Button
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable { dropdownOpenA = !dropdownOpenA }
                        .padding(horizontal = 10.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text(
                        FX_OPTIONS.firstOrNull { it.value == slotA.name }?.label ?: slotA.name,
                        color = DjbColors.Cyan,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Padlock Lock Button
                Box(
                    modifier = Modifier
                        .width(44.dp)
                        .fillMaxHeight()
                        .background(if (lockA) DjbColors.Cyan else Color.Transparent)
                        .border(width = 1.dp, color = Color(0xFF454A54))
                        .clickable { effectsEngine.toggleLock("A") },
                    contentAlignment = Alignment.Center
                ) {
                    Text(if (lockA) "🔒" else "🔓", fontSize = 14.sp)
                }
            }

            // Dropdown Menu A
            DropdownMenu(expanded = dropdownOpenA, onDismissRequest = { dropdownOpenA = false }) {
                FX_OPTIONS.forEach { opt ->
                    DropdownMenuItem(
                        text = { Text(opt.label) },
                        onClick = {
                            effectsEngine.setEffectName("A", opt.value)
                            dropdownOpenA = false
                        }
                    )
                }
            }

            // 2D Touch Pad A
            XyTouchPad(
                x = coordA.first,
                y = coordA.second,
                active = slotA.active,
                effectName = slotA.name,
                depth = slotA.wetDry,
                accentColor = DjbColors.Cyan,
                onUpdate = { x, y, down -> effectsEngine.updatePad("A", x, y, down) },
                modifier = Modifier.weight(1f)
            )
        }

        // Center Rack
        CenterRackColumn(
            activeSection = activeSection,
            onSelectSection = onSelectSection,
            masterVu = masterVu,
            musicalKeyLabel = "--"
        )

        // Right FX Unit (Deck B)
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Header Bar with Dropdown & Padlock
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(40.dp)
                    .background(Color(0xFF25282F), RoundedCornerShape(4.dp))
                    .border(1.dp, Color(0xFF454A54), RoundedCornerShape(4.dp)),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Padlock Lock Button B
                Box(
                    modifier = Modifier
                        .width(44.dp)
                        .fillMaxHeight()
                        .background(if (lockB) DjbColors.Cyan else Color.Transparent)
                        .border(width = 1.dp, color = Color(0xFF454A54))
                        .clickable { effectsEngine.toggleLock("B") },
                    contentAlignment = Alignment.Center
                ) {
                    Text(if (lockB) "🔒" else "🔓", fontSize = 14.sp)
                }

                // Effect Name Dropdown Button B
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable { dropdownOpenB = !dropdownOpenB }
                        .padding(horizontal = 10.dp),
                    contentAlignment = Alignment.CenterEnd
                ) {
                    Text(
                        FX_OPTIONS.firstOrNull { it.value == slotB.name }?.label ?: slotB.name,
                        color = DjbColors.Cyan,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Dropdown Menu B
            DropdownMenu(expanded = dropdownOpenB, onDismissRequest = { dropdownOpenB = false }) {
                FX_OPTIONS.forEach { opt ->
                    DropdownMenuItem(
                        text = { Text(opt.label) },
                        onClick = {
                            effectsEngine.setEffectName("B", opt.value)
                            dropdownOpenB = false
                        }
                    )
                }
            }

            // 2D Touch Pad B
            XyTouchPad(
                x = coordB.first,
                y = coordB.second,
                active = slotB.active,
                effectName = slotB.name,
                depth = slotB.wetDry,
                accentColor = DjbColors.Cyan,
                onUpdate = { x, y, down -> effectsEngine.updatePad("B", x, y, down) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun XyTouchPad(
    x: Float,
    y: Float,
    active: Boolean,
    effectName: String,
    depth: Float,
    accentColor: Color,
    onUpdate: (Float, Float, Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF0F1115), RoundedCornerShape(6.dp))
            .border(1.dp, Color(0xFF454A54), RoundedCornerShape(6.dp))
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragEnd = { onUpdate(x, y, false) },
                        onDragCancel = { onUpdate(x, y, false) }
                    ) { change, _ ->
                        change.consume()
                        val fx = (change.position.x / size.width.toFloat()).coerceIn(0f, 1f)
                        val fy = (1f - (change.position.y / size.height.toFloat())).coerceIn(0f, 1f)
                        onUpdate(fx, fy, true)
                    }
                }
        ) {
            val width = size.width
            val height = size.height

            // Grid lines
            for (i in 1..3) {
                drawLine(Color(0x1AFFFFFF), Offset(width * (i / 4f), 0f), Offset(width * (i / 4f), height), strokeWidth = 1f)
                drawLine(Color(0x1AFFFFFF), Offset(0f, height * (i / 4f)), Offset(width, height * (i / 4f)), strokeWidth = 1f)
            }

            // Active crosshairs and puck
            if (active) {
                val puckX = x * width
                val puckY = (1f - y) * height

                drawLine(accentColor.copy(alpha = 0.6f), Offset(puckX, 0f), Offset(puckX, height), strokeWidth = 1.5f)
                drawLine(accentColor.copy(alpha = 0.6f), Offset(0f, puckY), Offset(width, puckY), strokeWidth = 1.5f)

                drawCircle(color = accentColor, radius = 10f, center = Offset(puckX, puckY))
                drawCircle(color = Color.White, radius = 10f, center = Offset(puckX, puckY), style = Stroke(width = 2f))
            }
        }

        // Caption at bottom
        Text(
            text = "DEPTH: ${depth.toInt()}% · TIMING: ${(x * 100).toInt()}%",
            color = DjbColors.TextSecondary,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(8.dp)
        )
    }
}
