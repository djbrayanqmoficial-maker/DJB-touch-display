package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

@Composable
fun SettingsPanel(
    keyLockA: Boolean,
    keyLockB: Boolean,
    onToggleKeyLockA: () -> Unit,
    onToggleKeyLockB: () -> Unit,
    modifier: Modifier = Modifier
) {
    var pitchRange by remember { mutableStateOf("16%") }
    var camelotNotation by remember { mutableStateOf(true) }
    var quantizeBeats by remember { mutableStateOf("1 Beat") }

    Row(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF101317), RoundedCornerShape(12.dp))
            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(12.dp))
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Left Column: Audio & DJ Performance Preferences
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("AUDIO & PERFORMANCE CONFIGURATION", color = DjbColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)

            // Key Lock / Master Tempo Deck A & B
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF14181F), RoundedCornerShape(6.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Master Tempo / Key Lock (Deck A)", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text("Preserve original pitch when changing tempo", color = DjbColors.TextSecondary, fontSize = 10.sp)
                }
                Switch(
                    checked = keyLockA,
                    onCheckedChange = { onToggleKeyLockA() },
                    colors = SwitchDefaults.colors(checkedThumbColor = DjbColors.DeckACyan, checkedTrackColor = DjbColors.DeckACyan.copy(alpha = 0.4f))
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF14181F), RoundedCornerShape(6.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Master Tempo / Key Lock (Deck B)", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text("Preserve original pitch when changing tempo", color = DjbColors.TextSecondary, fontSize = 10.sp)
                }
                Switch(
                    checked = keyLockB,
                    onCheckedChange = { onToggleKeyLockB() },
                    colors = SwitchDefaults.colors(checkedThumbColor = DjbColors.DeckBOrange, checkedTrackColor = DjbColors.DeckBOrange.copy(alpha = 0.4f))
                )
            }

            // Pitch Range Selector
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Pitch Fader Range", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("6%", "10%", "16%", "50%").forEach { range ->
                        val isSelected = pitchRange == range
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(32.dp)
                                .background(if (isSelected) DjbColors.DeckACyan.copy(alpha = 0.25f) else Color(0xFF14181F), RoundedCornerShape(6.dp))
                                .border(1.dp, if (isSelected) DjbColors.DeckACyan else DjbColors.PanelBorder, RoundedCornerShape(6.dp))
                                .clickable { pitchRange = range },
                            contentAlignment = Alignment.Center
                        ) {
                            Text("±$range", color = if (isSelected) DjbColors.DeckACyan else DjbColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Right Column: System & Hardware Status
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("SYSTEM & HARDWARE STATUS", color = DjbColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF090B0E), RoundedCornerShape(8.dp))
                    .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(8.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("DJB TOUCH DISPLAY — STANDALONE APK", color = DjbColors.DeckACyan, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text("Engine: Android AAudio / Media3 Low-Latency Buffer", color = Color.White, fontSize = 11.sp)
                Text("Sample Rate: 48,000 Hz · 24-bit PCM", color = DjbColors.TextSecondary, fontSize = 11.sp)
                Text("Estimated Audio Latency: 5.3 ms (AAudio High-Priority)", color = DjbColors.PlayGreen, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text("MIDI Subsystem: Android.media.midi USB OTG Host", color = DjbColors.TextSecondary, fontSize = 11.sp)
                Text("Controller: Numark DJ2GO Native Hardware Profile", color = DjbColors.CueAmber, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text("Developer: DJ Brayan", color = DjbColors.TextSecondary, fontSize = 11.sp)
            }
        }
    }
}
