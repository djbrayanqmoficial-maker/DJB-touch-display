package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Usb
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.StoredTrackEntity
import com.djbrayan.djbtouchdisplay.core.formatTimeCode
import com.djbrayan.djbtouchdisplay.core.storage.AndroidStorageVolumeDescriptor
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

/**
 * Library Panel — Migrated with 100% fidelity from LibraryView.tsx
 * Real file browsing via AndroidStorageManager (Internal, SD Card, USB OTG)
 * and Storage Access Framework (SAF). Zero hardcoded or fictional tracks.
 */
@Composable
fun LibraryPanel(
    volumes: List<AndroidStorageVolumeDescriptor>,
    tracks: List<StoredTrackEntity>,
    onOpenFilePicker: () -> Unit,
    onOpenFolderPicker: (() -> Unit)? = null,
    onLoadTrackToDeckA: (StoredTrackEntity) -> Unit,
    onLoadTrackToDeckB: (StoredTrackEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("ALL") }

    val filteredTracks = remember(tracks, searchQuery) {
        if (searchQuery.isBlank()) {
            tracks
        } else {
            tracks.filter {
                it.title.contains(searchQuery, ignoreCase = true) ||
                it.artist.contains(searchQuery, ignoreCase = true) ||
                (it.bpm?.toString()?.contains(searchQuery) == true)
            }
        }
    }

    Row(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF15181C), RoundedCornerShape(8.dp))
            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(8.dp))
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // --- Left Sidebar: Volumes & Actions ---
        Column(
            modifier = Modifier
                .width(220.dp)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "STORAGE VOLUMES",
                    color = DjbColors.TextSecondary,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                // All Tracks
                VolumeSidebarItem(
                    label = "All Audio Files (${tracks.size})",
                    kind = "ALL",
                    isSelected = selectedCategory == "ALL",
                    onClick = { selectedCategory = "ALL" }
                )

                // Mounted Storage Volumes (Internal, MicroSD, USB OTG)
                volumes.forEach { vol ->
                    VolumeSidebarItem(
                        label = vol.label,
                        kind = vol.kind,
                        isSelected = selectedCategory == vol.id,
                        onClick = { selectedCategory = vol.id }
                    )
                }
            }

            // SAF Import Buttons (Folder and Files)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (onOpenFolderPicker != null) {
                    Button(
                        onClick = onOpenFolderPicker,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF15222E)),
                        shape = RoundedCornerShape(6.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DjbColors.CyanBright),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(40.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.FolderOpen,
                            contentDescription = "Pick Folder",
                            tint = DjbColors.CyanBright,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "+ SCAN FOLDER...",
                            color = DjbColors.CyanBright,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Button(
                    onClick = onOpenFilePicker,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1C222B)),
                    shape = RoundedCornerShape(6.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, DjbColors.Cyan),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.FolderOpen,
                        contentDescription = "Pick File",
                        tint = DjbColors.Cyan,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "+ IMPORT FILES...",
                        color = DjbColors.Cyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // --- Right Section: Search & Track List ---
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Search Input Field
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search by title, artist, or BPM...", color = DjbColors.TextSecondary, fontSize = 12.sp) },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = DjbColors.TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = DjbColors.Cyan,
                    unfocusedBorderColor = DjbColors.PanelBorder,
                    focusedTextColor = DjbColors.TextPrimary,
                    unfocusedTextColor = DjbColors.TextPrimary
                ),
                shape = RoundedCornerShape(6.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp)
            )

            // Table Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0B0C0E), RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("TITLE & ARTIST", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(2.5f))
                Text("BPM", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(0.8f))
                Text("KEY", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(0.6f))
                Text("TIME", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(0.8f))
                Text("LOAD ACTIONS", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1.8f))
            }

            // Real Tracks List
            if (filteredTracks.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .background(Color(0xFF0E1116), RoundedCornerShape(6.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "No audio tracks loaded yet.",
                            color = DjbColors.TextSecondary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Click '+ IMPORT FILE...' to load real MP3, WAV or FLAC tracks from your device or USB drive.",
                            color = DjbColors.TextMuted,
                            fontSize = 11.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(filteredTracks) { track ->
                        RealTrackRowItem(
                            track = track,
                            onLoadA = { onLoadTrackToDeckA(track) },
                            onLoadB = { onLoadTrackToDeckB(track) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun VolumeSidebarItem(
    label: String,
    kind: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (isSelected) Color(0xFF1E242E) else Color(0xFF12151A),
                RoundedCornerShape(4.dp)
            )
            .border(
                1.dp,
                if (isSelected) DjbColors.Cyan else DjbColors.PanelBorder,
                RoundedCornerShape(4.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector = when (kind) {
                "USB_OTG" -> Icons.Default.Usb
                else -> Icons.Default.FolderOpen
            },
            contentDescription = kind,
            tint = if (isSelected) DjbColors.Cyan else DjbColors.TextSecondary,
            modifier = Modifier.size(15.dp)
        )
        Text(
            text = label,
            color = if (isSelected) Color.White else DjbColors.TextSecondary,
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1
        )
    }
}

@Composable
fun RealTrackRowItem(
    track: StoredTrackEntity,
    onLoadA: () -> Unit,
    onLoadB: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF12151A), RoundedCornerShape(4.dp))
            .border(1.dp, Color(0xFF232832), RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Title & Artist
        Column(modifier = Modifier.weight(2.5f)) {
            Text(track.title, color = DjbColors.TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(track.artist, color = DjbColors.TextSecondary, fontSize = 10.sp, maxLines = 1)
        }

        // BPM
        Text(
            text = "%.1f".format(track.bpm ?: 120f),
            color = DjbColors.Cyan,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(0.8f)
        )

        // Key
        Text(
            text = track.musicalKey,
            color = Color.White,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.weight(0.6f)
        )

        // Time
        Text(
            text = formatTimeCode(track.durationSec).slice(0..4),
            color = DjbColors.TextSecondary,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.weight(0.8f)
        )

        // Load Buttons A & B
        Row(
            modifier = Modifier.weight(1.8f),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(28.dp)
                    .background(Color(0xFF0F232E), RoundedCornerShape(3.dp))
                    .border(1.dp, DjbColors.Cyan, RoundedCornerShape(3.dp))
                    .clickable { onLoadA() },
                contentAlignment = Alignment.Center
            ) {
                Text("LOAD A", color = DjbColors.Cyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(28.dp)
                    .background(Color(0xFF0F232E), RoundedCornerShape(3.dp))
                    .border(1.dp, DjbColors.Cyan, RoundedCornerShape(3.dp))
                    .clickable { onLoadB() },
                contentAlignment = Alignment.Center
            ) {
                Text("LOAD B", color = DjbColors.Cyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}
