package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
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
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Vertical Fader — Migrated with 100% fidelity from VerticalFader.tsx
 * Professional DJ channel and tempo fader with touch drag and center detents.
 */
@Composable
fun VerticalFader(
    label: String,
    value: Float,
    min: Float,
    max: Float,
    defaultValue: Float = 0f,
    capStyle: String = "light", // "light", "dark", "tempo"
    bottomCaption: String? = null,
    onChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    val norm = ((value - min) / (max - min)).coerceIn(0f, 1f)

    Column(
        modifier = modifier
            .fillMaxHeight()
            .width(42.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Label at top
        Text(
            text = label,
            color = if (capStyle == "tempo") DjbColors.Cyan else DjbColors.TextSecondary,
            fontSize = 9.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold
        )

        // Vertical Fader Track Canvas
        Canvas(
            modifier = Modifier
                .width(36.dp)
                .weight(1f)
                .padding(vertical = 4.dp)
                .pointerInput(min, max) {
                    detectTapGestures { offset ->
                        val ratio = 1f - (offset.y / size.height).coerceIn(0f, 1f)
                        val newVal = min + (ratio * (max - min))
                        onChange(newVal)
                    }
                }
                .pointerInput(min, max) {
                    detectDragGestures { change, _ ->
                        change.consume()
                        val ratio = 1f - (change.position.y / size.height).coerceIn(0f, 1f)
                        val newVal = min + (ratio * (max - min))
                        onChange(newVal)
                    }
                }
        ) {
            val width = size.width
            val height = size.height
            val centerX = width / 2f

            // Rail Slot
            drawRoundRect(
                color = Color(0xFF0F1115),
                topLeft = Offset(centerX - 3f, 0f),
                size = Size(6f, height),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f, 3f)
            )

            // Center Notch (0 dB or 0% detent)
            val centerDetentY = height * (1f - ((defaultValue - min) / (max - min)))
            drawLine(
                color = Color(0xFF525761),
                start = Offset(centerX - 8f, centerDetentY),
                end = Offset(centerX + 8f, centerDetentY),
                strokeWidth = 1.5f
            )

            // Fader Cap
            val capW = 28f
            val capH = 26f
            val capY = (height - (norm * height) - (capH / 2f)).coerceIn(0f, height - capH)
            val capX = centerX - capW / 2f

            val capColor = when (capStyle) {
                "dark" -> Color(0xFF262A32)
                "tempo" -> Color(0xFF1E232B)
                else -> Color(0xFF525761)
            }

            drawRoundRect(
                color = capColor,
                topLeft = Offset(capX, capY),
                size = Size(capW, capH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f, 3f)
            )

            // Cap center line
            drawLine(
                color = if (capStyle == "tempo") DjbColors.Cyan else Color.White,
                start = Offset(capX + 3f, capY + capH / 2f),
                end = Offset(capX + capW - 3f, capY + capH / 2f),
                strokeWidth = 2f
            )
        }

        // Optional bottom caption (e.g. TEMPO)
        if (bottomCaption != null) {
            Text(
                text = bottomCaption,
                color = DjbColors.TextMuted,
                fontSize = 8.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

/**
 * Touch Rotary Knob — Migrated with 100% fidelity from TouchKnob.tsx
 * Tactile circular knob with drag control for GAIN.
 */
@Composable
fun TouchKnob(
    label: String,
    value: Float,
    min: Float,
    max: Float,
    defaultValue: Float = 0f,
    onChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    val norm = ((value - min) / (max - min)).coerceIn(0f, 1f)
    // Angle from -135 deg to +135 deg
    val angleDeg = -135f + (norm * 270f)

    Column(
        modifier = modifier.width(46.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(
            text = label,
            color = DjbColors.TextSecondary,
            fontSize = 9.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold
        )

        Canvas(
            modifier = Modifier
                .size(36.dp)
                .pointerInput(min, max) {
                    detectDragGestures { change, dragAmount ->
                        change.consume()
                        val delta = -dragAmount.y * 0.005f
                        val newNorm = (norm + delta).coerceIn(0f, 1f)
                        val newVal = min + (newNorm * (max - min))
                        onChange(newVal)
                    }
                }
        ) {
            val radius = size.minDimension / 2f
            val center = Offset(size.width / 2f, size.height / 2f)

            // Outer ring base
            drawCircle(color = Color(0xFF1E2229), radius = radius, center = center)
            drawCircle(color = Color(0xFF383D47), radius = radius, center = center, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.5f))

            // Center Knob Body
            val innerR = radius * 0.75f
            drawCircle(color = Color(0xFF282D36), radius = innerR, center = center)

            // Indicator line
            val rad = (angleDeg - 90f) * (PI / 180f).toFloat()
            val endX = center.x + cos(rad) * innerR
            val endY = center.y + sin(rad) * innerR

            drawLine(
                color = DjbColors.Cyan,
                start = center,
                end = Offset(endX, endY),
                strokeWidth = 2.5f,
                cap = androidx.compose.ui.graphics.StrokeCap.Round
            )
        }
    }
}
