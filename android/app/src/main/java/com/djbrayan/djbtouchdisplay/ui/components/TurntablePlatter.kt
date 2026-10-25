package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Turntable Platter — Migrated with 100% fidelity from TurntablePlatter.tsx
 * Realistic circular vinyl jogwheel with concentric grooved radial rings,
 * rotating position marker bar, and center hub with pitch bend arrows.
 */
@Composable
fun TurntablePlatter(
    deckId: String,
    angleDeg: Float,
    isPlaying: Boolean,
    onNudge: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxHeight()
            .padding(2.dp),
        contentAlignment = Alignment.Center
    ) {
        // Responsively compute platter size so it never exceeds maxWidth or maxHeight
        val availableSize = minOf(maxWidth, maxHeight)
        val platterSize = (availableSize * 0.92f).coerceAtMost(310.dp)

        Box(
            modifier = Modifier
                .size(platterSize)
                .border(4.dp, Color(0xFF07080A), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            // Outer Vinyl Canvas with Grooves and Rotating Radial Bar
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectDragGestures { change, dragAmount ->
                            change.consume()
                            val delta = dragAmount.y + (dragAmount.x * 0.55f)
                            onNudge(delta * 1.45f)
                        }
                    }
            ) {
                val radius = size.minDimension / 2f
                val center = Offset(size.width / 2f, size.height / 2f)

                // Dark Platter Base — Both decks use Cross DJ Pro Cyan (#0099DB) per React reference
                drawCircle(
                    color = DjbColors.Cyan,
                    radius = radius,
                    center = center
                )

                // Repeating Radial Grooves (#007DB5 matching React)
                val grooveCount = 18
                for (i in 1..grooveCount) {
                    val r = radius * (i.toFloat() / (grooveCount + 1))
                    drawCircle(
                        color = Color(0xFF007DB5).copy(alpha = 0.45f),
                        radius = r,
                        center = center,
                        style = Stroke(width = 1.5f)
                    )
                }

                // Rotating Radial Position Bar (pointing from center outward)
                val rad = angleDeg * (PI / 180f).toFloat()
                val barLength = radius * 0.95f
                val endX = center.x + cos(rad) * barLength
                val endY = center.y + sin(rad) * barLength

                drawLine(
                    color = DjbColors.CyanDark,
                    start = center,
                    end = Offset(endX, endY),
                    strokeWidth = (radius * 0.12f).coerceIn(8f, 16f)
                )

                // Center Dark Vinyl Hub (#1B313E matching React)
                val hubRadius = radius * 0.36f
                drawCircle(
                    color = DjbColors.CyanDark,
                    radius = hubRadius,
                    center = center
                )
                drawCircle(
                    color = Color(0xFF152631),
                    radius = hubRadius,
                    center = center,
                    style = Stroke(width = 3f)
                )

                // Center Spindle Pin (#6C737F)
                drawCircle(
                    color = Color(0xFF6C737F),
                    radius = (radius * 0.08f).coerceIn(4f, 10f),
                    center = center
                )
            }

            // Pitch Bend Indicator Labels inside Hub
            Row(
                modifier = Modifier.fillMaxWidth(0.32f),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("◄", color = Color.White.copy(alpha = 0.75f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Text("►", color = Color.White.copy(alpha = 0.75f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
