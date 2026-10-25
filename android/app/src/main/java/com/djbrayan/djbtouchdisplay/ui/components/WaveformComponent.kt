package com.djbrayan.djbtouchdisplay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplay.core.HotCueSlot
import com.djbrayan.djbtouchdisplay.core.LoopState
import com.djbrayan.djbtouchdisplay.ui.theme.DjbColors

/**
 * Waveform Canvas — Migrated with 100% fidelity from WaveformCanvas.tsx
 * High-definition parallel scrolling waveform with beatgrid lines,
 * loop boundaries, hot cue flags, center playhead, and zoom scaling (1x to 6x).
 */
@Composable
fun ScrollingWaveformHD(
    peaks: FloatArray,
    positionSec: Float,
    durationSec: Float,
    bpm: Float,
    zoom: Float,
    showBeatgrid: Boolean,
    gridOffsetSec: Float,
    gridResolutionMultiplier: Float,
    hotCues: List<HotCueSlot>,
    loop: LoopState,
    cuePointSec: Float,
    accentColor: Color,
    onSeek: (Float) -> Unit,
    onNudge: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .fillMaxHeight()
            .background(Color(0xFF181A1E))
            .pointerInput(durationSec) {
                detectTapGestures { offset ->
                    val width = size.width
                    val centerOffset = offset.x - (width / 2f)
                    val secPerPixel = (60f / bpm) / (120f * zoom)
                    val targetSec = (positionSec + (centerOffset * secPerPixel)).coerceIn(0f, durationSec)
                    onSeek(targetSec)
                }
            }
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    val deltaX = -dragAmount.x
                    onNudge(deltaX * 0.45f)
                }
            }
    ) {
        val width = size.width
        val height = size.height
        val centerY = height / 2f
        val centerX = width / 2f

        val effectiveBpm = bpm * gridResolutionMultiplier
        val beatDurationSec = if (effectiveBpm > 0f) 60f / effectiveBpm else 0.5f
        val pixelsPerSecond = (width / 8f) * zoom / (60f / 120f)

        // 1. Draw Beatgrid Lines
        if (showBeatgrid && bpm > 0f) {
            val startSec = positionSec - (centerX / pixelsPerSecond)
            val endSec = positionSec + (centerX / pixelsPerSecond)

            val firstBeatIndex = ((startSec - gridOffsetSec) / beatDurationSec).toInt() - 1
            val lastBeatIndex = ((endSec - gridOffsetSec) / beatDurationSec).toInt() + 1

            for (b in firstBeatIndex..lastBeatIndex) {
                val beatTimeSec = (b * beatDurationSec) + gridOffsetSec
                val beatX = centerX + ((beatTimeSec - positionSec) * pixelsPerSecond)

                if (beatX in 0f..width) {
                    val isDownbeat = (b % 4 == 0)
                    drawLine(
                        color = if (isDownbeat) Color(0x66FFFFFF) else Color(0x2AFFFFFF),
                        start = Offset(beatX, 0f),
                        end = Offset(beatX, height),
                        strokeWidth = if (isDownbeat) 1.5f else 1f
                    )
                }
            }
        }

        // 2. Loop Region Highlight
        if (loop.active && loop.inPointSec != null && loop.outPointSec != null) {
            val loopInX = centerX + ((loop.inPointSec - positionSec) * pixelsPerSecond)
            val loopOutX = centerX + ((loop.outPointSec - positionSec) * pixelsPerSecond)
            val left = loopInX.coerceAtLeast(0f)
            val right = loopOutX.coerceAtMost(width)

            if (right > left) {
                drawRect(
                    color = DjbColors.Cyan.copy(alpha = 0.22f),
                    topLeft = Offset(left, 0f),
                    size = Size(right - left, height)
                )
            }
        }

        // 3. Draw Waveform Peaks
        val barCount = 140
        val barWidth = width / barCount.toFloat()
        val totalPeaks = peaks.size
        val progress = if (durationSec > 0f) (positionSec / durationSec).coerceIn(0f, 1f) else 0f
        val centerIndex = (progress * (totalPeaks - 1)).toInt()
        val windowSpan = (totalPeaks / (6f * zoom)).toInt().coerceAtLeast(barCount)
        val step = windowSpan / barCount

        for (i in 0 until barCount) {
            val sampleIdx = (centerIndex - (barCount / 2 * step) + (i * step)).coerceIn(0, totalPeaks - 1)
            val amp = peaks[sampleIdx]
            val barH = amp * (height * 0.85f)
            val x = i * barWidth
            val top = centerY - (barH / 2f)

            val isPlayed = x <= centerX
            val col = if (isPlayed) accentColor else Color(0xFF454B55)

            drawRect(
                color = col,
                topLeft = Offset(x, top),
                size = Size(barWidth * 0.8f, barH)
            )
        }

        // 4. Hot Cue Markers
        for (cue in hotCues) {
            if (cue.active && cue.positionSec != null) {
                val cueX = centerX + ((cue.positionSec - positionSec) * pixelsPerSecond)
                if (cueX in 0f..width) {
                    drawLine(
                        color = Color(0xFFF59E0B),
                        start = Offset(cueX, 0f),
                        end = Offset(cueX, height),
                        strokeWidth = 2f
                    )
                }
            }
        }

        // 5. Center Vertical Playhead Line
        drawLine(
            color = Color.White,
            start = Offset(centerX, 0f),
            end = Offset(centerX, height),
            strokeWidth = 2f
        )
    }
}

