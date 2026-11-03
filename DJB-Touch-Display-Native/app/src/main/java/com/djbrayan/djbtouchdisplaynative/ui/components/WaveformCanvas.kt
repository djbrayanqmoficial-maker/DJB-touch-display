package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.djbrayan.djbtouchdisplaynative.model.CachedWaveformData
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Waveform Canvas — Overview waveform with interactive playhead & touch seek.
 * Faithful reproduction of WaveformCanvas.tsx.
 */
@Composable
fun OverviewWaveformBar(
    deck: DeckState,
    waveform: CachedWaveformData?,
    onSeek: (positionSec: Double) -> Unit,
    modifier: Modifier = Modifier
) {
    val progress = if (deck.durationSec > 0) {
        (deck.currentPositionSec / deck.durationSec).coerceIn(0.0, 1.0).toFloat()
    } else 0f

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(28.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(Color(0xFF141619))
            .pointerInput(deck.durationSec) {
                detectTapGestures { offset ->
                    if (size.width > 0 && deck.durationSec > 0) {
                        val frac = (offset.x / size.width).coerceIn(0f, 1f)
                        onSeek(frac.toDouble() * deck.durationSec)
                    }
                }
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val centerY = h / 2f

            val bins = waveform?.overviewBins
            if (bins != null && bins.isNotEmpty()) {
                val binWidth = w / bins.size.toFloat()
                for (i in bins.indices) {
                    val sample = bins[i]
                    val x = i * binWidth
                    val barHeight = (sample.low * (h * 0.85f)).coerceAtLeast(2f)

                    // Multiband frequency color: low = Cyan, mid = sky blue, high = light cyan
                    val barColor = if (x <= progress * w) {
                        DjbColors.Cyan
                    } else {
                        Color(0xFF383C44)
                    }

                    drawRect(
                        color = barColor,
                        topLeft = Offset(x, centerY - (barHeight / 2f)),
                        size = Size(binWidth.coerceAtLeast(1f), barHeight)
                    )
                }
            } else {
                // Fallback static guide
                drawLine(
                    color = Color(0xFF2A2E36),
                    start = Offset(0f, centerY),
                    end = Offset(w, centerY),
                    strokeWidth = 2.dp.toPx()
                )
            }

            // Playhead Cursor
            val playheadX = progress * w
            drawLine(
                color = Color.White,
                start = Offset(playheadX, 0f),
                end = Offset(playheadX, h),
                strokeWidth = 2.dp.toPx()
            )

            // Hot Cue Markers
            for (cue in deck.hotCues) {
                if (cue.isSet && deck.durationSec > 0) {
                    val cueX = (cue.positionSec / deck.durationSec).toFloat() * w
                    drawCircle(
                        color = DjbColors.Amber,
                        radius = 3.dp.toPx(),
                        center = Offset(cueX, centerY)
                    )
                }
            }
        }
    }
}
