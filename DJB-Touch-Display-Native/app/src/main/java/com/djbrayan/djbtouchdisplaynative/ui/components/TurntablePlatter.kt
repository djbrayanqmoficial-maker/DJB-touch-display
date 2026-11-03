package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors
import kotlin.math.*

/**
 * DJB Turntable Platter — Responsive rotating jog wheel with realistic vinyl scratch physics.
 * Faithful reproduction of TurntablePlatter.tsx with anti-overlap constraints.
 */
@Composable
fun TurntablePlatter(
    deck: DeckState,
    onScratch: (deltaSec: Double) -> Unit,
    onPitchBend: (direction: Float) -> Unit,
    modifier: Modifier = Modifier
) {
    // 33 1/3 RPM = 1 rotation every ~1.8 seconds
    val rotationAngle = remember(deck.currentPositionSec) {
        ((deck.currentPositionSec / 1.8) * 360.0) % 360.0
    }

    BoxWithConstraints(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Responsively constrain diameter so it never overlaps adjacent mixer/fader controls
        val platterDiameter = minOf(maxWidth, maxHeight) * 0.92f

        Box(
            modifier = Modifier
                .size(platterDiameter)
                .pointerInput(deck.vinylMode, deck.isPlaying) {
                    var lastAngle = 0.0
                    detectDragGestures(
                        onDragStart = { offset ->
                            val center = Offset(size.width / 2f, size.height / 2f)
                            lastAngle = atan2((offset.y - center.y).toDouble(), (offset.x - center.x).toDouble())
                        },
                        onDrag = { change, _ ->
                            change.consume()
                            val center = Offset(size.width / 2f, size.height / 2f)
                            val currentAngle = atan2((change.position.y - center.y).toDouble(), (change.position.x - center.x).toDouble())
                            var deltaAngle = currentAngle - lastAngle
                            if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
                            if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI
                            lastAngle = currentAngle

                            if (deck.vinylMode) {
                                // Scratch: 360 deg = 1.8 seconds
                                val deltaSec = (deltaAngle / (2 * Math.PI)) * 1.8
                                onScratch(deltaSec)
                            } else {
                                // Pitch bend
                                onPitchBend(if (deltaAngle > 0) 1.0f else -1.0f)
                            }
                        }
                    )
                },
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val center = Offset(size.width / 2f, size.height / 2f)
                val radius = size.minDimension / 2f

                // Outer Strobe Rim
                drawCircle(
                    color = Color(0xFF141619),
                    radius = radius
                )
                drawCircle(
                    color = DjbColors.BorderLight,
                    radius = radius,
                    style = Stroke(width = 2.dp.toPx())
                )

                // Vinyl Body with Grooves
                val vinylRadius = radius * 0.92f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0xFF22252A), Color(0xFF15171B)),
                        center = center,
                        radius = vinylRadius
                    ),
                    radius = vinylRadius
                )

                // Subtle Vinyl Grooves
                val grooveCount = 8
                for (g in 1..grooveCount) {
                    val gR = vinylRadius * (0.45f + (g * 0.06f))
                    drawCircle(
                        color = Color(0x1AFFFFFF),
                        radius = gR,
                        style = Stroke(width = 0.8.dp.toPx())
                    )
                }

                // Center Label Disc (Cyan Cross DJ Pro)
                val centerLabelRadius = vinylRadius * 0.42f
                drawCircle(
                    color = DjbColors.Cyan.copy(alpha = 0.9f),
                    radius = centerLabelRadius
                )
                drawCircle(
                    color = Color.White,
                    radius = centerLabelRadius,
                    style = Stroke(width = 1.5.dp.toPx())
                )

                // Center Spindle
                drawCircle(
                    color = Color(0xFF0F1114),
                    radius = centerLabelRadius * 0.28f
                )

                // Rotating Needle / Position Marker Line
                val rad = Math.toRadians(rotationAngle)
                val markerInner = centerLabelRadius * 0.35f
                val markerOuter = vinylRadius * 0.98f
                val startPt = Offset(
                    (center.x + markerInner * cos(rad)).toFloat(),
                    (center.y + markerInner * sin(rad)).toFloat()
                )
                val endPt = Offset(
                    (center.x + markerOuter * cos(rad)).toFloat(),
                    (center.y + markerOuter * sin(rad)).toFloat()
                )
                drawLine(
                    color = Color.White,
                    start = startPt,
                    end = endPt,
                    strokeWidth = 3.dp.toPx(),
                    cap = StrokeCap.Round
                )
            }

            // Center Deck Label & BPM
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "DECK ${deck.id}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White
                )
                Text(
                    text = String.format("%.1f BPM", deck.effectiveBpm),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White.copy(alpha = 0.9f)
                )
            }
        }
    }
}
