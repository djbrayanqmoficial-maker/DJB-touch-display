package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import com.djbrayan.djbtouchdisplaynative.model.CrossfaderCurve
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.model.MixerState
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Center Rack Column — Dual channel faders, multi-segment VU meters, master volume,
 * and crossfader controls.
 * Faithful reproduction of CenterRackColumn.tsx.
 */
@Composable
fun CenterRackColumn(
    deckA: DeckState,
    deckB: DeckState,
    mixer: MixerState,
    onVolumeAChange: (Float) -> Unit,
    onVolumeBChange: (Float) -> Unit,
    onFilterAChange: (Float) -> Unit,
    onFilterBChange: (Float) -> Unit,
    onMasterChange: (Float) -> Unit,
    onCrossfaderChange: (Float) -> Unit,
    onSelectSection: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .width(170.dp)
            .fillMaxHeight()
            .background(Color(0xFF1E2126))
            .border(width = 1.dp, color = DjbColors.Border)
            .padding(vertical = 4.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Master Volume & Headphone Section
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TouchKnob(
                value = mixer.masterVolume * 100f,
                onValueChange = { onMasterChange(it / 100f) },
                label = "MASTER",
                minVal = 0f,
                maxVal = 100f,
                defaultVal = 85f,
                bipolar = false,
                activeColor = Color.White,
                sizeDp = 38
            )

            // Section quick jump button
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xFF25282F))
                    .border(width = 1.dp, color = DjbColors.BorderLight, shape = RoundedCornerShape(3.dp))
                    .clickable { onSelectSection() }
                    .padding(horizontal = 6.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "EQ / FX",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = DjbColors.Cyan
                )
            }

            TouchKnob(
                value = deckA.filterValue,
                onValueChange = { onFilterAChange(it) },
                label = "FILTER A",
                minVal = -100f,
                maxVal = 100f,
                defaultVal = 0f,
                bipolar = true,
                activeColor = DjbColors.Cyan,
                sizeDp = 38
            )
        }

        // Dual Channel Faders + VU Meters
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Deck A Channel Fader
            VerticalFader(
                value = deckA.volume,
                onValueChange = onVolumeAChange,
                label = "VOL A",
                activeColor = DjbColors.Cyan,
                modifier = Modifier.fillMaxHeight()
            )

            // Dual Stereo VU Meters
            Row(
                modifier = Modifier
                    .fillMaxHeight(0.85f)
                    .width(22.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color(0xFF141619))
                    .padding(2.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                VuMeterBar(level = mixer.vuMeterDeckA, modifier = Modifier.weight(1f))
                VuMeterBar(level = mixer.vuMeterDeckB, modifier = Modifier.weight(1f))
            }

            // Deck B Channel Fader
            VerticalFader(
                value = deckB.volume,
                onValueChange = onVolumeBChange,
                label = "VOL B",
                activeColor = DjbColors.Cyan,
                modifier = Modifier.fillMaxHeight()
            )
        }
    }
}

@Composable
fun VuMeterBar(
    level: Float,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxHeight(),
        verticalArrangement = Arrangement.Bottom
    ) {
        val segmentCount = 12
        val activeSegments = (level * segmentCount).toInt().coerceIn(0, segmentCount)

        for (i in (segmentCount - 1) downTo 0) {
            val isActive = i < activeSegments
            val segColor = when {
                i >= 10 -> DjbColors.Red
                i >= 7 -> DjbColors.Amber
                else -> DjbColors.Green
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(vertical = 0.5.dp)
                    .background(if (isActive) segColor else Color(0xFF22252A))
            )
        }
    }
}
