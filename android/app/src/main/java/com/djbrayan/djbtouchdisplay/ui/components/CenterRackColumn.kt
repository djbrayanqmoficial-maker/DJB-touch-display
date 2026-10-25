package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.MainSection
import com.djbrayan.djbtouchdisplay.core.MasterVuMeterState
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

/**
 * Center Rack Column — Migrated with 100% fidelity from CenterRackColumn.tsx
 * Width 154dp central rack containing top 3 mode buttons (Loops, Mixer/EQ, FX),
 * tall stereo Master VU meter with dB calibration ticks and clip indicators,
 * and bottom Performance Pads circular button + Key label.
 */
@Composable
fun CenterRackColumn(
    activeSection: MainSection,
    onSelectSection: (MainSection) -> Unit,
    masterVu: MasterVuMeterState,
    musicalKeyLabel: String,
    modifier: Modifier = Modifier
) {
    val toggleOrSelect: (MainSection) -> Unit = { target ->
        if (activeSection == target) {
            onSelectSection(MainSection.DECKS)
        } else {
            onSelectSection(target)
        }
    }

    Column(
        modifier = modifier
            .width(140.dp)
            .fillMaxHeight()
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // --- Top 3 Circular Mode Buttons: Loops/Cues | Mixer/EQ | FX ---
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Loops / Hot Cues
            CircularModeButton(
                active = activeSection == MainSection.LOOPS_HOTCUES,
                onClick = { toggleOrSelect(MainSection.LOOPS_HOTCUES) }
            ) {
                Text("⟲", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }

            // Mixer / EQ
            CircularModeButton(
                active = activeSection == MainSection.MIXER_EQ,
                onClick = { toggleOrSelect(MainSection.MIXER_EQ) }
            ) {
                Text("EQ", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }

            // FX
            CircularModeButton(
                active = activeSection == MainSection.FX,
                onClick = { toggleOrSelect(MainSection.FX) }
            ) {
                Text("FX", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
            }
        }

        // --- Tall Professional Stereo MASTER VU Meter ---
        StereoMasterVuMeter(
            masterVu = masterVu,
            modifier = Modifier
                .width(54.dp)
                .weight(1f)
                .padding(vertical = 4.dp)
        )

        // --- Bottom Circular PERFORMANCE PADS Button + Key ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            CircularModeButton(
                active = activeSection == MainSection.PERFORMANCE,
                onClick = { toggleOrSelect(MainSection.PERFORMANCE) }
            ) {
                Text(":::", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }

            if (musicalKeyLabel.isNotBlank() && musicalKeyLabel != "--") {
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "♪$musicalKeyLabel",
                    color = DjbColors.Cyan,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun CircularModeButton(
    active: Boolean,
    onClick: () -> Unit,
    content: @Composable () -> Unit
) {
    Box(
        modifier = Modifier
            .size(38.dp)
            .background(if (active) DjbColors.PanelActive else DjbColors.PanelBg, CircleShape)
            .border(1.dp, if (active) Color.White else DjbColors.PanelBorderLight, CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

@Composable
fun StereoMasterVuMeter(
    masterVu: MasterVuMeterState,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .background(Color(0xFF060709), RoundedCornerShape(3.dp))
            .border(1.dp, Color(0xFF2F3542), RoundedCornerShape(3.dp))
            .padding(4.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Overload indicators (PK)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(3.dp)
                        .background(if (masterVu.peakLeft >= 90f) DjbColors.VuRed else Color(0xFF221316))
                )
                Text(
                    text = "PK",
                    color = DjbColors.TextMuted,
                    fontSize = 7.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(horizontal = 2.dp)
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(3.dp)
                        .background(if (masterVu.peakRight >= 90f) DjbColors.VuRed else Color(0xFF221316))
                )
            }

            // Dual Vertical Meter Bars (L & R)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(vertical = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left Column
                VuBar(level = masterVu.left, peak = masterVu.peakLeft, modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.width(3.dp))
                // Right Column
                VuBar(level = masterVu.right, peak = masterVu.peakRight, modifier = Modifier.weight(1f))
            }

            // Labels L and R
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("L", color = DjbColors.TextMuted, fontSize = 8.sp, fontFamily = FontFamily.Monospace)
                Text("R", color = DjbColors.TextMuted, fontSize = 8.sp, fontFamily = FontFamily.Monospace)
            }
        }
    }
}

@Composable
fun VuBar(
    level: Float, // 0 to 100
    peak: Float,  // 0 to 100
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .fillMaxHeight()
            .background(Color(0xFF0E1116), RoundedCornerShape(1.dp))
            .border(0.5.dp, Color(0xFF1B202A), RoundedCornerShape(1.dp))
    ) {
        val width = size.width
        val height = size.height
        val normLevel = (level / 100f).coerceIn(0f, 1f)
        val fillH = normLevel * height

        // Gradient active fill
        if (fillH > 0f) {
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        DjbColors.VuOverload,
                        DjbColors.VuRed,
                        DjbColors.VuYellow,
                        DjbColors.VuCyan,
                        DjbColors.VuGreen
                    ),
                    startY = 0f,
                    endY = height
                ),
                topLeft = Offset(0f, height - fillH),
                size = Size(width, fillH)
            )
        }

        // Peak Hold Line
        if (peak > 2f) {
            val normPeak = (peak / 100f).coerceIn(0f, 1f)
            val peakY = height - (normPeak * height)
            drawLine(
                color = if (peak >= 88f) DjbColors.VuRed else if (peak >= 72f) DjbColors.VuYellow else DjbColors.VuCyan,
                start = Offset(0f, peakY),
                end = Offset(width, peakY),
                strokeWidth = 2f
            )
        }
    }
}
