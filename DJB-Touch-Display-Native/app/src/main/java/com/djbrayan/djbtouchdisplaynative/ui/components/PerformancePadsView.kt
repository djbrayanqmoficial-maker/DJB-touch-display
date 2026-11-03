package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.model.PerformancePadPage
import com.djbrayan.djbtouchdisplaynative.model.SamplerSlotState
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Performance Pads View — 8 Multifunction tactile pads per deck with 4 switchable modes:
 * HOT CUE, AUTO LOOP, SAMPLER, and BEAT JUMP.
 * Faithful reproduction of PerformancePadsView.tsx.
 */
@Composable
fun PerformancePadsView(
    deckA: DeckState,
    deckB: DeckState,
    activePage: PerformancePadPage,
    samplerSlotsA: List<SamplerSlotState>,
    samplerSlotsB: List<SamplerSlotState>,
    onSelectPage: (PerformancePadPage) -> Unit,
    onHotCueA: (Int) -> Unit,
    onHotCueB: (Int) -> Unit,
    onAutoLoopA: (Double) -> Unit,
    onAutoLoopB: (Double) -> Unit,
    onTriggerSampleA: (Int) -> Unit,
    onTriggerSampleB: (Int) -> Unit,
    onBeatJumpA: (beats: Double, fwd: Boolean) -> Unit,
    onBeatJumpB: (beats: Double, fwd: Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141619))
            .padding(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // Mode Selector Tabs (HOT CUE, AUTO LOOP, SAMPLER, BEAT JUMP)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFF1E2126))
                    .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(4.dp))
                    .padding(2.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                PerformancePadPage.values().forEach { page ->
                    val active = activePage == page
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (active) DjbColors.Cyan else Color.Transparent)
                            .clickable { onSelectPage(page) }
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = page.label,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (active) Color.Black else DjbColors.TextSecondary
                        )
                    }
                }
            }
        }

        // 8 Pads Matrix for Deck A and Deck B
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Deck A Pads
            DeckPadMatrix(
                deckId = "A",
                page = activePage,
                deck = deckA,
                samplerSlots = samplerSlotsA,
                onHotCue = onHotCueA,
                onAutoLoop = onAutoLoopA,
                onTriggerSample = onTriggerSampleA,
                onBeatJump = onBeatJumpA,
                modifier = Modifier.weight(1f)
            )

            // Divider
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(1.dp)
                    .background(Color(0xFF2A2E36))
            )

            // Deck B Pads (Identical Cyan Palette)
            DeckPadMatrix(
                deckId = "B",
                page = activePage,
                deck = deckB,
                samplerSlots = samplerSlotsB,
                onHotCue = onHotCueB,
                onAutoLoop = onAutoLoopB,
                onTriggerSample = onTriggerSampleB,
                onBeatJump = onBeatJumpB,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun DeckPadMatrix(
    deckId: String,
    page: PerformancePadPage,
    deck: DeckState,
    samplerSlots: List<SamplerSlotState>,
    onHotCue: (Int) -> Unit,
    onAutoLoop: (Double) -> Unit,
    onTriggerSample: (Int) -> Unit,
    onBeatJump: (Double, Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        for (row in 0..1) {
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                for (col in 0..3) {
                    val padIndex = (row * 4) + col

                    when (page) {
                        PerformancePadPage.HOT_CUE -> {
                            val cue = deck.hotCues.getOrNull(padIndex)
                            val isSet = cue?.isSet == true
                            SinglePad(
                                label = "CUE ${padIndex + 1}",
                                subLabel = if (isSet) "ACTIVE" else "EMPTY",
                                isActive = isSet,
                                activeColor = DjbColors.Cyan,
                                onClick = { onHotCue(padIndex) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        PerformancePadPage.AUTO_LOOP -> {
                            val beats = AUTO_LOOP_BEATS.getOrElse(padIndex) { 1.0 }
                            val isActive = deck.loopActive && deck.loopLengthBeats == beats
                            SinglePad(
                                label = if (beats < 1.0) "1/${(1.0 / beats).toInt()}" else "${beats.toInt()} BEATS",
                                subLabel = "LOOP",
                                isActive = isActive,
                                activeColor = DjbColors.Green,
                                onClick = { onAutoLoop(beats) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        PerformancePadPage.SAMPLER -> {
                            val slot = samplerSlots.getOrNull(padIndex)
                            SinglePad(
                                label = slot?.name ?: "SAMPLE ${padIndex + 1}",
                                subLabel = "ONE-SHOT",
                                isActive = slot?.isPlaying == true,
                                activeColor = DjbColors.Amber,
                                onClick = { onTriggerSample(padIndex) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        PerformancePadPage.BEAT_JUMP -> {
                            val jumpBeats = listOf(1.0, 2.0, 4.0, 8.0).getOrElse(padIndex % 4) { 1.0 }
                            val isFwd = row == 1
                            SinglePad(
                                label = "${if (isFwd) "+" else "-"}${jumpBeats.toInt()} BEATS",
                                subLabel = if (isFwd) "FORWARD" else "BACK",
                                isActive = false,
                                activeColor = DjbColors.Cyan,
                                onClick = { onBeatJump(jumpBeats, isFwd) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SinglePad(
    label: String,
    subLabel: String,
    isActive: Boolean,
    activeColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(4.dp))
            .background(if (isActive) activeColor else Color(0xFF1E2126))
            .border(
                width = 1.dp,
                color = if (isActive) Color.White else DjbColors.Border,
                shape = RoundedCornerShape(4.dp)
            )
            .clickable { onClick() }
            .padding(4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = if (isActive) Color.Black else Color.White
            )
            Text(
                text = subLabel,
                fontSize = 8.sp,
                fontFamily = FontFamily.Monospace,
                color = if (isActive) Color.Black.copy(alpha = 0.7f) else DjbColors.TextSecondary
            )
        }
    }
}
