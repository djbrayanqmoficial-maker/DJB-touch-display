package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.DeckState
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

val DeckState.trackTitle: String get() = title
val DeckState.trackArtist: String get() = artist
val DeckState.cuePointSec: Float get() = hotCues.firstOrNull { it.active && it.positionSec != null }?.positionSec ?: 0f
val DeckState.bipolarFilter: Float get() = (eq.filter / 100f).coerceIn(-1f, 1f)
val DeckState.activeLoopBeats: Float? get() = if (loop.active) loop.lengthBeats else null
val DeckState.isSync: Boolean get() = isSyncActive

@Composable
fun DeckPanel(
    deckState: DeckState,
    positionSec: Float,
    durationSec: Float,
    overviewAmps: FloatArray,
    visibleAmps: FloatArray,
    accentColor: Color,
    onPlayPause: () -> Unit,
    onCue: () -> Unit,
    onSync: () -> Unit,
    onPitchChange: (Float) -> Unit,
    onResetPitch: () -> Unit,
    onJogNudge: (Float) -> Unit,
    onSeek: (Float) -> Unit,
    onSetLoop: (Float?) -> Unit,
    onHotCue: (Int) -> Unit,
    onFilterChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(Color(0xFF101317), RoundedCornerShape(12.dp))
            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // --- 1. Track Header Info ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = deckState.trackTitle,
                    color = DjbColors.TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )
                Text(
                    text = deckState.trackArtist,
                    color = DjbColors.TextSecondary,
                    fontSize = 11.sp,
                    maxLines = 1
                )
            }
            
            // BPM and Pitch Display
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "%.1f BPM".format(deckState.currentBpm),
                        color = accentColor,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "%+.2f%%".format(deckState.pitchPercent),
                        color = if (deckState.pitchPercent == 0f) DjbColors.TextSecondary else accentColor,
                        fontSize = 11.sp
                    )
                }
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(Color(0xFF1C222B), CircleShape)
                        .clickable { onResetPitch() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Reset Pitch",
                        tint = DjbColors.TextSecondary,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // --- 2. Waveforms (Scrolling & Overview) ---
        ScrollingWaveform(
            amplitudes = visibleAmps,
            currentPosSec = positionSec,
            bpm = deckState.currentBpm,
            accentColor = accentColor
        )

        Spacer(modifier = Modifier.height(4.dp))

        OverviewScrubberWaveform(
            amplitudes = overviewAmps,
            currentPosSec = positionSec,
            durationSec = durationSec,
            cuePointSec = deckState.cuePointSec,
            accentColor = accentColor,
            onSeek = onSeek
        )

        // Time indicators (Elapsed / Remaining)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            val elapsedMin = (positionSec / 60).toInt()
            val elapsedSec = (positionSec % 60).toInt()
            val remainSec = (durationSec - positionSec).coerceAtLeast(0f)
            val remMin = (remainSec / 60).toInt()
            val remSec = (remainSec % 60).toInt()

            Text(
                text = "%02d:%02d".format(elapsedMin, elapsedSec),
                color = DjbColors.TextPrimary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "-%02d:%02d".format(remMin, remSec),
                color = DjbColors.TextSecondary,
                fontSize = 11.sp
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // --- 3. Center Section: Tactile Jogwheel + Pitch Fader + Color Filter ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Interactive Vinyl Jogwheel
            TactileJogwheel(
                rotationAngleDeg = (positionSec * (deckState.currentBpm / 60f) * 360f) % 360f,
                accentColor = accentColor,
                onNudge = onJogNudge,
                modifier = Modifier
                    .size(120.dp)
                    .padding(4.dp)
            )

            // Pitch Fader & Filter Control
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(start = 12.dp),
                verticalArrangement = Arrangement.SpaceAround
            ) {
                // Color Filter Knob (-100% LPF to +100% HPF)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("FILTER", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(
                        text = if (deckState.bipolarFilter < -0.05f) "LPF %d%%".format((-deckState.bipolarFilter * 100).toInt())
                        else if (deckState.bipolarFilter > 0.05f) "HPF %d%%".format((deckState.bipolarFilter * 100).toInt())
                        else "FLAT",
                        color = accentColor,
                        fontSize = 10.sp
                    )
                }
                Slider(
                    value = deckState.bipolarFilter,
                    onValueChange = onFilterChange,
                    valueRange = -1.0f..1.0f,
                    colors = SliderDefaults.colors(
                        thumbColor = accentColor,
                        activeTrackColor = accentColor,
                        inactiveTrackColor = Color(0xFF1E232B)
                    ),
                    modifier = Modifier.fillMaxWidth().height(24.dp)
                )

                // Pitch Fader
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("TEMPO", color = DjbColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("%+.1f%%".format(deckState.pitchPercent), color = accentColor, fontSize = 10.sp)
                }
                Slider(
                    value = deckState.pitchPercent,
                    onValueChange = onPitchChange,
                    valueRange = -16.0f..16.0f,
                    colors = SliderDefaults.colors(
                        thumbColor = Color.White,
                        activeTrackColor = accentColor,
                        inactiveTrackColor = Color(0xFF1E232B)
                    ),
                    modifier = Modifier.fillMaxWidth().height(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // --- 4. Loop & Hot Cue Pads ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Hot Cues 1..4
            for (cueIdx in 1..4) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(28.dp)
                        .background(Color(0xFF1C222B), RoundedCornerShape(4.dp))
                        .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(4.dp))
                        .clickable { onHotCue(cueIdx) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "CUE $cueIdx",
                        color = DjbColors.CueAmber,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Loop 1, 2, 4, 8 beats
            listOf(1f, 2f, 4f, 8f).forEach { beats ->
                val active = deckState.activeLoopBeats == beats
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(28.dp)
                        .background(
                            if (active) accentColor.copy(alpha = 0.3f) else Color(0xFF151920),
                            RoundedCornerShape(4.dp)
                        )
                        .border(
                            1.dp,
                            if (active) accentColor else DjbColors.PanelBorder,
                            RoundedCornerShape(4.dp)
                        )
                        .clickable { onSetLoop(if (active) null else beats) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${beats.toInt()}B",
                        color = if (active) accentColor else DjbColors.TextSecondary,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // --- 5. Transport Controls: CUE, PLAY/PAUSE, SYNC ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // CUE Button
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(44.dp)
                    .background(Color(0xFF261D10), RoundedCornerShape(8.dp))
                    .border(2.dp, DjbColors.CueAmber, RoundedCornerShape(8.dp))
                    .clickable { onCue() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "CUE",
                    color = DjbColors.CueAmber,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }

            // PLAY / PAUSE Button
            val playing = deckState.isPlaying
            Box(
                modifier = Modifier
                    .weight(1.4f)
                    .height(44.dp)
                    .background(
                        if (playing) DjbColors.PlayGreen else Color(0xFF0F291E),
                        RoundedCornerShape(8.dp)
                    )
                    .border(2.dp, DjbColors.PlayGreen, RoundedCornerShape(8.dp))
                    .clickable { onPlayPause() },
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play/Pause",
                        tint = if (playing) Color.Black else DjbColors.PlayGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = if (playing) "PAUSE" else "PLAY",
                        color = if (playing) Color.Black else DjbColors.PlayGreen,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }

            // SYNC Button
            Box(
                modifier = Modifier
                    .weight(0.9f)
                    .height(44.dp)
                    .background(
                        if (deckState.isSync) DjbColors.SyncCyan.copy(alpha = 0.3f) else Color(0xFF101E26),
                        RoundedCornerShape(8.dp)
                    )
                    .border(
                        1.5.dp,
                        if (deckState.isSync) DjbColors.SyncCyan else DjbColors.PanelBorder,
                        RoundedCornerShape(8.dp)
                    )
                    .clickable { onSync() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "SYNC",
                    color = if (deckState.isSync) DjbColors.SyncCyan else DjbColors.TextSecondary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun TactileJogwheel(
    rotationAngleDeg: Float,
    accentColor: Color,
    onNudge: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    val nudge = dragAmount.x + dragAmount.y
                    onNudge(nudge * 0.04f)
                }
            }
    ) {
        val diameter = size.minDimension
        val radius = diameter / 2f
        val center = Offset(size.width / 2f, size.height / 2f)

        // Outer Metallic Rim
        drawCircle(
            color = Color(0xFF1E242E),
            radius = radius,
            center = center
        )

        // Vinyl Platter Grooves
        for (r in listOf(0.9f, 0.78f, 0.65f, 0.52f)) {
            drawCircle(
                color = Color(0xFF0C0E12),
                radius = radius * r,
                center = center,
                style = Stroke(width = 2f)
            )
        }

        // Center Spindle Hub
        drawCircle(
            color = Color(0xFF141922),
            radius = radius * 0.38f,
            center = center
        )
        drawCircle(
            color = accentColor,
            radius = radius * 0.38f,
            center = center,
            style = Stroke(width = 2f)
        )

        // Rotating Needle Marker
        val rad = (rotationAngleDeg - 90f) * (PI / 180f).toFloat()
        val needleLength = radius * 0.85f
        val needleEnd = Offset(
            x = center.x + cos(rad) * needleLength,
            y = center.y + sin(rad) * needleLength
        )

        drawLine(
            color = Color.White,
            start = center,
            end = needleEnd,
            strokeWidth = 3f,
            cap = StrokeCap.Round
        )

        // Accent tip dot
        drawCircle(
            color = accentColor,
            radius = 4f,
            center = needleEnd
        )
    }
}
