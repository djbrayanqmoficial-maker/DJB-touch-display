package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.DeckState
import com.djbrayan.djbtouchdisplay.core.OperatingMode
import com.djbrayan.djbtouchdisplay.core.formatTimeCode
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

/**
 * Top Deck Header Bar — Migrated with 100% fidelity from TopDeckHeaderBar.tsx
 * Persistent 68dp header with circular (+) load buttons, track metadata,
 * key tags, PFL and Vinyl toggles, Overview waveforms, and center BPM/REC cluster.
 */
@Composable
fun TopDeckHeaderBar(
    deckA: DeckState,
    deckB: DeckState,
    overviewPeaksA: FloatArray,
    overviewPeaksB: FloatArray,
    operatingMode: OperatingMode,
    isRecording: Boolean,
    vinylModeA: Boolean,
    vinylModeB: Boolean,
    onToggleRecording: () -> Unit,
    onOpenLibraryForDeck: (String) -> Unit,
    onSeekDeckA: (Float) -> Unit,
    onSeekDeckB: (Float) -> Unit,
    onTogglePflA: () -> Unit,
    onTogglePflB: () -> Unit,
    onToggleVinylA: () -> Unit,
    onToggleVinylB: () -> Unit,
    modifier: Modifier = Modifier
) {
    val remainA = (deckA.durationSec - deckA.positionSec).coerceAtLeast(0f)
    val remainB = (deckB.durationSec - deckB.positionSec).coerceAtLeast(0f)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(68.dp)
            .background(DjbColors.HeaderBg)
            .border(width = 1.dp, color = Color(0xFF252830))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // --- DECK A: Load (+) Button + Metadata + Overview Waveform ---
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Circular (+) Load Button
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .background(Color(0xFF1C1F24), CircleShape)
                    .border(1.dp, Color(0xFF9CA3AF), CircleShape)
                    .clickable { onOpenLibraryForDeck("A") },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "+",
                    color = DjbColors.Cyan,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Light,
                    lineHeight = 26.sp
                )
            }

            // Metadata & Overview Waveform Column
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top text line
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "-${formatTimeCode(remainA)}",
                        color = DjbColors.Cyan,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = deckA.title,
                        color = DjbColors.TextPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Text(
                        text = deckA.artist,
                        color = DjbColors.TextSecondary,
                        fontSize = 10.sp,
                        maxLines = 1
                    )
                    Text(
                        text = deckA.key,
                        color = DjbColors.Cyan,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    // PFL Button A
                    Box(
                        modifier = Modifier
                            .background(
                                if (deckA.pflHeadphoneCue) DjbColors.Cyan else Color(0xFF15181C),
                                RoundedCornerShape(2.dp)
                            )
                            .border(
                                1.dp,
                                if (deckA.pflHeadphoneCue) DjbColors.CyanBright else Color(0xFF383D47),
                                RoundedCornerShape(2.dp)
                            )
                            .clickable { onTogglePflA() }
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "PFL",
                            color = if (deckA.pflHeadphoneCue) Color(0xFF0B0C0E) else DjbColors.TextSecondary,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Vinyl Mode Button A
                    Box(
                        modifier = Modifier
                            .background(
                                if (vinylModeA) Color(0xFF1D2833) else Color(0xFF15181C),
                                RoundedCornerShape(2.dp)
                            )
                            .border(
                                1.dp,
                                if (vinylModeA) DjbColors.Cyan else Color(0xFF383D47),
                                RoundedCornerShape(2.dp)
                            )
                            .clickable { onToggleVinylA() }
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "VINYL",
                            color = if (vinylModeA) DjbColors.Cyan else DjbColors.TextSecondary,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(3.dp))

                // Overview Waveform Deck A
                OverviewMiniWaveform(
                    peaks = overviewPeaksA,
                    positionSec = deckA.positionSec,
                    durationSec = deckA.durationSec,
                    accentColor = DjbColors.Cyan,
                    onSeek = onSeekDeckA,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(24.dp)
                )
            }
        }

        // --- CENTER: BPM, SYNC, REC & MODE BADGE ---
        Column(
            modifier = Modifier
                .width(130.dp)
                .padding(horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // REC Button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier
                    .background(if (isRecording) Color(0xFF7F1D1D) else Color(0xFF15171B), RoundedCornerShape(4.dp))
                    .border(1.dp, if (isRecording) Color.Red else Color(0xFF2E333D), RoundedCornerShape(4.dp))
                    .clickable { onToggleRecording() }
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .background(if (isRecording) Color.Red else Color(0xFFEF4444), CircleShape)
                )
                Text(
                    text = if (isRecording) "REC ON" else "REC",
                    color = DjbColors.TextPrimary,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            // BPM Comparison (Deck A / Deck B)
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "%.1f".format(deckA.currentBpm),
                    color = DjbColors.Cyan,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "SYNC",
                    color = if (deckA.isSyncActive || deckB.isSyncActive) DjbColors.Cyan else DjbColors.TextMuted,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "%.1f".format(deckB.currentBpm),
                    color = DjbColors.Cyan,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            // Mode Label
            Text(
                text = if (operatingMode == OperatingMode.VIRTUALDJ) "VIRTUALDJ MODE" else "STANDALONE MODE",
                color = DjbColors.TextSecondary,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        // --- DECK B: Metadata + Overview Waveform + Load (+) Button ---
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Metadata & Overview Waveform Column
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top text line
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Vinyl Mode Button B
                    Box(
                        modifier = Modifier
                            .background(
                                if (vinylModeB) Color(0xFF162B3D) else Color(0xFF15181C),
                                RoundedCornerShape(2.dp)
                            )
                            .border(
                                1.dp,
                                if (vinylModeB) DjbColors.Cyan else Color(0xFF383D47),
                                RoundedCornerShape(2.dp)
                            )
                            .clickable { onToggleVinylB() }
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "VINYL",
                            color = if (vinylModeB) DjbColors.Cyan else DjbColors.TextSecondary,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // PFL Button B
                    Box(
                        modifier = Modifier
                            .background(
                                if (deckB.pflHeadphoneCue) DjbColors.Cyan else Color(0xFF15181C),
                                RoundedCornerShape(2.dp)
                            )
                            .border(
                                1.dp,
                                if (deckB.pflHeadphoneCue) DjbColors.Cyan else Color(0xFF383D47),
                                RoundedCornerShape(2.dp)
                            )
                            .clickable { onTogglePflB() }
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "PFL",
                            color = if (deckB.pflHeadphoneCue) Color(0xFF0B0C0E) else DjbColors.TextSecondary,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Text(
                        text = deckB.key,
                        color = DjbColors.Cyan,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = deckB.artist,
                        color = DjbColors.TextSecondary,
                        fontSize = 10.sp,
                        maxLines = 1
                    )
                    Text(
                        text = deckB.title,
                        color = DjbColors.TextPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Text(
                        text = "-${formatTimeCode(remainB)}",
                        color = DjbColors.Cyan,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(3.dp))

                // Overview Waveform Deck B
                OverviewMiniWaveform(
                    peaks = overviewPeaksB,
                    positionSec = deckB.positionSec,
                    durationSec = deckB.durationSec,
                    accentColor = DjbColors.Cyan,
                    onSeek = onSeekDeckB,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(24.dp)
                )
            }

            // Circular (+) Load Button Deck B
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .background(Color(0xFF1C1F24), CircleShape)
                    .border(1.dp, Color(0xFF9CA3AF), CircleShape)
                    .clickable { onOpenLibraryForDeck("B") },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "+",
                    color = DjbColors.Cyan,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Light,
                    lineHeight = 26.sp
                )
            }
        }
    }
}

