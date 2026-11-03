package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Vertical Fader — Precise volume/tempo fader with custom tactile thumb.
 * Faithful reproduction of VerticalFader.tsx.
 */
@Composable
fun VerticalFader(
    value: Float, // 0.0 .. 1.0 (or -1.0 .. 1.0)
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    minVal: Float = 0.0f,
    maxVal: Float = 1.0f,
    activeColor: Color = DjbColors.Cyan
) {
    var heightPx by remember { mutableIntStateOf(0) }
    val normalized = ((value - minVal) / (maxVal - minVal)).coerceIn(0f, 1f)

    Column(
        modifier = modifier.width(44.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (label != null) {
            Text(
                text = label,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary,
                modifier = Modifier.padding(bottom = 2.dp)
            )
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .width(28.dp)
                .onSizeChanged { heightPx = it.height }
                .pointerInput(minVal, maxVal) {
                    detectVerticalDragGestures { change, dragAmount ->
                        change.consume()
                        if (heightPx > 0) {
                            val deltaNorm = -dragAmount / heightPx.toFloat()
                            val currentNorm = ((value - minVal) / (maxVal - minVal))
                            val newNorm = (currentNorm + deltaNorm).coerceIn(0f, 1f)
                            val finalVal = minVal + (newNorm * (maxVal - minVal))
                            onValueChange(finalVal)
                        }
                    }
                },
            contentAlignment = Alignment.BottomCenter
        ) {
            // Track Groove
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xFF141619))
            )

            // Fill Bar
            Box(
                modifier = Modifier
                    .fillMaxHeight(fraction = normalized)
                    .width(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(activeColor.copy(alpha = 0.7f))
            )

            // Tactile Metallic Thumb Handle
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = ((heightPx.toFloat() * normalized) - 14f).coerceAtLeast(0f).dp / 2.75f)
                    .width(28.dp)
                    .height(26.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xFF2A2E36))
            ) {
                // Center White Line Marker
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth(0.8f)
                        .height(2.dp)
                        .background(Color.White)
                )
            }
        }
    }
}
