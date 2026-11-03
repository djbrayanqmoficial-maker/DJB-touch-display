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
 * DJB Mixer Section View — Full expanded studio mixer with dual 3-band EQ,
 * kill switches, gain knobs, channel faders, and crossfader curves.
 * Faithful reproduction of MainSection.MIXER_EQ.
 */
@Composable
fun MixerSectionView(
    deckA: DeckState,
    deckB: DeckState,
    mixer: MixerState,
    onEqChangeA: (high: Float, mid: Float, low: Float) -> Unit,
    onEqChangeB: (high: Float, mid: Float, low: Float) -> Unit,
    onFilterChangeA: (Float) -> Unit,
    onFilterChangeB: (Float) -> Unit,
    onVolumeAChange: (Float) -> Unit,
    onVolumeBChange: (Float) -> Unit,
    onCrossfaderChange: (Float) -> Unit,
    onMasterChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141619))
            .padding(8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // ==========================================
        // DECK A EQ STRIP
        // ==========================================
        EqStrip(
            deckId = "A",
            deck = deckA,
            onEqChange = onEqChangeA,
            onFilterChange = onFilterChangeA,
            modifier = Modifier.weight(1f)
        )

        // ==========================================
        // CENTER MASTER, FADERS & VU METERS
        // ==========================================
        Column(
            modifier = Modifier
                .width(220.dp)
                .fillMaxHeight()
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF1E2126))
                .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(4.dp))
                .padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Master & Headphone Knobs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                TouchKnob(
                    value = mixer.masterVolume * 100f,
                    onValueChange = { onMasterChange(it / 100f) },
                    label = "MASTER",
                    minVal = 0f,
                    maxVal = 100f,
                    defaultVal = 85f,
                    bipolar = false,
                    activeColor = Color.White
                )

                TouchKnob(
                    value = mixer.pflVolume * 100f,
                    onValueChange = { },
                    label = "BOOTH",
                    minVal = 0f,
                    maxVal = 100f,
                    defaultVal = 70f,
                    bipolar = false,
                    activeColor = DjbColors.Amber
                )
            }

            // Dual Channel Faders + Stereo Master VU
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                VerticalFader(
                    value = deckA.volume,
                    onValueChange = onVolumeAChange,
                    label = "CH A",
                    activeColor = DjbColors.Cyan,
                    modifier = Modifier.fillMaxHeight()
                )

                // Stereo Master Meters
                Row(
                    modifier = Modifier
                        .fillMaxHeight(0.85f)
                        .width(26.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color(0xFF0F1114))
                        .padding(2.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    VuMeterBar(level = mixer.vuMeterLeft, modifier = Modifier.weight(1f))
                    VuMeterBar(level = mixer.vuMeterRight, modifier = Modifier.weight(1f))
                }

                VerticalFader(
                    value = deckB.volume,
                    onValueChange = onVolumeBChange,
                    label = "CH B",
                    activeColor = DjbColors.Cyan,
                    modifier = Modifier.fillMaxHeight()
                )
            }

            // Crossfader Strip
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "CROSSFADER",
                    fontSize = 8.sp,
                    fontFamily = FontFamily.Monospace,
                    color = DjbColors.TextSecondary,
                    modifier = Modifier.padding(bottom = 2.dp)
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(34.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(Color(0xFF141619))
                        .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(3.dp))
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    // Center marker
                    Box(
                        modifier = Modifier
                            .fillMaxHeight(0.7f)
                            .width(1.dp)
                            .background(Color(0xFF525761))
                    )

                    val offsetDp = (mixer.crossfaderPosition * 60f).dp
                    Box(
                        modifier = Modifier
                            .offset(x = offsetDp)
                            .width(32.dp)
                            .height(24.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(Color(0xFF2A2E36))
                            .border(width = 1.dp, color = Color.White, shape = RoundedCornerShape(3.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .fillMaxHeight(0.7f)
                                .background(Color.White)
                        )
                    }
                }
            }
        }

        // ==========================================
        // DECK B EQ STRIP (IDENTICAL CYAN PALETTE)
        // ==========================================
        EqStrip(
            deckId = "B",
            deck = deckB,
            onEqChange = onEqChangeB,
            onFilterChange = onFilterChangeB,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun EqStrip(
    deckId: String,
    deck: DeckState,
    onEqChange: (high: Float, mid: Float, low: Float) -> Unit,
    onFilterChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .padding(horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceEvenly
    ) {
        Text(
            text = "DECK $deckId 3-BAND ISOLATOR EQ",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = DjbColors.Cyan
        )

        // HIGH EQ
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            TouchKnob(
                value = deck.eqHighDb,
                onValueChange = { onEqChange(it, deck.eqMidDb, deck.eqLowDb) },
                label = "HI ${deck.eqHighDb.toInt()}dB",
                activeColor = DjbColors.Cyan
            )
            KillButton(
                isKilled = deck.eqHighDb <= -20f,
                onToggle = {
                    val next = if (deck.eqHighDb <= -20f) 0f else -24f
                    onEqChange(next, deck.eqMidDb, deck.eqLowDb)
                }
            )
        }

        // MID EQ
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            TouchKnob(
                value = deck.eqMidDb,
                onValueChange = { onEqChange(deck.eqHighDb, it, deck.eqLowDb) },
                label = "MID ${deck.eqMidDb.toInt()}dB",
                activeColor = DjbColors.Cyan
            )
            KillButton(
                isKilled = deck.eqMidDb <= -20f,
                onToggle = {
                    val next = if (deck.eqMidDb <= -20f) 0f else -24f
                    onEqChange(deck.eqHighDb, next, deck.eqLowDb)
                }
            )
        }

        // LOW EQ
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            TouchKnob(
                value = deck.eqLowDb,
                onValueChange = { onEqChange(deck.eqHighDb, deck.eqMidDb, it) },
                label = "LOW ${deck.eqLowDb.toInt()}dB",
                activeColor = DjbColors.Cyan
            )
            KillButton(
                isKilled = deck.eqLowDb <= -20f,
                onToggle = {
                    val next = if (deck.eqLowDb <= -20f) 0f else -24f
                    onEqChange(deck.eqHighDb, deck.eqMidDb, next)
                }
            )
        }

        // COLOR FILTER
        TouchKnob(
            value = deck.filterValue,
            onValueChange = onFilterChange,
            label = "FILTER ${deck.filterValue.toInt()}",
            minVal = -100f,
            maxVal = 100f,
            defaultVal = 0f,
            activeColor = DjbColors.Cyan
        )
    }
}

@Composable
private fun KillButton(
    isKilled: Boolean,
    onToggle: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(if (isKilled) DjbColors.Red else Color(0xFF25282F))
            .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(2.dp))
            .clickable { onToggle() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "K",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = if (isKilled) Color.White else DjbColors.TextSecondary
        )
    }
}
