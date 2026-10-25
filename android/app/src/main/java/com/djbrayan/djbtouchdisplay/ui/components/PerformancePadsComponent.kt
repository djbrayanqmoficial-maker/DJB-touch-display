package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.DeckState
import com.djbrayan.djbtouchdisplay.core.PerformancePadPageId
import com.djbrayan.djbtouchdisplay.core.formatTimeCode
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

/**
 * Performance Pads View — Migrated with 100% fidelity from PerformancePadsView.tsx
 * 8 multi-function pads per deck with page selector: HOT CUES, BEAT JUMP, SAMPLER.
 * Note: STEMS remain permanently disabled per architecture specification.
 */
@Composable
fun PerformancePadsWorkspaceView(
    deckA: DeckState,
    deckB: DeckState,
    onTriggerCueA: (Int, Boolean) -> Unit,
    onTriggerCueB: (Int, Boolean) -> Unit,
    onNudgeA: (Float) -> Unit,
    onNudgeB: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    var pageA by remember { mutableStateOf(PerformancePadPageId.HOT_CUES) }
    var pageB by remember { mutableStateOf(PerformancePadPageId.HOT_CUES) }
    var clearCueA by remember { mutableStateOf(false) }
    var clearCueB by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // --- DECK A PADS UNIT ---
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Page Selector Tabs Deck A
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf(
                        PerformancePadPageId.HOT_CUES to "HOT CUES",
                        PerformancePadPageId.BEAT_JUMP to "BEAT JUMP",
                        PerformancePadPageId.SAMPLER to "SAMPLER"
                    ).forEach { (pageId, label) ->
                        val isSelected = pageA == pageId
                        Box(
                            modifier = Modifier
                                .background(if (isSelected) DjbColors.Cyan else Color(0xFF25282F), RoundedCornerShape(4.dp))
                                .border(1.dp, if (isSelected) DjbColors.CyanBright else Color(0xFF454A54), RoundedCornerShape(4.dp))
                                .clickable { pageA = pageId }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = label,
                                color = if (isSelected) Color(0xFF0B0C0E) else DjbColors.TextSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Delete Cue Mode
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(if (clearCueA) Color(0xFF991B1B) else Color(0xFF25282F), RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFF454A54), RoundedCornerShape(4.dp))
                        .clickable { clearCueA = !clearCueA },
                    contentAlignment = Alignment.Center
                ) {
                    Text("X", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            // 8 Pads Grid (2 rows of 4)
            Column(
                modifier = Modifier.weight(1f).padding(vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (1..4).forEach { idx ->
                        PadSlotButton(
                            label = "$idx",
                            subLabel = if (pageA == PerformancePadPageId.HOT_CUES && deckA.hotCues[idx - 1].active)
                                formatTimeCode(deckA.hotCues[idx - 1].positionSec ?: 0f).slice(0..3)
                            else if (pageA == PerformancePadPageId.BEAT_JUMP) "${idx}B"
                            else "SMP $idx",
                            isActive = (pageA == PerformancePadPageId.HOT_CUES && deckA.hotCues[idx - 1].active),
                            accentColor = DjbColors.Cyan,
                            onClick = {
                                if (pageA == PerformancePadPageId.HOT_CUES) onTriggerCueA(idx, clearCueA)
                                else onNudgeA((idx * 4f))
                            },
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                    }
                }
                Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (5..8).forEach { idx ->
                        PadSlotButton(
                            label = "$idx",
                            subLabel = if (pageA == PerformancePadPageId.HOT_CUES && deckA.hotCues[idx - 1].active)
                                formatTimeCode(deckA.hotCues[idx - 1].positionSec ?: 0f).slice(0..3)
                            else if (pageA == PerformancePadPageId.BEAT_JUMP) "${idx}B"
                            else "SMP $idx",
                            isActive = (pageA == PerformancePadPageId.HOT_CUES && deckA.hotCues[idx - 1].active),
                            accentColor = DjbColors.Cyan,
                            onClick = {
                                if (pageA == PerformancePadPageId.HOT_CUES) onTriggerCueA(idx, clearCueA)
                                else onNudgeA((idx * 4f))
                            },
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                    }
                }
            }
        }

        // --- DECK B PADS UNIT ---
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Page Selector Tabs Deck B
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Delete Cue Mode
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(if (clearCueB) Color(0xFF991B1B) else Color(0xFF25282F), RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFF454A54), RoundedCornerShape(4.dp))
                        .clickable { clearCueB = !clearCueB },
                    contentAlignment = Alignment.Center
                ) {
                    Text("X", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf(
                        PerformancePadPageId.HOT_CUES to "HOT CUES",
                        PerformancePadPageId.BEAT_JUMP to "BEAT JUMP",
                        PerformancePadPageId.SAMPLER to "SAMPLER"
                    ).forEach { (pageId, label) ->
                        val isSelected = pageB == pageId
                        Box(
                            modifier = Modifier
                                .background(if (isSelected) DjbColors.Cyan else Color(0xFF25282F), RoundedCornerShape(4.dp))
                                .border(1.dp, if (isSelected) Color.White else Color(0xFF454A54), RoundedCornerShape(4.dp))
                                .clickable { pageB = pageId }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = label,
                                color = if (isSelected) Color(0xFF0B0C0E) else DjbColors.TextSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // 8 Pads Grid (2 rows of 4)
            Column(
                modifier = Modifier.weight(1f).padding(vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (1..4).forEach { idx ->
                        PadSlotButton(
                            label = "$idx",
                            subLabel = if (pageB == PerformancePadPageId.HOT_CUES && deckB.hotCues[idx - 1].active)
                                formatTimeCode(deckB.hotCues[idx - 1].positionSec ?: 0f).slice(0..3)
                            else if (pageB == PerformancePadPageId.BEAT_JUMP) "${idx}B"
                            else "SMP $idx",
                            isActive = (pageB == PerformancePadPageId.HOT_CUES && deckB.hotCues[idx - 1].active),
                            accentColor = DjbColors.Cyan,
                            onClick = {
                                if (pageB == PerformancePadPageId.HOT_CUES) onTriggerCueB(idx, clearCueB)
                                else onNudgeB((idx * 4f))
                            },
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                    }
                }
                Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (5..8).forEach { idx ->
                        PadSlotButton(
                            label = "$idx",
                            subLabel = if (pageB == PerformancePadPageId.HOT_CUES && deckB.hotCues[idx - 1].active)
                                formatTimeCode(deckB.hotCues[idx - 1].positionSec ?: 0f).slice(0..3)
                            else if (pageB == PerformancePadPageId.BEAT_JUMP) "${idx}B"
                            else "SMP $idx",
                            isActive = (pageB == PerformancePadPageId.HOT_CUES && deckB.hotCues[idx - 1].active),
                            accentColor = DjbColors.Cyan,
                            onClick = {
                                if (pageB == PerformancePadPageId.HOT_CUES) onTriggerCueB(idx, clearCueB)
                                else onNudgeB((idx * 4f))
                            },
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PadSlotButton(
    label: String,
    subLabel: String,
    isActive: Boolean,
    accentColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .background(if (isActive) accentColor.copy(alpha = 0.35f) else Color(0xFF262A32), RoundedCornerShape(6.dp))
            .border(1.5.dp, if (isActive) accentColor else Color(0xFF383D47), RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(2.dp))
            Text(subLabel, color = if (isActive) accentColor else DjbColors.TextSecondary, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
        }
    }
}
