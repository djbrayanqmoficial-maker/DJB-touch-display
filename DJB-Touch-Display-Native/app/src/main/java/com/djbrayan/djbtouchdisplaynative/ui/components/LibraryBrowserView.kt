package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.model.StoredTrackEntity
import com.djbrayan.djbtouchdisplaynative.model.formatTimeCode
import com.djbrayan.djbtouchdisplaynative.storage.StorageVolumeInfo
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Library Browser View — Storage Access Framework audio file explorer with volumes,
 * search filter, and instant Deck A / Deck B loaders.
 * Faithful reproduction of LibraryView.tsx.
 */
@Composable
fun LibraryBrowserView(
    tracks: List<StoredTrackEntity>,
    volumes: List<StorageVolumeInfo>,
    selectedVolumeId: String,
    onSelectVolume: (String) -> Unit,
    onLoadToDeckA: (StoredTrackEntity) -> Unit,
    onLoadToDeckB: (StoredTrackEntity) -> Unit,
    onOpenFilePicker: () -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }

    val filteredTracks = remember(tracks, searchQuery) {
        if (searchQuery.isBlank()) tracks
        else {
            val q = searchQuery.lowercase()
            tracks.filter {
                it.title.lowercase().contains(q) ||
                it.artist.lowercase().contains(q) ||
                it.album.lowercase().contains(q) ||
                it.genre.lowercase().contains(q) ||
                it.key.lowercase().contains(q)
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141619))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // Storage Volume Tabs & Import File Button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                volumes.forEach { vol ->
                    val active = selectedVolumeId == vol.id
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (active) DjbColors.Cyan else Color(0xFF25282F))
                            .clickable { onSelectVolume(vol.id) }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "${vol.name} (${vol.count})",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (active) Color.Black else Color.White
                        )
                    }
                }
            }

            // SAF Document Picker Button
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xFF2E333D))
                    .border(width = 1.dp, color = DjbColors.Cyan, shape = RoundedCornerShape(3.dp))
                    .clickable { onOpenFilePicker() }
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "+ OPEN FILE (SAF)",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = DjbColors.Cyan
                )
            }
        }

        // Search Input Bar
        TextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = {
                Text(
                    text = "SEARCH BY TITLE, ARTIST, ALBUM, KEY, OR BPM...",
                    fontSize = 11.sp,
                    color = DjbColors.TextMuted
                )
            },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clip(RoundedCornerShape(3.dp))
                .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(3.dp)),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color(0xFF1E2126),
                unfocusedContainerColor = Color(0xFF1E2126),
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                cursorColor = DjbColors.Cyan
            )
        )

        // Track Table Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF1E2126))
                .border(width = 1.dp, color = DjbColors.Border)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "TITLE", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = DjbColors.TextSecondary, modifier = Modifier.weight(3f))
            Text(text = "ARTIST", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = DjbColors.TextSecondary, modifier = Modifier.weight(2f))
            Text(text = "BPM", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = DjbColors.TextSecondary, modifier = Modifier.weight(1f))
            Text(text = "KEY", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = DjbColors.TextSecondary, modifier = Modifier.weight(1f))
            Text(text = "TIME", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = DjbColors.TextSecondary, modifier = Modifier.weight(1f))
            Text(text = "ACTIONS", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = DjbColors.TextSecondary, modifier = Modifier.width(110.dp))
        }

        // Track Table Rows
        if (filteredTracks.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "NO TRACKS FOUND. TAP '+ OPEN FILE (SAF)' TO BROWSE MUSIC ON YOUR DEVICE.",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = DjbColors.TextMuted
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                items(filteredTracks) { track ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color(0xFF1E2126))
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = track.title,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(3f)
                        )
                        Text(
                            text = track.artist,
                            fontSize = 10.sp,
                            color = DjbColors.TextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(2f)
                        )
                        Text(
                            text = String.format("%.1f", track.bpm),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = DjbColors.Cyan,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = track.key,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = Color.White,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = formatTimeCode(track.durationSec),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = DjbColors.TextSecondary,
                            modifier = Modifier.weight(1f)
                        )

                        // Action Buttons: LOAD A / LOAD B
                        Row(
                            modifier = Modifier.width(110.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(28.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(DjbColors.Cyan)
                                    .clickable { onLoadToDeckA(track) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "A", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(28.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(DjbColors.Cyan)
                                    .clickable { onLoadToDeckB(track) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "B", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}
