package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.model.MidiPacket
import com.djbrayan.djbtouchdisplaynative.model.OperatingMode
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Settings View — MIDI hardware configuration, audio engine settings, and operating modes.
 * Faithful reproduction of SettingsView.tsx.
 */
@Composable
fun SettingsView(
    operatingMode: OperatingMode,
    onSelectMode: (OperatingMode) -> Unit,
    connectedMidiDevice: String?,
    lastMidiPacket: MidiPacket?,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141619))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "DJB TOUCH DISPLAY NATIVE — SYSTEM CONFIGURATION",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = DjbColors.Cyan
        )

        // Operating Mode Selector
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF1E2126))
                .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(4.dp))
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "OPERATING SYSTEM MODE",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary
            )

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(
                    OperatingMode.STANDALONE to "STANDALONE MODE (DUAL DECK)",
                    OperatingMode.VIRTUALDJ to "VIRTUALDJ BRIDGE MODE",
                    OperatingMode.MOBILE_ONLY to "SOLO CELULAR (TOUCH ONLY)"
                ).forEach { (mode, label) ->
                    val active = operatingMode == mode
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (active) DjbColors.Cyan else Color(0xFF25282F))
                            .border(width = 1.dp, color = if (active) Color.White else DjbColors.Border, shape = RoundedCornerShape(3.dp))
                            .clickable { onSelectMode(mode) }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = label,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (active) Color.Black else Color.White
                        )
                    }
                }
            }
        }

        // MIDI Engine Status & Monitor
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF1E2126))
                .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(4.dp))
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "USB MIDI HARDWARE & NUMARK DJ2GO PROFILE",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Connected Controller: ${connectedMidiDevice ?: "No USB MIDI device detected"}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = if (connectedMidiDevice != null) DjbColors.Green else DjbColors.TextMuted
                )

                if (lastMidiPacket != null) {
                    Text(
                        text = "Last Packet: Status=0x${Integer.toHexString(lastMidiPacket.status).uppercase()} D1=${lastMidiPacket.data1} D2=${lastMidiPacket.data2} CH=${lastMidiPacket.channel}",
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        color = DjbColors.Cyan
                    )
                }
            }
        }

        // Native Audio Engine Information
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF1E2126))
                .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(4.dp))
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = "LOW-LATENCY AUDIO ENGINE SPECIFICATIONS",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary
            )
            Text(
                text = "• Architecture: Native Android ExoPlayer Dual Engine + Android AudioFX Equalizer",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = Color.White
            )
            Text(
                text = "• EQ Frequencies: Low 60Hz, Mid 910Hz, High 14kHz (-24dB Kill to +12dB Boost)",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = Color.White
            )
            Text(
                text = "• Real-Time Bipolar Color Filter with continuous sweep (-100 to +100)",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = Color.White
            )
            Text(
                text = "• Developer: DJ Brayan — DJB Touch Display System",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.Cyan
            )
        }
    }
}
