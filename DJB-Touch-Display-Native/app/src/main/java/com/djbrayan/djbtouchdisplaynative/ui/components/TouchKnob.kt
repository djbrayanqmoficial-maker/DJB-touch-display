package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors
import kotlin.math.cos
import kotlin.math.sin

/**
 * DJB Touch Knob — Rotary potentiometer with centered or unipolar arc.
 * Faithful reproduction of TouchKnob.tsx.
 */
@Composable
fun TouchKnob(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    label: String = "",
    minVal: Float = -12f,
    maxVal: Float = 12f,
    defaultVal: Float = 0f,
    bipolar: Boolean = true,
    activeColor: Color = DjbColors.Cyan,
    sizeDp: Int = 46
) {
    val norm = ((value - minVal) / (maxVal - minVal)).coerceIn(0f, 1f)
    // 270 degrees sweep from 135 deg to 405 deg
    val startAngle = 135f
    val sweepAngle = 270f
    val currentAngle = startAngle + (norm * sweepAngle)

    Column(
        modifier = modifier.width(sizeDp.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(sizeDp.dp)
                .pointerInput(minVal, maxVal) {
                    detectVerticalDragGestures { change, dragAmount ->
                        change.consume()
                        val deltaNorm = -dragAmount / 120f
                        val currentNorm = ((value - minVal) / (maxVal - minVal))
                        val newNorm = (currentNorm + deltaNorm).coerceIn(0f, 1f)
                        val newVal = minVal + (newNorm * (maxVal - minVal))
                        onValueChange(newVal)
                    }
                }
                .pointerInput(defaultVal) {
                    detectTapGestures(onDoubleTap = { onValueChange(defaultVal) })
                },
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val strokeWidth = 3.5.dp.toPx()
                val diameter = size.minDimension - strokeWidth * 2
                val topLeft = Offset(strokeWidth, strokeWidth)
                val arcSize = Size(diameter, diameter)

                // Background track
                drawArc(
                    color = Color(0xFF1E2126),
                    startAngle = startAngle,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )

                // Active Arc
                if (bipolar) {
                    val centerAngle = startAngle + (sweepAngle / 2f)
                    val arcSweep = currentAngle - centerAngle
                    drawArc(
                        color = activeColor,
                        startAngle = centerAngle,
                        sweepAngle = arcSweep,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                    )
                } else {
                    drawArc(
                        color = activeColor,
                        startAngle = startAngle,
                        sweepAngle = norm * sweepAngle,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                    )
                }

                // Inner knob body
                drawCircle(
                    color = Color(0xFF25282F),
                    radius = (diameter / 2f) - strokeWidth
                )

                // Needle pointer
                val rad = Math.toRadians(currentAngle.toDouble())
                val center = Offset(size.width / 2f, size.height / 2f)
                val innerR = (diameter / 2f) - (strokeWidth * 3.5f)
                val outerR = (diameter / 2f) - strokeWidth
                val startPt = Offset(
                    (center.x + innerR * cos(rad)).toFloat(),
                    (center.y + innerR * sin(rad)).toFloat()
                )
                val endPt = Offset(
                    (center.x + outerR * cos(rad)).toFloat(),
                    (center.y + outerR * sin(rad)).toFloat()
                )
                drawLine(
                    color = Color.White,
                    start = startPt,
                    end = endPt,
                    strokeWidth = 2.5.dp.toPx(),
                    cap = StrokeCap.Round
                )
            }
        }

        if (label.isNotEmpty()) {
            Text(
                text = label,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary,
                modifier = Modifier.padding(top = 1.dp)
            )
        }
    }
}
