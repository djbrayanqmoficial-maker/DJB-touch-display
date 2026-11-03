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
import com.djbrayan.djbtouchdisplaynative.audio.FX_BEAT_DIVISIONS
import com.djbrayan.djbtouchdisplaynative.audio.FX_CATALOG
import com.djbrayan.djbtouchdisplaynative.model.FxSlotState
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Effects Rack View — Dedicated 3-unit multi-effects rack for Deck A and Deck B.
 * Faithful reproduction of MainSection.FX.
 */
@Composable
fun EffectsRackView(
    fxUnitsA: List<FxSlotState>,
    fxUnitsB: List<FxSlotState>,
    onToggleFxA: (slotIndex: Int) -> Unit,
    onToggleFxB: (slotIndex: Int) -> Unit,
    onCycleEffectA: (slotIndex: Int) -> Unit,
    onCycleEffectB: (slotIndex: Int) -> Unit,
    onWetDryChangeA: (slotIndex: Int, percent: Float) -> Unit,
    onWetDryChangeB: (slotIndex: Int, percent: Float) -> Unit,
    onParamChangeA: (slotIndex: Int, percent: Float) -> Unit,
    onParamChangeB: (slotIndex: Int, percent: Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141619))
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Deck A FX
        DeckFxRack(
            deckId = "A",
            fxUnits = fxUnitsA,
            onToggleFx = onToggleFxA,
            onCycleEffect = onCycleEffectA,
            onWetDryChange = onWetDryChangeA,
            onParamChange = onParamChangeA,
            modifier = Modifier.weight(1f)
        )

        // Divider
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .width(1.dp)
                .background(Color(0xFF2A2E36))
        )

        // Deck B FX
        DeckFxRack(
            deckId = "B",
            fxUnits = fxUnitsB,
            onToggleFx = onToggleFxB,
            onCycleEffect = onCycleEffectB,
            onWetDryChange = onWetDryChangeB,
            onParamChange = onParamChangeB,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun DeckFxRack(
    deckId: String,
    fxUnits: List<FxSlotState>,
    onToggleFx: (Int) -> Unit,
    onCycleEffect: (Int) -> Unit,
    onWetDryChange: (Int, Float) -> Unit,
    onParamChange: (Int, Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = "DECK $deckId — 3-UNIT DSP BEAT FX RACK",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = DjbColors.Cyan
        )

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            fxUnits.forEachIndexed { idx, unit ->
                SingleFxUnitCard(
                    slotIndex = idx,
                    unit = unit,
                    onToggle = { onToggleFx(idx) },
                    onCycle = { onCycleEffect(idx) },
                    onWetDry = { onWetDryChange(idx, it) },
                    onParam = { onParamChange(idx, it) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun SingleFxUnitCard(
    slotIndex: Int,
    unit: FxSlotState,
    onToggle: () -> Unit,
    onCycle: () -> Unit,
    onWetDry: (Float) -> Unit,
    onParam: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFF1E2126))
            .border(
                width = 1.dp,
                color = if (unit.isEnabled) DjbColors.Cyan else DjbColors.Border,
                shape = RoundedCornerShape(4.dp)
            )
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Effect Name Badge (Click to cycle effect)
        Column(
            modifier = Modifier
                .width(100.dp)
                .clickable { onCycle() }
        ) {
            Text(
                text = "UNIT ${slotIndex + 1}",
                fontSize = 8.sp,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary
            )
            Text(
                text = unit.name,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = if (unit.isEnabled) DjbColors.Cyan else Color.White
            )
            Text(
                text = "TAP TO CHANGE",
                fontSize = 7.sp,
                color = DjbColors.TextMuted
            )
        }

        // Wet / Dry Knob
        TouchKnob(
            value = unit.wetDryPercent,
            onValueChange = onWetDry,
            label = "WET/DRY ${unit.wetDryPercent.toInt()}%",
            minVal = 0f,
            maxVal = 100f,
            defaultVal = 0f,
            bipolar = false,
            activeColor = DjbColors.Cyan,
            sizeDp = 38
        )

        // Parameter Knob
        TouchKnob(
            value = unit.parameterPercent,
            onValueChange = onParam,
            label = "PARAM ${unit.parameterPercent.toInt()}%",
            minVal = 0f,
            maxVal = 100f,
            defaultVal = 50f,
            bipolar = false,
            activeColor = DjbColors.Amber,
            sizeDp = 38
        )

        // Power On / Off Latch Button
        Box(
            modifier = Modifier
                .width(54.dp)
                .height(34.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(if (unit.isEnabled) DjbColors.Cyan else Color(0xFF25282F))
                .border(
                    width = 1.dp,
                    color = if (unit.isEnabled) Color.White else DjbColors.BorderLight,
                    shape = RoundedCornerShape(3.dp)
                )
                .clickable { onToggle() },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (unit.isEnabled) "ON" else "OFF",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = if (unit.isEnabled) Color.Black else Color.White
            )
        }
    }
}