@Composable
fun ScrollingWaveform(
    amplitudes: FloatArray,
    currentPosSec: Float,
    bpm: Float,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    ScrollingWaveformHD(
        peaks = amplitudes,
        positionSec = currentPosSec,
        durationSec = 240f,
        bpm = if (bpm > 0f) bpm else 120f,
        zoom = 2.0f,
        showBeatgrid = true,
        gridOffsetSec = 0f,
        gridResolutionMultiplier = 1.0f,
        hotCues = emptyList(),
        loop = LoopState(),
        cuePointSec = 0f,
        accentColor = accentColor,
        onSeek = {},
        onNudge = {},
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
    )
}

@Composable
fun OverviewScrubberWaveform(
    amplitudes: FloatArray,
    currentPosSec: Float,
    durationSec: Float,
    cuePointSec: Float,
    accentColor: Color,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(28.dp)
            .background(Color(0xFF0F1216), RoundedCornerShape(4.dp))
            .border(1.dp, DjbColors.PanelBorder, RoundedCornerShape(4.dp))
            .pointerInput(durationSec) {
                detectTapGestures { offset ->
                    if (durationSec > 0f && size.width > 0f) {
                        val seekSec = (offset.x / size.width).coerceIn(0f, 1f) * durationSec
                        onSeek(seekSec)
                    }
                }
            }
    ) {
        val width = size.width
        val height = size.height
        val centerY = height / 2f
        val barCount = amplitudes.size.coerceAtMost(100).coerceAtLeast(1)
        val barWidth = width / barCount.toFloat()
        val playheadFrac = if (durationSec > 0f) (currentPosSec / durationSec).coerceIn(0f, 1f) else 0f
        val playheadX = playheadFrac * width

        for (i in 0 until barCount) {
            val amp = if (i < amplitudes.size) amplitudes[i].coerceIn(0.05f, 1f) else 0.2f
            val barH = amp * (height * 0.8f)
            val x = i * barWidth
            val isPlayed = x <= playheadX
            val col = if (isPlayed) accentColor else Color(0xFF454B55)
            drawRect(
                color = col,
                topLeft = Offset(x, centerY - (barH / 2f)),
                size = Size((barWidth * 0.8f).coerceAtLeast(1f), barH)
            )
        }

        // Cue point line
        if (cuePointSec > 0f && durationSec > 0f) {
            val cueX = (cuePointSec / durationSec) * width
            drawLine(
                color = DjbColors.CueAmber,
                start = Offset(cueX, 0f),
                end = Offset(cueX, height),
                strokeWidth = 2f
            )
        }

        // Playhead
        drawLine(
            color = Color.White,
            start = Offset(playheadX, 0f),
            end = Offset(playheadX, height),
            strokeWidth = 2f
        )
    }
}

