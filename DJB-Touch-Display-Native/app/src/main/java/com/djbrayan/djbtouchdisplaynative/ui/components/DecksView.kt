package com.djbrayan.djbtouchdisplaynative.ui.components

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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.model.MixerState
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Decks View — Primary performance workspace with dual turntables, tempo faders,
 * center rack, and floating waveform/grid controls.
 * Faithful reproduction of MainSection.DECKS.
 */
@Composable
fun DecksView(
    deckA: DeckState,
    deckB: DeckState,
    mixer: MixerState,
    beatGridOpen: Boolean,
    onToggleBeatGrid: () -> Unit,
    onOpenWaveforms: () -> Unit,
    onOpenMixer: () -> Unit,
    onScratchA: (Double) -> Unit,
    onScratchB: (Double) -> Unit,
    onPitchBendA: (Float) -> Unit,
    onPitchBendB: (Float) -> Unit,
    onPitchChangeA: (Float) -> Unit,
    onPitchChangeB: (Float) -> Unit,
    onVolumeAChange: (Float) -> Unit,
    onVolumeBChange: (Float) -> Unit,
    onFilterAChange: (Float) -> Unit,
    onFilterBChange: (Float) -> Unit,
    onMasterChange: (Float) -> Unit,
    onCrossfaderChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // ==========================================
            // DECK A TURNTABLE & TEMPO FADER
            // ==========================================
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(horizontal = 6.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Pitch / Tempo Slider A
                VerticalFader(
                    value = deckA.pitchPercent,
                    onValueChange = onPitchChangeA,
                    label = String.format("%+.1f%%", deckA.pitchPercent),
                    minVal = -16f,
                    maxVal = 16f,
                    activeColor = DjbColors.Cyan,
                    modifier = Modifier.fillMaxHeight(0.88f)
                )

                // Platter A
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    contentAlignment = Alignment.Center
                ) {
                    TurntablePlatter(
                        deck = deckA,
                        onScratch = onScratchA,
                        onPitchBend = onPitchBendA
                    )
                }
            }

            // ==========================================
            // CENTER MIXER RACK
            // ==========================================
            CenterRackColumn(
                deckA = deckA,
                deckB = deckB,
                mixer = mixer,
                onVolumeAChange = onVolumeAChange,
                onVolumeBChange = onVolumeBChange,
                onFilterAChange = onFilterAChange,
                onFilterBChange = onFilterBChange,
                onMasterChange = onMasterChange,
                onCrossfaderChange = onCrossfaderChange,
                onSelectSection = onOpenMixer
            )

            // ==========================================
            // DECK B TURNTABLE & TEMPO FADER
            // ==========================================
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(horizontal = 6.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Platter B
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    contentAlignment = Alignment.Center
                ) {
                    TurntablePlatter(
                        deck = deckB,
                        onScratch = onScratchB,
                        onPitchBend = onPitchBendB
                    )
                }

                // Pitch / Tempo Slider B
                VerticalFader(
                    value = deckB.pitchPercent,
                    onValueChange = onPitchChangeB,
                    label = String.format("%+.1f%%", deckB.pitchPercent),
                    minVal = -16f,
                    maxVal = 16f,
                    activeColor = DjbColors.Cyan,
                    modifier = Modifier.fillMaxHeight(0.88f)
                )
            }
        }

        // ==========================================
        // FLOATING CIRCULAR ACTION BUTTONS (TOP-LEFT)
        // ==========================================
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Circular Waveform Button
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF25282F))
                    .border(width = 1.dp, color = DjbColors.BorderLight, shape = CircleShape)
                    .clickable { onOpenWaveforms() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "〰",
                    fontSize = 16.sp,
                    color = DjbColors.TextPrimary
                )
            }

            // Circular Grid Editor Button
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(if (beatGridOpen) Color(0xFF3A3E46) else Color(0xFF25282F))
                    .border(
                        width = 1.dp,
                        color = if (beatGridOpen) DjbColors.Cyan else DjbColors.BorderLight,
                        shape = CircleShape
                    )
                    .clickable { onToggleBeatGrid() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "GRID",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = if (beatGridOpen) DjbColors.Cyan else DjbColors.TextPrimary
                )
            }
        }
    }
}
