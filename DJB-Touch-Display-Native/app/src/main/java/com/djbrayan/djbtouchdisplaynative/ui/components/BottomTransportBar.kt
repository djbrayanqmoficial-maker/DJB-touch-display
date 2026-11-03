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
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Bottom Transport Bar — Tactile transport controls (Play/Pause, Cue, Sync, Pitch Bend, Crossfader).
 * Faithful reproduction of BottomTransportBar.tsx.
 */
@Composable
fun BottomTransportBar(
    deckA: DeckState,
    deckB: DeckState,
    crossfaderPos: Float,
    onPlayPauseA: () -> Unit,
    onPlayPauseB: () -> Unit,
    onCueA: () -> Unit,
    onCueB: () -> Unit,
    onSyncA: () -> Unit,
    onSyncB: () -> Unit,
    onPitchBendA: (dir: Float) -> Unit,
    onPitchBendB: (dir: Float) -> Unit,
    onCrossfaderChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
            .background(Color(0xFF15171B))
            .border(width = 1.dp, color = DjbColors.Border)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // ==========================================
        // DECK A TRANSPORT
        // ==========================================
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // CUE BUTTON
            TransportButton(
                label = "CUE",
                isActive = false,
                activeColor = DjbColors.Amber,
                onClick = onCueA,
                widthDp = 52
            )

            // PLAY / PAUSE BUTTON
            TransportButton(
                label = if (deckA.isPlaying) "❚❚" else "▶",
                isActive = deckA.isPlaying,
                activeColor = DjbColors.Green,
                onClick = onPlayPauseA,
                widthDp = 56,
                fontSizeSp = 14
            )

            // SYNC BUTTON
            TransportButton(
                label = "SYNC",
                isActive = deckA.isSync,
                activeColor = DjbColors.Cyan,
                onClick = onSyncA,
                widthDp = 46
            )

            // PITCH BEND - / +
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                SmallActionButton(label = "–", onClick = { onPitchBendA(-1f) })
                SmallActionButton(label = "+", onClick = { onPitchBendA(1f) })
            }
        }

        // ==========================================
        // CENTER MINI CROSSFADER
        // ==========================================
        Box(
            modifier = Modifier
                .width(160.dp)
                .height(36.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF1E2126))
                .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(4.dp))
                .padding(horizontal = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            // Center Line Marker
            Box(
                modifier = Modifier
                    .fillMaxHeight(0.6f)
                    .width(1.dp)
                    .background(Color(0xFF525761))
            )

            // Crossfader handle
            val handleOffset = (crossfaderPos * 60f).dp
            Box(
                modifier = Modifier
                    .offset(x = handleOffset)
                    .width(28.dp)
                    .height(24.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xFF2E333D))
                    .border(width = 1.dp, color = Color.White, shape = RoundedCornerShape(3.dp)),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .fillMaxHeight(0.7f)
                        .background(Color.White)
                )
            }
        }

        // ==========================================
        // DECK B TRANSPORT
        // ==========================================
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // PITCH BEND - / +
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                SmallActionButton(label = "–", onClick = { onPitchBendB(-1f) })
                SmallActionButton(label = "+", onClick = { onPitchBendB(1f) })
            }

            // SYNC BUTTON
            TransportButton(
                label = "SYNC",
                isActive = deckB.isSync,
                activeColor = DjbColors.Cyan,
                onClick = onSyncB,
                widthDp = 46
            )

            // CUE BUTTON
            TransportButton(
                label = "CUE",
                isActive = false,
                activeColor = DjbColors.Amber,
                onClick = onCueB,
                widthDp = 52
            )

            // PLAY / PAUSE BUTTON
            TransportButton(
                label = if (deckB.isPlaying) "❚❚" else "▶",
                isActive = deckB.isPlaying,
                activeColor = DjbColors.Green,
                onClick = onPlayPauseB,
                widthDp = 56,
                fontSizeSp = 14
            )
        }
    }
}

@Composable
private fun TransportButton(
    label: String,
    isActive: Boolean,
    activeColor: Color,
    onClick: () -> Unit,
    widthDp: Int = 48,
    fontSizeSp: Int = 11
) {
    Box(
        modifier = Modifier
            .width(widthDp.dp)
            .height(38.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(if (isActive) activeColor else Color(0xFF25282F))
            .border(
                width = 1.dp,
                color = if (isActive) Color.White else DjbColors.BorderLight,
                shape = RoundedCornerShape(4.dp)
            )
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = fontSizeSp.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = FontFamily.Monospace,
            color = if (isActive) Color(0xFF0F1114) else Color.White
        )
    }
}

@Composable
private fun SmallActionButton(
    label: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(Color(0xFF25282F))
            .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(3.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = Color.White
        )
    }
}
