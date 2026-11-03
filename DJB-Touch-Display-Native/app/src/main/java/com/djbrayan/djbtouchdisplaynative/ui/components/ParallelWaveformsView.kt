package com.djbrayan.djbtouchdisplaynative.ui.components

import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.djbrayan.djbtouchdisplaynative.model.CachedWaveformData
import com.djbrayan.djbtouchdisplaynative.model.DeckState
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors

/**
 * DJB Parallel Waveforms View — Dual stacked high-resolution scrolling multi-band waveforms
 * with center playhead, beat grid lines, and zoom controls.
 * Faithful reproduction of MainSection.WAVEFORMS.
 */
@Composable
fun ParallelWaveformsView(
    deckA: DeckState,
    deckB: DeckState,
    waveformA: CachedWaveformData?,
    waveformB: CachedWaveformData?,
    onSeekA: (Double) -> Unit,
    onSeekB: (Double) -> Unit,
    modifier: Modifier = Modifier
) {
    var zoomLevel by remember { mutableFloatStateOf(2.0f) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141619))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // Zoom Controls & Info Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "PARALLEL DUAL WAVEFORMS (HIGH-RES PCM)",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = DjbColors.TextSecondary
            )

            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(1.0f, 2.0f, 4.0f).forEach { z ->
                    val active = zoomLevel == z
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (active) DjbColors.Cyan else Color(0xFF25282F))
                            .clickable { zoomLevel = z }
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "${z.toInt()}X",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (active) Color.Black else Color.White
                        )
                    }
                }
            }
        }

        // Stacked Waveforms Container with Center Playhead
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF0F1114))
                .border(width = 1.dp, color = DjbColors.Border, shape = RoundedCornerShape(4.dp))
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Deck A Waveform
                SingleScrollingWaveform(
                    deck = deckA,
                    waveform = waveformA,
                    zoom = zoomLevel,
                    modifier = Modifier.weight(1f)
                )

                // Divider line
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(Color(0xFF2A2E36))
                )

                // Deck B Waveform
                SingleScrollingWaveform(
                    deck = deckB,
                    waveform = waveformB,
                    zoom = zoomLevel,
                    modifier = Modifier.weight(1f)
                )
            }

            // Central Vertical Playhead Line across both waveforms
            Canvas(modifier = Modifier.fillMaxSize()) {
                val centerX = size.width / 2f
                drawLine(
                    color = Color.White,
                    start = Offset(centerX, 0f),
                    end = Offset(centerX, size.height),
                    strokeWidth = 2.dp.toPx()
                )
            }
        }
    }
}

@Composable
private fun SingleScrollingWaveform(
    deck: DeckState,
    waveform: CachedWaveformData?,
    zoom: Float,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val centerY = h / 2f
        val centerX = w / 2f

        val bins = waveform?.scrollingBins
        if (bins != null && bins.isNotEmpty() && deck.durationSec > 0) {
            val progressFrac = (deck.currentPositionSec / deck.durationSec).toFloat()
            val totalBins = bins.size
            val centerBinIndex = progressFrac * totalBins

            val visibleBinsWindow = (totalBins / (zoom * 4f)).toInt().coerceAtLeast(60)
            val binPxWidth = w / visibleBinsWindow.toFloat()

            val startBin = (centerBinIndex - (visibleBinsWindow / 2)).toInt()
            val endBin = (centerBinIndex + (visibleBinsWindow / 2)).toInt()

            for (b in startBin..endBin) {
                if (b in bins.indices) {
                    val sample = bins[b]
                    val x = centerX + ((b - centerBinIndex) * binPxWidth)
                    val barH = (sample.low * (h * 0.85f)).coerceAtLeast(3f)

                    // Draw low band (Cyan)
                    drawRect(
                        color = DjbColors.Cyan,
                        topLeft = Offset(x, centerY - (barH / 2f)),
                        size = Size(binPxWidth.coerceAtLeast(1.5f), barH)
                    )

                    // Draw transient top cap (White)
                    drawRect(
                        color = Color.White,
                        topLeft = Offset(x, centerY - (barH / 2f)),
                        size = Size(binPxWidth.coerceAtLeast(1.5f), 1.5.dp.toPx())
                    )
                }
            }
        } else {
            // Center guide line
            drawLine(
                color = Color(0xFF22252A),
                start = Offset(0f, centerY),
                end = Offset(w, centerY),
                strokeWidth = 1.dp.toPx()
            )
        }

        // Draw Beat Grid Markers based on effectiveBpm
        if (deck.effectiveBpm > 0 && deck.durationSec > 0) {
            val secPerBeat = 60.0 / deck.effectiveBpm
            val currentSec = deck.currentPositionSec
            val windowSec = 10.0 / zoom
            val startSec = currentSec - (windowSec / 2.0)
            val endSec = currentSec + (windowSec / 2.0)

            val firstBeatIndex = (startSec / secPerBeat).toInt()
            val lastBeatIndex = (endSec / secPerBeat).toInt()

            for (bt in firstBeatIndex..lastBeatIndex) {
                val beatTime = bt * secPerBeat
                val x = centerX + (((beatTime - currentSec) / windowSec).toFloat() * w)
                if (x in 0f..w) {
                    val isDownbeat = bt % 4 == 0
                    drawLine(
                        color = if (isDownbeat) DjbColors.Red.copy(alpha = 0.8f) else Color(0x66FFFFFF),
                        start = Offset(x, 0f),
                        end = Offset(x, h),
                        strokeWidth = if (isDownbeat) 1.5.dp.toPx() else 0.8.dp.toPx()
                    )
                }
            }
        }
    }
}
