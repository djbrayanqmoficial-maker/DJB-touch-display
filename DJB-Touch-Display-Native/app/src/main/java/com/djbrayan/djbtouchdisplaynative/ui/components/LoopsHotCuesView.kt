package com.djbrayan.djbtouchdisplaynative.ui.components

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
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.model.formatTimeCode
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

val AUTO_LOOP_BEATS = listOf(0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0)

/**
 * DJB Loops & Hot Cues View — Dedicated panel for 8 Hot Cues and quantized Auto Loops.
 * Faithful reproduction of MainSection.LOOPS_HOTCUES.
 */
@Composable
fun LoopsHotCuesView(
    deckA: DeckState,
    deckB: DeckState,
    onHotCueA: (Int) -> Unit,
    onHotCueB: (Int) -> Unit,
    onDeleteHotCueA: (Int) -> Unit,
    onDeleteHotCueB: (Int) -> Unit,
    onAutoLoopA: (Double) -> Unit,
    onAutoLoopB: (Double) -> Unit,
    onLoopInA: () -> Unit,
    onLoopOutA: () -> Unit,
    onLoopInB: () -> Unit,
    onLoopOutB: () -> Unit,
    modifier: Modifier = Modifier
) {
    var deleteModeA by remember { mutableStateOf(false) }
    var deleteModeB by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141619))
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // ==========================================
        // DECK A LOOPS & CUES
        // ==========================================
        SingleDeckLoopsCues(
            deckId = "A",
            deck = deckA,
            deleteMode = deleteModeA,
            onToggleDeleteMode = { deleteModeA = !deleteModeA },
            onHotCue = onHotCueA,
            onDeleteHotCue = onDeleteHotCueA,
            onAutoLoop = onAutoLoopA,
            onLoopIn = onLoopInA,
            onLoopOut = onLoopOutA,
            modifier = Modifier.weight(1f)
        )

        // Divider
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .width(1.dp)
                .background(Color(0xFF2A2E36))
        )

        // ==========================================
        // DECK B LOOPS & CUES (CYAN PALETTE)
        // ==========================================
        SingleDeckLoopsCues(
            deckId = "B",
            deck = deckB,
            deleteMode = deleteModeB,
            onToggleDeleteMode = { deleteModeB = !deleteModeB },
            onHotCue = onHotCueB,
            onDeleteHotCue = onDeleteHotCueB,
            onAutoLoop = onAutoLoopB,
            onLoopIn = onLoopInB,
            onLoopOut = onLoopOutB,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun SingleDeckLoopsCues(
    deckId: String,
    deck: DeckState,
    deleteMode: Boolean,
    onToggleDeleteMode: () -> Unit,
    onHotCue: (Int) -> Unit,
    onDeleteHotCue: (Int) -> Unit,
    onAutoLoop: (Double) -> Unit,
    onLoopIn: () -> Unit,
    onLoopOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "DECK $deckId — 8 HOT CUES",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.Cyan
            )

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(3.dp))
                    .background(if (deleteMode) DjbColors.Red else Color(0xFF25282F))
                    .border(width = 1.dp, color = if (deleteMode) Color.White else DjbColors.Border, shape = RoundedCornerShape(3.dp))
                    .clickable { onToggleDeleteMode() }
                    .padding(horizontal = 8.dp, vertical = 3.dp)
            ) {
                Text(
                    text = if (deleteMode) "CANCEL" else "DELETE CUE",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = if (deleteMode) Color.White else DjbColors.TextSecondary
                )
            }
        }

        // 8 Hot Cue Buttons (2x4 Grid)
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            for (row in 0..1) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    for (col in 0..3) {
                        val cueIdx = (row * 4) + col
                        val cue = deck.hotCues.getOrNull(cueIdx)
                        val isSet = cue?.isSet == true

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(
                                    when {
                                        deleteMode && isSet -> DjbColors.Red.copy(alpha = 0.8f)
                                        isSet -> DjbColors.Cyan
                                        else -> Color(0xFF22252A)
                                    }
                                )
                                .border(
                                    width = 1.dp,
                                    color = if (isSet) Color.White else DjbColors.Border,
                                    shape = RoundedCornerShape(4.dp)
                                )
                                .clickable {
                                    if (deleteMode && isSet) {
                                        onDeleteHotCue(cueIdx)
                                    } else {
                                        onHotCue(cueIdx)
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "CUE ${cueIdx + 1}",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = if (isSet) Color.Black else DjbColors.TextMuted
                                )
                                if (isSet && cue != null) {
                                    Text(
                                        text = formatTimeCode(cue.positionSec),
                                        fontSize = 8.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color.Black
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Auto Loop Section
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = "AUTO BEAT LOOPS",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                AUTO_LOOP_BEATS.forEach { beats ->
                    val isActive = deck.loopActive && deck.loopLengthBeats == beats
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(34.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (isActive) DjbColors.Green else Color(0xFF25282F))
                            .border(width = 1.dp, color = if (isActive) Color.White else DjbColors.Border, shape = RoundedCornerShape(3.dp))
                            .clickable { onAutoLoop(beats) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (beats < 1.0) "1/${(1.0 / beats).toInt()}" else "${beats.toInt()}",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (isActive) Color.Black else Color.White
                        )
                    }
                }
            }

            // Manual In / Out
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(Color(0xFF2E333D))
                        .border(width = 1.dp, color = DjbColors.BorderLight, shape = RoundedCornerShape(3.dp))
                        .clickable { onLoopIn() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "LOOP IN", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(Color(0xFF2E333D))
                        .border(width = 1.dp, color = DjbColors.BorderLight, shape = RoundedCornerShape(3.dp))
                        .clickable { onLoopOut() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "LOOP OUT", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}
