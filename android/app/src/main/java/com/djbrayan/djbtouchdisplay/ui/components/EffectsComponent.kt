package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.audio.*
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

@Composable
fun EffectsPanel(
    selectedEffect: EffectType,
    reverb: ReverbParams,
    delay: DelayParams,
    flanger: FlangerParams,
    filterSweep: FilterSweepParams,
    padX: Float,
    padY: Float,
    isPadActive: Boolean,
    onSelectEffect: (EffectType) -> Unit,
    onToggleEffect: (EffectType) -> Unit,
    onXyPadChange: (Float, Float, Boolean) -> Unit,
    onReverbGainChange: (Float) -> Unit,
    onReverbDecayChange: (Float) -> Unit,
    onDelayFeedbackChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF101317), RoundedCornerShape(12.dp))
            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // --- Left: Effect Tabs & Parameter Knobs ---
        Column(
            modifier = Modifier
                .width(260.dp)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("FX ENGINE (ANTI-SATURATION)", color = DjbColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)

                // Effect Selection Buttons
                EffectType.entries.forEach { effect ->
                    val isSelected = effect == selectedEffect
                    val isEnabled = when (effect) {
                        EffectType.REVERB -> reverb.isEnabled
                        EffectType.ECHO_DELAY -> delay.isEnabled
                        EffectType.FLANGER -> flanger.isEnabled
                        EffectType.FILTER_SWEEP -> filterSweep.isEnabled
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                if (isSelected) Color(0xFF1E242E) else Color(0xFF14181F),
                                RoundedCornerShape(6.dp)
                            )
                            .border(
                                1.dp,
                                if (isSelected) DjbColors.DeckACyan else DjbColors.PanelBorder,
                                RoundedCornerShape(6.dp)
                            )
                            .clickable { onSelectEffect(effect) }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = effect.displayName,
                            color = if (isSelected) Color.White else DjbColors.TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )

                        // Toggle ON/OFF
                        Box(
                            modifier = Modifier
                                .background(
                                    if (isEnabled) DjbColors.PlayGreen else Color(0xFF232830),
                                    RoundedCornerShape(4.dp)
                                )
                                .clickable { onToggleEffect(effect) }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = if (isEnabled) "ON" else "OFF",
                                color = if (isEnabled) Color.Black else DjbColors.TextSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }

            // Fine-tune parameters for currently selected effect
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                when (selectedEffect) {
                    EffectType.REVERB -> {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("WET GAIN (SAFE CEILING)", color = DjbColors.TextSecondary, fontSize = 10.sp)
                            Text("%.1f%%".format(reverb.wetGain * 100), color = DjbColors.DeckACyan, fontSize = 10.sp)
                        }
                        Slider(
                            value = reverb.wetGain,
                            onValueChange = onReverbGainChange,
                            valueRange = 0f..0.40f,
                            colors = SliderDefaults.colors(
                                thumbColor = DjbColors.DeckACyan,
                                activeTrackColor = DjbColors.DeckACyan
                            ),
                            modifier = Modifier.height(20.dp)
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("DECAY TIME", color = DjbColors.TextSecondary, fontSize = 10.sp)
                            Text("%.1fs".format(reverb.decayTimeSec), color = DjbColors.DeckACyan, fontSize = 10.sp)
                        }
                        Slider(
                            value = reverb.decayTimeSec,
                            onValueChange = onReverbDecayChange,
                            valueRange = 1.0f..6.0f,
                            colors = SliderDefaults.colors(
                                thumbColor = DjbColors.DeckACyan,
                                activeTrackColor = DjbColors.DeckACyan
                            ),
                            modifier = Modifier.height(20.dp)
                        )
                    }
                    EffectType.ECHO_DELAY -> {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("FEEDBACK", color = DjbColors.TextSecondary, fontSize = 10.sp)
                            Text("%.0f%%".format(delay.feedback * 100), color = DjbColors.DeckACyan, fontSize = 10.sp)
                        }
                        Slider(
                            value = delay.feedback,
                            onValueChange = onDelayFeedbackChange,
                            valueRange = 0f..0.85f,
                            colors = SliderDefaults.colors(
                                thumbColor = DjbColors.DeckACyan,
                                activeTrackColor = DjbColors.DeckACyan
                            ),
                            modifier = Modifier.height(20.dp)
                        )
                    }
                    EffectType.FLANGER -> {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("FLANGER RATE", color = DjbColors.TextSecondary, fontSize = 10.sp)
                            Text("%.1f Hz".format(flanger.rateHz), color = DjbColors.DeckACyan, fontSize = 10.sp)
                        }
                        Slider(
                            value = flanger.rateHz,
                            onValueChange = {},
                            valueRange = 0.1f..2.0f,
                            colors = SliderDefaults.colors(
                                thumbColor = DjbColors.DeckACyan,
                                activeTrackColor = DjbColors.DeckACyan
                            ),
                            modifier = Modifier.height(20.dp)
                        )
                    }
                    EffectType.FILTER_SWEEP -> {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("RESONANCE", color = DjbColors.TextSecondary, fontSize = 10.sp)
                            Text("%.1f Q".format(filterSweep.resonance), color = DjbColors.DeckACyan, fontSize = 10.sp)
                        }
                        Slider(
                            value = filterSweep.resonance,
                            onValueChange = {},
                            valueRange = 0.5f..5.0f,
                            colors = SliderDefaults.colors(
                                thumbColor = DjbColors.DeckACyan,
                                activeTrackColor = DjbColors.DeckACyan
                            ),
                            modifier = Modifier.height(20.dp)
                        )
                    }
                }
            }
        }

        // --- Right: 2D XY Performance Pad ---
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "XY PERFORMANCE PAD · TOUCH & MODULATE",
                    color = DjbColors.TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "X: ${(padX * 100).toInt()}%  Y: ${(padY * 100).toInt()}%",
                    color = DjbColors.DeckACyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(Color(0xFF090B0E), RoundedCornerShape(8.dp))
                    .border(1.5.dp, if (isPadActive) DjbColors.DeckACyan else DjbColors.PanelBorder, RoundedCornerShape(8.dp))
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onPress = { offset ->
                                val xFrac = (offset.x / size.width).coerceIn(0f, 1f)
                                val yFrac = (1f - (offset.y / size.height)).coerceIn(0f, 1f)
                                onXyPadChange(xFrac, yFrac, true)
                                tryAwaitRelease()
                                onXyPadChange(xFrac, yFrac, false)
                            }
                        )
                    }
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragEnd = { onXyPadChange(padX, padY, false) },
                            onDragCancel = { onXyPadChange(padX, padY, false) }
                        ) { change, _ ->
                            change.consume()
                            val xFrac = (change.position.x / size.width).coerceIn(0f, 1f)
                            val yFrac = (1f - (change.position.y / size.height)).coerceIn(0f, 1f)
                            onXyPadChange(xFrac, yFrac, true)
                        }
                    }
            ) {
                val width = size.width
                val height = size.height

                // Grid lines
                for (i in 1..3) {
                    val lineX = width * (i / 4f)
                    drawLine(Color(0x1AFFFFFF), Offset(lineX, 0f), Offset(lineX, height), strokeWidth = 1f)
                    val lineY = height * (i / 4f)
                    drawLine(Color(0x1AFFFFFF), Offset(0f, lineY), Offset(width, lineY), strokeWidth = 1f)
                }

                // Puck / Cursor Position
                val puckX = padX * width
                val puckY = (1f - padY) * height

                // Crosshair
                drawLine(
                    color = DjbColors.DeckACyan.copy(alpha = 0.3f),
                    start = Offset(puckX, 0f),
                    end = Offset(puckX, height),
                    strokeWidth = 1.5f
                )
                drawLine(
                    color = DjbColors.DeckACyan.copy(alpha = 0.3f),
                    start = Offset(0f, puckY),
                    end = Offset(width, puckY),
                    strokeWidth = 1.5f
                )

                // Glowing Puck Circle
                drawCircle(
                    color = if (isPadActive) DjbColors.DeckACyan else Color.White,
                    radius = if (isPadActive) 16f else 10f,
                    center = Offset(puckX, puckY)
                )
                drawCircle(
                    color = DjbColors.DeckACyan.copy(alpha = 0.35f),
                    radius = if (isPadActive) 28f else 18f,
                    center = Offset(puckX, puckY)
                )
            }
        }
    }
}
