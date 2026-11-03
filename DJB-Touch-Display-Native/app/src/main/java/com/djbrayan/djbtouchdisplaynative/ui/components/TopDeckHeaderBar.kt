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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.model.CachedWaveformData
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.model.formatTimeCode
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Top Deck Header Bar — Persistent dual deck header with track info, overview waveforms,
 * load buttons, timecodes, and recording control.
 * Faithful reproduction of TopDeckHeaderBar.tsx.
 */
@Composable
fun TopDeckHeaderBar(
    deckA: DeckState,
    deckB: DeckState,
    waveformA: CachedWaveformData?,
    waveformB: CachedWaveformData?,
    isRecording: Boolean,
    onToggleRecording: () -> Unit,
    onOpenLibrary: (deckId: String) -> Unit,
    onSeekA: (positionSec: Double) -> Unit,
    onSeekB: (positionSec: Double) -> Unit,
    onToggleVinylA: () -> Unit,
    onToggleVinylB: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(Color(0xFF15171B))
            .border(width = 1.dp, color = DjbColors.Border)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // ==========================================
        // DECK A HEADER
        // ==========================================
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Load Button A
            Box(
                modifier = Modifier
                    .width(48.dp)
                    .height(38.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(DjbColors.Cyan)
                    .clickable { onOpenLibrary("A") },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "LOAD A",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White
                )
            }

            // Track Details + Overview Waveform
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = deckA.trackTitle,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "${formatTimeCode(deckA.currentPositionSec)} / -${formatTimeCode((deckA.durationSec - deckA.currentPositionSec).coerceAtLeast(0.0))}",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = FontFamily.Monospace,
                        color = DjbColors.Cyan
                    )
                }

                Spacer(modifier = Modifier.height(2.dp))

                OverviewWaveformBar(
                    deck = deckA,
                    waveform = waveformA,
                    onSeek = onSeekA,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Deck A BPM / Pitch badge
            Column(
                horizontalAlignment = Alignment.End,
                modifier = Modifier.width(52.dp)
            ) {
                Text(
                    text = String.format("%.1f", deckA.effectiveBpm),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White
                )
                Text(
                    text = String.format("%+.1f%%", deckA.pitchPercent),
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                    color = DjbColors.TextSecondary
                )
            }
        }

        // ==========================================
        // CENTER MASTER RECORD & STATUS
        // ==========================================
        Column(
            modifier = Modifier
                .width(80.dp)
                .fillMaxHeight(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(3.dp))
                    .background(if (isRecording) DjbColors.Red else Color(0xFF25282F))
                    .border(width = 1.dp, color = if (isRecording) Color.White else DjbColors.BorderLight, shape = RoundedCornerShape(3.dp))
                    .clickable { onToggleRecording() }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = if (isRecording) "● REC" else "REC",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = if (isRecording) Color.White else DjbColors.TextSecondary
                )
            }
        }

        // ==========================================
        // DECK B HEADER (IDENTICAL CYAN PALETTE)
        // ==========================================
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Deck B BPM / Pitch badge
            Column(
                horizontalAlignment = Alignment.Start,
                modifier = Modifier.width(52.dp)
            ) {
                Text(
                    text = String.format("%.1f", deckB.effectiveBpm),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White
                )
                Text(
                    text = String.format("%+.1f%%", deckB.pitchPercent),
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                    color = DjbColors.TextSecondary
                )
            }

            // Track Details + Overview Waveform
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = deckB.trackTitle,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "${formatTimeCode(deckB.currentPositionSec)} / -${formatTimeCode((deckB.durationSec - deckB.currentPositionSec).coerceAtLeast(0.0))}",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = FontFamily.Monospace,
                        color = DjbColors.Cyan
                    )
                }

                Spacer(modifier = Modifier.height(2.dp))

                OverviewWaveformBar(
                    deck = deckB,
                    waveform = waveformB,
                    onSeek = onSeekB,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Load Button B
            Box(
                modifier = Modifier
                    .width(48.dp)
                    .height(38.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(DjbColors.Cyan)
                    .clickable { onOpenLibrary("B") },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "LOAD B",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White
                )
            }
        }
    }
}
