package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.DeckState
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

/**
 * Bottom Transport Bar — Migrated with 100% fidelity from BottomTransportBar.tsx
 * 68dp persistent footer featuring large tactile CUE, PLAY, and SYNC buttons
 * with Numark DJ2GO LED synchronization and wide central Crossfader.
 */
@Composable
fun BottomTransportBar(
    deckA: DeckState,
    deckB: DeckState,
    crossfader: Float, // -100 to +100
    onChangeCrossfader: (Float) -> Unit,
    onCueDownA: () -> Unit,
    onCueUpA: () -> Unit,
    onPlayA: () -> Unit,
    onSyncA: () -> Unit,
    onCueDownB: () -> Unit,
    onCueUpB: () -> Unit,
    onPlayB: () -> Unit,
    onSyncB: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(68.dp)
            .background(DjbColors.BottomBarBg)
            .border(width = 1.dp, color = Color(0xFF2C3038))
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // --- LEFT TRANSPORT CLUSTER (DECK A): CUE | PLAY | SYNC ---
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // CUE A
            Box(
                modifier = Modifier
                    .width(84.dp)
                    .height(50.dp)
                    .background(
                        if (deckA.isCueing) DjbColors.Cyan else Color(0xFF4B4F56),
                        RoundedCornerShape(6.dp)
                    )
                    .border(
                        1.dp,
                        if (deckA.isCueing) DjbColors.CyanBright else Color(0xFF383C42),
                        RoundedCornerShape(6.dp)
                    )
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onPress = {
                                onCueDownA()
                                tryAwaitRelease()
                                onCueUpA()
                            }
                        )
                    },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "CUE",
                    color = if (deckA.isCueing) Color(0xFF0B0C0E) else Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // PLAY A
            Box(
                modifier = Modifier
                    .width(84.dp)
                    .height(50.dp)
                    .background(
                        if (deckA.isPlaying) DjbColors.Cyan else Color(0xFF4B4F56),
                        RoundedCornerShape(6.dp)
                    )
                    .border(
                        1.dp,
                        if (deckA.isPlaying) DjbColors.CyanBright else Color(0xFF383C42),
                        RoundedCornerShape(6.dp)
                    )
                    .pointerInput(Unit) {
                        detectTapGestures { onPlayA() }
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play A",
                    tint = if (deckA.isPlaying) Color(0xFF0B0C0E) else Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }

            // SYNC A
            Box(
                modifier = Modifier
                    .width(84.dp)
                    .height(50.dp)
                    .background(
                        if (deckA.isSyncActive) DjbColors.Cyan else Color(0xFF4B4F56),
                        RoundedCornerShape(6.dp)
                    )
                    .border(
                        1.dp,
                        if (deckA.isSyncActive) DjbColors.CyanBright else Color(0xFF383C42),
                        RoundedCornerShape(6.dp)
                    )
                    .pointerInput(Unit) {
                        detectTapGestures { onSyncA() }
                    },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "%.1f".format(deckA.currentBpm),
                        color = if (deckA.isSyncActive) Color(0xFF0B0C0E) else Color.White,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "SYNC",
                        color = if (deckA.isSyncActive) Color(0xFF0B0C0E) else DjbColors.TextSecondary,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // --- CENTER CROSSFADER ---
        Box(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 20.dp),
            contentAlignment = Alignment.Center
        ) {
            CrossfaderTrack(
                crossfader = crossfader,
                onChange = onChangeCrossfader,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
            )
        }

        // --- RIGHT TRANSPORT CLUSTER (DECK B): SYNC | CUE | PLAY ---
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // SYNC B
            Box(
                modifier = Modifier
                    .width(84.dp)
                    .height(50.dp)
                    .background(
                        if (deckB.isSyncActive) DjbColors.Cyan else Color(0xFF4B4F56),
                        RoundedCornerShape(6.dp)
                    )
                    .border(
                        1.dp,
                        if (deckB.isSyncActive) DjbColors.CyanBright else Color(0xFF383C42),
                        RoundedCornerShape(6.dp)
                    )
                    .pointerInput(Unit) {
                        detectTapGestures { onSyncB() }
                    },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "%.1f".format(deckB.currentBpm),
                        color = if (deckB.isSyncActive) Color(0xFF0B0C0E) else Color.White,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "SYNC",
                        color = if (deckB.isSyncActive) Color(0xFF0B0C0E) else DjbColors.TextSecondary,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // CUE B
            Box(
                modifier = Modifier
                    .width(84.dp)
                    .height(50.dp)
                    .background(
                        if (deckB.isCueing) DjbColors.Cyan else Color(0xFF4B4F56),
                        RoundedCornerShape(6.dp)
                    )
                    .border(
                        1.dp,
                        if (deckB.isCueing) DjbColors.CyanBright else Color(0xFF383C42),
                        RoundedCornerShape(6.dp)
                    )
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onPress = {
                                onCueDownB()
                                tryAwaitRelease()
                                onCueUpB()
                            }
                        )
                    },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "CUE",
                    color = if (deckB.isCueing) Color(0xFF0B0C0E) else Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // PLAY B
            Box(
                modifier = Modifier
                    .width(84.dp)
                    .height(50.dp)
                    .background(
                        if (deckB.isPlaying) DjbColors.Cyan else Color(0xFF4B4F56),
                        RoundedCornerShape(6.dp)
                    )
                    .border(
                        1.dp,
                        if (deckB.isPlaying) DjbColors.CyanBright else Color(0xFF383C42),
                        RoundedCornerShape(6.dp)
                    )
                    .pointerInput(Unit) {
                        detectTapGestures { onPlayB() }
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play B",
                    tint = if (deckB.isPlaying) Color(0xFF0B0C0E) else Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}

@Composable
fun CrossfaderTrack(
    crossfader: Float, // -100 to +100
    onChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    val ratio = (offset.x / size.width).coerceIn(0f, 1f)
                    val value = (ratio * 200f) - 100f
                    onChange(value)
                }
            }
            .pointerInput(Unit) {
                detectDragGestures { change, _ ->
                    change.consume()
                    val ratio = (change.position.x / size.width).coerceIn(0f, 1f)
                    val value = (ratio * 200f) - 100f
                    onChange(value)
                }
            }
    ) {
        val width = size.width
        val height = size.height
        val centerY = height / 2f

        // Rail Slot
        val slotH = 8f
        drawRoundRect(
            color = Color(0xFF0F1115),
            topLeft = Offset(0f, centerY - slotH / 2f),
            size = androidx.compose.ui.geometry.Size(width, slotH),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
        )

        // Center Notch Line
        drawLine(
            color = Color(0xFF454B55),
            start = Offset(width / 2f, centerY - 12f),
            end = Offset(width / 2f, centerY + 12f),
            strokeWidth = 2f
        )

        // Metallic Crossfader Cap
        val norm = (crossfader + 100f) / 200f // 0.0 to 1.0
        val capW = 34f
        val capH = 36f
        val capX = (norm * (width - capW)).coerceIn(0f, width - capW)
        val capY = centerY - capH / 2f

        drawRoundRect(
            color = Color(0xFF6B7280),
            topLeft = Offset(capX, capY),
            size = androidx.compose.ui.geometry.Size(capW, capH),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
        )
        // Cap center groove
        drawLine(
            color = Color.White,
            start = Offset(capX + capW / 2f, capY + 4f),
            end = Offset(capX + capW / 2f, capY + capH - 4f),
            strokeWidth = 2f
        )
    }
}
