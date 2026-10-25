package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.DeckState
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

val DeckState.volume: Float get() = volumeFader
val DeckState.eqHighDb: Float get() = eq.high
val DeckState.eqMidDb: Float get() = eq.mid
val DeckState.eqLowDb: Float get() = eq.low

@Composable
fun MixerPanel(
    deckAState: DeckState,
    deckBState: DeckState,
    crossfader: Float,
    masterGain: Float,
    headphonesGain: Float,
    cueAActive: Boolean,
    cueBActive: Boolean,
    vuLeft: Float,
    vuRight: Float,
    vuDeckA: Float,
    vuDeckB: Float,
    onCrossfaderChange: (Float) -> Unit,
    onMasterGainChange: (Float) -> Unit,
    onHeadphonesGainChange: (Float) -> Unit,
    onToggleCueA: () -> Unit,
    onToggleCueB: () -> Unit,
    onVolumeAChange: (Float) -> Unit,
    onVolumeBChange: (Float) -> Unit,
    onEqHighA: (Float) -> Unit,
    onEqMidA: (Float) -> Unit,
    onEqLowA: (Float) -> Unit,
    onEqHighB: (Float) -> Unit,
    onEqMidB: (Float) -> Unit,
    onEqLowB: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(Color(0xFF101317), RoundedCornerShape(12.dp))
            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.SpaceBetween,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // --- 1. Top Section: Master & Headphones Controls + Master Stereo VU ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Master Gain
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("MASTER", color = DjbColors.TextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text("%d%%".format((masterGain * 100).toInt()), color = Color.White, fontSize = 9.sp)
                }
                Slider(
                    value = masterGain,
                    onValueChange = onMasterGainChange,
                    colors = SliderDefaults.colors(
                        thumbColor = Color.White,
                        activeTrackColor = Color.White,
                        inactiveTrackColor = Color(0xFF232830)
                    ),
                    modifier = Modifier.height(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Master Stereo VU Meters
            Row(
                modifier = Modifier
                    .width(36.dp)
                    .height(34.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                VerticalVuMeter(level = vuLeft, modifier = Modifier.weight(1f))
                VerticalVuMeter(level = vuRight, modifier = Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Headphones Gain
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("PHONES", color = DjbColors.TextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text("%d%%".format((headphonesGain * 100).toInt()), color = Color.White, fontSize = 9.sp)
                }
                Slider(
                    value = headphonesGain,
                    onValueChange = onHeadphonesGainChange,
                    colors = SliderDefaults.colors(
                        thumbColor = Color.White,
                        activeTrackColor = Color.White,
                        inactiveTrackColor = Color(0xFF232830)
                    ),
                    modifier = Modifier.height(20.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // --- 2. Middle Section: Dual 3-Band EQ (High, Mid, Low) ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            // Channel A EQ (Deck A)
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceEvenly
            ) {
                EqKnobRow(label = "HI", value = deckAState.eq.high, accent = DjbColors.DeckACyan, onChange = onEqHighA)
                EqKnobRow(label = "MID", value = deckAState.eq.mid, accent = DjbColors.DeckACyan, onChange = onEqMidA)
                EqKnobRow(label = "LOW", value = deckAState.eq.low, accent = DjbColors.DeckACyan, onChange = onEqLowA)

                // Headphone Cue Button Deck A
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.8f)
                        .height(24.dp)
                        .background(
                            if (cueAActive) DjbColors.DeckACyan.copy(alpha = 0.3f) else Color(0xFF161B22),
                            RoundedCornerShape(4.dp)
                        )
                        .border(1.dp, if (cueAActive) DjbColors.DeckACyan else DjbColors.PanelBorder, RoundedCornerShape(4.dp))
                        .clickable { onToggleCueA() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Headphones,
                        contentDescription = "Cue A",
                        tint = if (cueAActive) DjbColors.DeckACyan else DjbColors.TextSecondary,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            // Channel Volume Faders with Vertical VU Meters
            Row(
                modifier = Modifier.weight(1.2f),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Channel A Fader
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.weight(1f)
                ) {
                    VerticalVuMeter(
                        level = vuDeckA,
                        modifier = Modifier
                            .width(8.dp)
                            .height(65.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "%d%%".format(deckAState.volumeFader.toInt()),
                        color = DjbColors.DeckACyan,
                        fontSize = 9.sp
                    )
                    Slider(
                        value = deckAState.volumeFader,
                        onValueChange = onVolumeAChange,
                        valueRange = 0f..100f,
                        colors = SliderDefaults.colors(
                            thumbColor = DjbColors.DeckACyan,
                            activeTrackColor = DjbColors.DeckACyan,
                            inactiveTrackColor = Color(0xFF232830)
                        ),
                        modifier = Modifier.height(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                // Channel B Fader
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.weight(1f)
                ) {
                    VerticalVuMeter(
                        level = vuDeckB,
                        modifier = Modifier
                            .width(8.dp)
                            .height(65.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "%d%%".format(deckBState.volumeFader.toInt()),
                        color = DjbColors.DeckBOrange,
                        fontSize = 9.sp
                    )
                    Slider(
                        value = deckBState.volumeFader,
                        onValueChange = onVolumeBChange,
                        valueRange = 0f..100f,
                        colors = SliderDefaults.colors(
                            thumbColor = DjbColors.DeckBOrange,
                            activeTrackColor = DjbColors.DeckBOrange,
                            inactiveTrackColor = Color(0xFF232830)
                        ),
                        modifier = Modifier.height(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            // Channel B EQ (Deck B)
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceEvenly
            ) {
                EqKnobRow(label = "HI", value = deckBState.eq.high, accent = DjbColors.DeckBOrange, onChange = onEqHighB)
                EqKnobRow(label = "MID", value = deckBState.eq.mid, accent = DjbColors.DeckBOrange, onChange = onEqMidB)
                EqKnobRow(label = "LOW", value = deckBState.eq.low, accent = DjbColors.DeckBOrange, onChange = onEqLowB)

                // Headphone Cue Button Deck B
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.8f)
                        .height(24.dp)
                        .background(
                            if (cueBActive) DjbColors.DeckBOrange.copy(alpha = 0.3f) else Color(0xFF161B22),
                            RoundedCornerShape(4.dp)
                        )
                        .border(1.dp, if (cueBActive) DjbColors.DeckBOrange else DjbColors.PanelBorder, RoundedCornerShape(4.dp))
                        .clickable { onToggleCueB() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Headphones,
                        contentDescription = "Cue B",
                        tint = if (cueBActive) DjbColors.DeckBOrange else DjbColors.TextSecondary,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // --- 3. Bottom Section: Crossfader (A <-> B) ---
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("A", color = DjbColors.DeckACyan, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                Text("CROSSFADER", color = DjbColors.TextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Text("B", color = DjbColors.DeckBOrange, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
            }
            Slider(
                value = crossfader,
                onValueChange = onCrossfaderChange,
                colors = SliderDefaults.colors(
                    thumbColor = Color.White,
                    activeTrackColor = DjbColors.DeckACyan,
                    inactiveTrackColor = DjbColors.DeckBOrange
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(30.dp)
            )
        }
    }
}

@Composable
fun EqKnobRow(
    label: String,
    value: Float,
    accent: Color,
    onChange: (Float) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = DjbColors.TextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Slider(
            value = value,
            onValueChange = onChange,
            valueRange = -24f..6f,
            colors = SliderDefaults.colors(
                thumbColor = accent,
                activeTrackColor = accent,
                inactiveTrackColor = Color(0xFF232830)
            ),
            modifier = Modifier
                .weight(1f)
                .height(18.dp)
        )
    }
}

@Composable
fun VerticalVuMeter(
    level: Float,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .background(Color(0xFF090B0E), RoundedCornerShape(2.dp))
            .border(0.5.dp, Color(0xFF1E242E), RoundedCornerShape(2.dp))
    ) {
        val width = size.width
        val height = size.height
        val segments = 12
        val segHeight = height / segments.toFloat()
        val litCount = (level.coerceIn(0f, 1f) * segments).toInt()

        for (i in 0 until segments) {
            val fromBottom = segments - 1 - i
            val isLit = fromBottom < litCount
            val segColor = when {
                i < 2 -> DjbColors.VuRed
                i < 5 -> DjbColors.VuYellow
                else -> DjbColors.VuGreen
            }

            drawRect(
                color = if (isLit) segColor else Color(0xFF12161C),
                topLeft = Offset(1f, i * segHeight + 1f),
                size = Size(width - 2f, segHeight - 2f)
            )
        }
    }
}