@Composable
fun OverviewMiniWaveform(
    peaks: FloatArray,
    positionSec: Float,
    durationSec: Float,
    accentColor: Color,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    val progress = if (durationSec > 0) (positionSec / durationSec).coerceIn(0f, 1f) else 0f

    Canvas(
        modifier = modifier
            .background(Color(0xFF090B0E), RoundedCornerShape(3.dp))
            .border(0.5.dp, Color(0xFF262A32), RoundedCornerShape(3.dp))
            .pointerInput(durationSec) {
                detectTapGestures { offset ->
                    val fraction = (offset.x / size.width).coerceIn(0f, 1f)
                    onSeek(fraction * durationSec)
                }
            }
    ) {
        val width = size.width
        val height = size.height
        val centerY = height / 2f
        val barCount = peaks.size
        val barWidth = width / barCount.toFloat()

        for (i in 0 until barCount) {
            val amp = peaks[i]
            val barH = amp * (height * 0.85f)
            val x = i * barWidth
            val isPlayed = (x / width) <= progress

            val col = if (isPlayed) accentColor else Color(0xFF333B47)
            drawRect(
                color = col,
                topLeft = Offset(x, centerY - barH / 2f),
                size = Size(barWidth * 0.85f, barH)
            )
        }

        // White Playhead line
        val playX = progress * width
        drawLine(
            color = Color.White,
            start = Offset(playX, 0f),
            end = Offset(playX, height),
            strokeWidth = 1.5f
        )
    }
}
