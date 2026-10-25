package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Usb
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.midi.ControllerProfile
import com.djbrayan.djbtouchdisplay.core.midi.MidiDeviceDescriptor
import com.djbrayan.djbtouchdisplay.core.midi.MidiMessagePacket
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

@Composable
fun MidiPanel(
    devices: List<MidiDeviceDescriptor>,
    activeProfile: ControllerProfile,
    lastPacket: MidiMessagePacket?,
    midiLearnAction: String?,
    onRefreshDevices: () -> Unit,
    onConnectDevice: (Int) -> Unit,
    onDisconnectDevice: () -> Unit,
    onStartLearn: (String) -> Unit,
    onCancelLearn: () -> Unit,
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
        // --- Left: USB MIDI Hardware Devices ---
        Column(
            modifier = Modifier
                .width(280.dp)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("USB MIDI CONTROLLERS", color = DjbColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    IconButton(onClick = onRefreshDevices, modifier = Modifier.size(24.dp)) {
                        Icon(imageVector = Icons.Default.Refresh, contentDescription = "Refresh", tint = DjbColors.DeckACyan)
                    }
                }

                if (devices.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(80.dp)
                            .background(Color(0xFF14181F), RoundedCornerShape(6.dp))
                            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(6.dp))
                            .padding(10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No USB MIDI controller detected.\nConnect via USB-C OTG cable.",
                            color = DjbColors.TextSecondary,
                            fontSize = 11.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(devices) { dev ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        if (dev.isConnected) Color(0xFF0F261E) else Color(0xFF14181F),
                                        RoundedCornerShape(6.dp)
                                    )
                                    .border(
                                        1.dp,
                                        if (dev.isConnected) DjbColors.PlayGreen else DjbColors.PanelBorder,
                                        RoundedCornerShape(6.dp)
                                    )
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(dev.name, color = DjbColors.TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                    Text("${dev.manufacturer} · In: ${dev.inputPortCount} Out: ${dev.outputPortCount}", color = DjbColors.TextSecondary, fontSize = 10.sp)
                                }
                                Box(
                                    modifier = Modifier
                                        .background(
                                            if (dev.isConnected) DjbColors.PlayGreen else Color(0xFF1C222B),
                                            RoundedCornerShape(4.dp)
                                        )
                                        .clickable {
                                            if (dev.isConnected) onDisconnectDevice() else onConnectDevice(dev.id)
                                        }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = if (dev.isConnected) "CONNECTED" else "CONNECT",
                                        color = if (dev.isConnected) Color.Black else DjbColors.DeckACyan,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Active Profile Info
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF090B0E), RoundedCornerShape(6.dp))
                    .padding(8.dp)
            ) {
                Text("ACTIVE MAPPING PROFILE", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(activeProfile.name, color = DjbColors.DeckACyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("Model: ${activeProfile.controllerModel}", color = DjbColors.TextSecondary, fontSize = 10.sp)
                Text("Rules: ${activeProfile.mappings.size} hardware controls bound", color = DjbColors.TextSecondary, fontSize = 10.sp)
            }
        }

        // --- Right: MIDI Learn & Live Packet Monitor ---
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Live Packet Monitor
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("LIVE MIDI INCOMING PACKET MONITOR", color = DjbColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF090B0E), RoundedCornerShape(6.dp))
                        .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (lastPacket != null) {
                        Text("CMD: ${lastPacket.command}", color = DjbColors.DeckACyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("CH: ${lastPacket.channel}", color = Color.White, fontSize = 12.sp)
                        Text("DATA 1: ${lastPacket.data1} (0x%02X)".format(lastPacket.data1), color = DjbColors.CueAmber, fontSize = 12.sp)
                        Text("DATA 2: ${lastPacket.data2}", color = DjbColors.PlayGreen, fontSize = 12.sp)
                    } else {
                        Text("Waiting for MIDI signals from controller...", color = DjbColors.TextSecondary, fontSize = 11.sp)
                    }
                }
            }

            // MIDI Learn Controls
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = if (midiLearnAction != null) "WAITING: PRESS ANY BUTTON/KNOB ON HARDWARE..." else "HARDWARE BINDINGS & MIDI LEARN",
                    color = if (midiLearnAction != null) DjbColors.CueAmber else DjbColors.TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )

                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(activeProfile.mappings) { mapping ->
                        val isLearning = midiLearnAction == mapping.actionId
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(if (isLearning) Color(0xFF261D10) else Color(0xFF14181F), RoundedCornerShape(4.dp))
                                .border(1.dp, if (isLearning) DjbColors.CueAmber else DjbColors.PanelBorder, RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(mapping.actionId, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text("${mapping.command} Ch:${mapping.channel} Note/CC:${mapping.data1}", color = DjbColors.TextSecondary, fontSize = 10.sp)
                            Box(
                                modifier = Modifier
                                    .background(if (isLearning) DjbColors.CueAmber else Color(0xFF1E242E), RoundedCornerShape(4.dp))
                                    .clickable {
                                        if (isLearning) onCancelLearn() else onStartLearn(mapping.actionId)
                                    }
                                    .padding(horizontal = 6.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = if (isLearning) "CANCEL" else "RE-MAP",
                                    color = if (isLearning) Color.Black else DjbColors.DeckACyan,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
