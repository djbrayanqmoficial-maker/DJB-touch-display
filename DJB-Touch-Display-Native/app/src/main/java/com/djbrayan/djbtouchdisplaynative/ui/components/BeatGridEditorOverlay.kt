package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Beat Grid Editor Overlay — Expandable floating toolbar for micro-tuning beat alignment.
 * Faithful reproduction of the circular beat grid cluster in App.tsx.
 */
@Composable
fun BeatGridEditorOverlay(
    editDeck: String,
    onToggleDeck: () -> Unit,
    onShiftBack: () -> Unit,
    onShiftForward: () -> Unit,
    onHalveBpm: () -> Unit,
    onDoubleBpm: () -> Unit,
    onSetFirstBeat: () -> Unit,
    onReset: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xE615171B))
            .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(20.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Deck Selector (A / B)
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(DjbColors.Cyan)
                .border(width = 1.dp, color = Color.White, shape = CircleShape)
                .clickable { onToggleDeck() },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = editDeck,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = Color.Black
            )
        }

        // Shift Backward (-12ms)
        GridActionButton(label = "◄", onClick = onShiftBack)

        // Shift Forward (+12ms)
        GridActionButton(label = "►", onClick = onShiftForward)

        // Divide BPM (/2)
        GridActionButton(label = "÷2", onClick = onHalveBpm)

        // Multiply BPM (x2)
        GridActionButton(label = "×2", onClick = onDoubleBpm)

        // First Beat Marker (1st)
        GridActionButton(label = "1st", onClick = onSetFirstBeat)

        // Reset Beat Grid (RST)
        GridActionButton(label = "RST", onClick = onReset, isMuted = true)
    }
}

@Composable
private fun GridActionButton(
    label: String,
    onClick: () -> Unit,
    isMuted: Boolean = false
) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(Color(0xFF25282F))
            .border(width = 1.dp, color = DjbColors.BorderLight, shape = CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = if (isMuted) DjbColors.TextMuted else DjbColors.TextPrimary
        )
    }
}
