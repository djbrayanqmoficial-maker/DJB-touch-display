import React, { useEffect, useMemo, useRef } from 'react';
import { HotCueSlot, LoopState } from '../core/dj/DjEngine';
import { CachedWaveformRecord } from '../core/database/TrackDatabase';
import {
  convertCachedWaveformToSamples,
  generateDeterministicWaveform,
  sampleWaveformAtRatioInto,
} from '../core/waveform/WaveformEngine';
import { realAudioEngine } from '../core/audio/RealAudioEngine';

interface WaveformCanvasProps {
  trackId: string;
  deckId: 'A' | 'B';
  positionSec: number;
  durationSec: number;
  bpm: number;
  baseBpm?: number;
  firstBeatOffsetSec?: number;
  gridResolutionMultiplier?: number;
  isPlaying: boolean;
  hotCues: HotCueSlot[];
  loop: LoopState;
  cuePointSec?: number;
  cachedWaveform?: CachedWaveformRecord | null;
  height?: number;
  zoom?: number;
  showBeatgrid?: boolean;
  variant?: 'overview' | 'scrolling';
  onSeek?: (newSec: number) => void;
  onScratchOrBend?: (deltaDeg: number) => void;
  onReleaseScratch?: () => void;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = React.memo(({
  trackId,
  deckId,
  positionSec,
  durationSec,
  bpm,
  baseBpm,
  firstBeatOffsetSec = 0,
  gridResolutionMultiplier = 1,
  isPlaying,
  hotCues,
  loop,
  cuePointSec = 0,
  cachedWaveform,
  height = 72,
  zoom = 2,
  showBeatgrid = true,
  variant = 'scrolling',
  onSeek,
  onScratchOrBend,
  onReleaseScratch,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastClientXRef = useRef<number>(0);
  const scrubPosRef = useRef<number>(positionSec);
  scrubPosRef.current = positionSec;

  // Offscreen cache for overview waveform + reusable typed arrays for scrolling waveform (Zero per-frame GC)
  const overviewCacheRef = useRef<{
    peaks: unknown;
    targetW: number;
    targetH: number;
    dpr: number;
    unplayedCanvas: HTMLCanvasElement;
    playedCanvas: HTMLCanvasElement;
  } | null>(null);
  const scrollBuffersRef = useRef<{
    width: number;
    lowHeights: Float32Array;
    midHeights: Float32Array;
    highHeights: Float32Array;
    validMask: Uint8Array;
  } | null>(null);
  const reusableSampleRef = useRef({ low: 0, mid: 0, high: 0 });

  const sampleCount = variant === 'overview' ? 600 : 4800;

  // WAVEFORM DATA (Decoupled from rendering)
  const peaks = useMemo(() => {
    if (cachedWaveform) {
      const realSamples = convertCachedWaveformToSamples(
        cachedWaveform,
        variant
      );
      if (realSamples.length > 0) return realSamples;
    }
    return generateDeterministicWaveform(`${trackId}-${deckId}`, sampleCount);
  }, [cachedWaveform, variant, trackId, deckId, sampleCount]);

  // Keep live references to configuration props so the 60 FPS RAF loop never restarts unnecessarily
  const livePropsRef = useRef({
    peaks,
    positionSec,
    durationSec,
    bpm,
    baseBpm,
    firstBeatOffsetSec,
    gridResolutionMultiplier,
    hotCues,
    loop,
    cuePointSec,
    height,
    zoom,
    showBeatgrid,
    variant,
    deckId,
    isPlaying,
  });

  livePropsRef.current = {
    peaks,
    positionSec,
    durationSec,
    bpm,
    baseBpm,
    firstBeatOffsetSec,
    gridResolutionMultiplier,
    hotCues,
    loop,
    cuePointSec,
    height,
    zoom,
    showBeatgrid,
    variant,
    deckId,
    isPlaying,
  };

  const getLivePosition = (): number => {
    // If the user is actively dragging/scrubbing on this canvas, prioritize scrub position
    if (activePointerIdRef.current !== null) {
      return scrubPosRef.current;
    }
    try {
      const eng = deckId === 'A' ? realAudioEngine.deckA : realAudioEngine.deckB;
      if (eng && (isPlaying || eng.isPlaying() || eng.getIsScratchActive())) {
        const t = eng.getCurrentTime();
        if (Number.isFinite(t) && t >= 0) {
          scrubPosRef.current = t;
          return t;
        }
      }
    } catch {
      // fallback
    }
    return positionSec;
  };

  // WAVEFORM RENDERING FUNCTION (Continuous HD Multi-Layer Canvas Contour)
  const drawWaveformAtPos = (curSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      peaks: currentPeaks,
      durationSec: curDuration,
      bpm: curBpm,
      baseBpm: curBaseBpm,
      firstBeatOffsetSec: curOffset,
      gridResolutionMultiplier: curGridMult,
      hotCues: curCues,
      loop: curLoop,
      cuePointSec: curCuePoint,
      height: curHeight,
      zoom: curZoom,
      showBeatgrid: curShowGrid,
      variant: curVariant,
    } = livePropsRef.current;

    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const width = Math.max(100, canvas.clientWidth || 500);
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(curHeight * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const centerY = curHeight / 2;
    const progress =
      curDuration > 0 ? Math.min(1, Math.max(0, curSec / curDuration)) : 0;

    if (curVariant === 'overview') {
      // ======================================================================
      // HD OVERVIEW WAVEFORM (Offscreen Cached 1px High-Density Contour)
      // ======================================================================
      let cache = overviewCacheRef.current;
      if (
        !cache ||
        cache.peaks !== currentPeaks ||
        cache.targetW !== targetW ||
        cache.targetH !== targetH ||
        cache.dpr !== dpr
      ) {
        const unplayedCanvas =
          cache?.unplayedCanvas || document.createElement('canvas');
        const playedCanvas =
          cache?.playedCanvas || document.createElement('canvas');
        unplayedCanvas.width = targetW;
        unplayedCanvas.height = targetH;
        playedCanvas.width = targetW;
        playedCanvas.height = targetH;

        const uCtx = unplayedCanvas.getContext('2d');
        const pCtx = playedCanvas.getContext('2d');

        if (uCtx && pCtx) {
          uCtx.save();
          pCtx.save();
          uCtx.scale(dpr, dpr);
          pCtx.scale(dpr, dpr);

          uCtx.fillStyle = '#0D0F12';
          uCtx.fillRect(0, 0, width, curHeight);
          pCtx.fillStyle = '#0D0F12';
          pCtx.fillRect(0, 0, width, curHeight);

          const totalBuckets = currentPeaks.length;
          const samplesPerPx = totalBuckets / width;

          const sOverview = reusableSampleRef.current;
          for (let x = 0; x < width; x++) {
            const ratio = x / width;
            sampleWaveformAtRatioInto(currentPeaks, ratio, samplesPerPx, sOverview);
            const outerAmp = Math.max(1.2, sOverview.low * (curHeight * 0.46));
            const innerAmp = Math.max(0.8, sOverview.high * (curHeight * 0.25));

            uCtx.fillStyle = '#0099DB';
            uCtx.fillRect(x, centerY - outerAmp, 1.15, outerAmp * 2);
            uCtx.fillStyle = '#6FD1FF';
            uCtx.fillRect(x, centerY - innerAmp, 1.15, innerAmp * 2);

            pCtx.fillStyle = '#154B69';
            pCtx.fillRect(x, centerY - outerAmp, 1.15, outerAmp * 2);
            pCtx.fillStyle = '#246D94';
            pCtx.fillRect(x, centerY - innerAmp, 1.15, innerAmp * 2);
          }

          uCtx.restore();
          pCtx.restore();
        }

        cache = {
          peaks: currentPeaks,
          targetW,
          targetH,
          dpr,
          unplayedCanvas,
          playedCanvas,
        };
        overviewCacheRef.current = cache;
      }

      const playheadX = progress * width;
      const splitPx = Math.round(playheadX * dpr);

      // Blit unplayed background in 1 GPU operation, then overlay played slice
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cache.unplayedCanvas, 0, 0);
      if (splitPx > 0) {
        ctx.drawImage(
          cache.playedCanvas,
          0,
          0,
          splitPx,
          targetH,
          0,
          0,
          splitPx,
          targetH
        );
      }
      ctx.scale(dpr, dpr);

      // Active loop highlight on overview
      if (
        curLoop.active &&
        curLoop.inPointSec !== null &&
        curLoop.outPointSec !== null &&
        curDuration > 0
      ) {
        const xStart = (curLoop.inPointSec / curDuration) * width;
        const xEnd = (curLoop.outPointSec / curDuration) * width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(xStart, 0, Math.max(3, xEnd - xStart), curHeight);
      }

      // Cue point marker on overview
      if (curCuePoint > 0 && curDuration > 0) {
        const cueX = (curCuePoint / curDuration) * width;
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(cueX - 0.75, 0, 1.5, curHeight);
      }

      // Crisp white vertical playhead marker with top cap
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(playheadX - 0.75, 0, 1.5, curHeight);
      ctx.fillRect(playheadX - 2.5, 0, 5, 4.5);

      ctx.restore();
      return;
    }

    // ========================================================================
    // HD SCROLLING WAVEFORM (Smooth Continuous Multi-Band Contour + Beatgrid)
    // ========================================================================
    ctx.fillStyle = '#181A1E';
    ctx.fillRect(0, 0, width, curHeight);

    // Center horizontal zero-crossing baseline
    ctx.strokeStyle = '#262A32';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    const centerX = width / 2;
    const resolvedBaseBpm = curBaseBpm && curBaseBpm > 0 ? curBaseBpm : curBpm;
    const resolvedCurrentBpm = curBpm > 0 ? curBpm : resolvedBaseBpm;
    const visibleWindowSec = Math.max(2.5, 16 / curZoom);
    // Track seconds per pixel remains rock-solid so Beatgrid and peaks are 100% locked
    const secPerPixel = visibleWindowSec / width;
    const samplesPerPx =
      curDuration > 0 ? (secPerPixel / curDuration) * currentPeaks.length : 1;

    // Beatgrid vertical lines aligned with firstBeatOffsetSec, track baseBpm & gridResolutionMultiplier
    const effectiveTrackGridBpm =
      resolvedBaseBpm * Math.max(0.25, Math.min(4, curGridMult));
    if (curShowGrid && effectiveTrackGridBpm > 0) {
      const secPerBeat = 60 / effectiveTrackGridBpm;
      const firstVisibleSec = curSec - centerX * secPerPixel;
      const lastVisibleSec = curSec + centerX * secPerPixel;
      const firstBeatIndex = Math.floor(
        (firstVisibleSec - curOffset) / secPerBeat
      );
      const lastBeatIndex = Math.ceil(
        (lastVisibleSec - curOffset) / secPerBeat
      );

      for (let b = firstBeatIndex; b <= lastBeatIndex; b++) {
        const beatSec = curOffset + b * secPerBeat;
        if (beatSec < 0 || (curDuration > 0 && beatSec > curDuration)) continue;
        const x = centerX + (beatSec - curSec) / secPerPixel;
        if (x < 0 || x > width) continue;

        const isFirstAnchorBeat = b === 0;
        const isDownbeat = ((b % 4) + 4) % 4 === 0;
        ctx.strokeStyle = isFirstAnchorBeat
          ? '#0099DB'
          : isDownbeat
          ? 'rgba(255, 255, 255, 0.78)'
          : 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = isFirstAnchorBeat ? 2.0 : isDownbeat ? 1.4 : 0.9;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, curHeight);
        ctx.stroke();
      }
    }

    // Active loop region in scrolling view
    if (
      curLoop.active &&
      curLoop.inPointSec !== null &&
      curLoop.outPointSec !== null
    ) {
      const xStart = centerX + (curLoop.inPointSec - curSec) / secPerPixel;
      const xEnd = centerX + (curLoop.outPointSec - curSec) / secPerPixel;
      ctx.fillStyle = 'rgba(0, 153, 219, 0.16)';
      ctx.fillRect(xStart, 0, Math.max(4, xEnd - xStart), curHeight);
      ctx.strokeStyle = '#0099DB';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(xStart, 1, Math.max(4, xEnd - xStart), curHeight - 2);
    }

    // Pre-sample 1px HD columns across visible width for continuous polygon + transient rendering
    if (curDuration > 0) {
      let sBuf = scrollBuffersRef.current;
      if (!sBuf || sBuf.width !== width) {
        sBuf = {
          width,
          lowHeights: new Float32Array(width),
          midHeights: new Float32Array(width),
          highHeights: new Float32Array(width),
          validMask: new Uint8Array(width),
        };
        scrollBuffersRef.current = sBuf;
      }
      const { lowHeights, midHeights, highHeights, validMask } = sBuf;
      validMask.fill(0);

      const s = reusableSampleRef.current;
      for (let x = 0; x < width; x++) {
        const sampleSec = curSec + (x - centerX) * secPerPixel;
        if (sampleSec < 0 || sampleSec > curDuration) continue;
        validMask[x] = 1;
        const ratio = sampleSec / curDuration;
        sampleWaveformAtRatioInto(currentPeaks, ratio, samplesPerPx, s);
        lowHeights[x] = s.low * (curHeight * 0.45);
        midHeights[x] = s.mid * (curHeight * 0.31);
        highHeights[x] = s.high * (curHeight * 0.17);
      }

      const drawContinuousBand = (
        heights: Float32Array,
        fillColor: string,
        strokeColor?: string
      ) => {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        let started = false;
        let firstX = 0;
        let lastX = 0;

        for (let x = 0; x < width; x++) {
          if (!validMask[x]) continue;
          if (!started) {
            started = true;
            firstX = x;
            ctx.moveTo(x, centerY);
          }
          ctx.lineTo(x, centerY - heights[x]);
          lastX = x;
        }

        if (!started) return;

        for (let x = lastX; x >= firstX; x--) {
          if (!validMask[x]) continue;
          ctx.lineTo(x, centerY + heights[x]);
        }
        ctx.closePath();
        ctx.fill();

        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      };

      // Layer 1: Deep Low-Frequency Body
      drawContinuousBand(lowHeights, '#0082BF', 'rgba(0, 153, 219, 0.55)');
      // Layer 2: Mid-Range Harmonic Body
      drawContinuousBand(midHeights, '#2BB3F0');
      // Layer 3: High-Frequency Transient Core
      drawContinuousBand(highHeights, '#9CE2FF');
    }

    // Main CUE point marker
    const mainCueX = centerX + (curCuePoint - curSec) / secPerPixel;
    if (mainCueX >= 0 && mainCueX <= width) {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(mainCueX - 1, 0, 2, curHeight);
    }

    // Hot Cue Markers
    curCues.forEach((cue) => {
      if (cue.active && cue.positionSec !== null) {
        const cueX = centerX + (cue.positionSec - curSec) / secPerPixel;
        if (cueX >= 0 && cueX <= width) {
          ctx.fillStyle = '#F3F4F6';
          ctx.fillRect(cueX - 0.75, 0, 1.5, curHeight);
        }
      }
    });

    // Center white stationary playhead line
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(centerX - 1.25, 0, 2.5, curHeight);

    ctx.restore();
  };

  // 1. Static or parameter update render (runs immediately on any configuration prop change)
  useEffect(() => {
    drawWaveformAtPos(getLivePosition());
  }, [
    peaks,
    durationSec,
    bpm,
    baseBpm,
    firstBeatOffsetSec,
    gridResolutionMultiplier,
    hotCues,
    loop,
    cuePointSec,
    height,
    zoom,
    showBeatgrid,
    variant,
    deckId,
  ]);

  // 2. High-FPS requestAnimationFrame render loop (decoupled from React renders)
  // Runs at display refresh rate (60/120 FPS) during active playback, scratching, or dragging,
  // and rests with zero CPU overhead when stationary
  useEffect(() => {
    let animId = 0;
    let isRunning = true;
    let lastRenderedSec = -1;

    const tick = () => {
      if (!isRunning) return;
      const eng = deckId === 'A' ? realAudioEngine.deckA : realAudioEngine.deckB;
      const isAudioActive = Boolean(
        isPlaying ||
          (eng && (eng.isPlaying() || eng.getIsScratchActive())) ||
          activePointerIdRef.current !== null
      );

      const livePos = getLivePosition();

      // Only invoke canvas rasterization when audio is actively moving or position has changed
      if (isAudioActive || Math.abs(livePos - lastRenderedSec) > 0.002) {
        lastRenderedSec = livePos;
        drawWaveformAtPos(livePos);
      }

      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      isRunning = false;
      if (animId) {
        cancelAnimationFrame(animId);
      }
    };
  }, [isPlaying, deckId]);

  const seekOverviewAtClientX = (clientX: number) => {
    if (!onSeek || !canvasRef.current || durationSec <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickRatio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))
    );
    const targetSec = Number((clickRatio * durationSec).toFixed(2));
    scrubPosRef.current = targetSec;
    drawWaveformAtPos(targetSec);
    onSeek(targetSec);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onSeek || !canvasRef.current || durationSec <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture error
    }
    activePointerIdRef.current = e.pointerId;
    lastClientXRef.current = e.clientX;

    if (variant === 'overview') {
      seekOverviewAtClientX(e.clientX);
    } else {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickRatio = Math.min(
        1,
        Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width))
      );
      const offsetRatio = clickRatio - 0.5;
      // If tapping away from the center playhead, jump to that point immediately
      if (Math.abs(offsetRatio) > 0.04) {
        const visibleWindowSec = Math.max(2.5, 16 / zoom);
        const nextSec = Math.min(
          durationSec,
          Math.max(0, positionSec + offsetRatio * visibleWindowSec)
        );
        scrubPosRef.current = Number(nextSec.toFixed(2));
        onSeek(scrubPosRef.current);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      activePointerIdRef.current !== e.pointerId ||
      !onSeek ||
      !canvasRef.current ||
      durationSec <= 0
    ) {
      return;
    }
    e.preventDefault();

    if (variant === 'overview') {
      seekOverviewAtClientX(e.clientX);
    } else {
      // Smooth continuous drag-scrubbing / scratch / pitch-bend on scrolling HD waveform
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaPx = e.clientX - lastClientXRef.current;
      lastClientXRef.current = e.clientX;
      if (onScratchOrBend && Math.abs(deltaPx) > 0.2) {
        // Dragging waveform left = moving forward in song (+deltaDeg); dragging right = moving backward (-deltaDeg)
        onScratchOrBend(-deltaPx * 1.4);
      } else {
        const visibleWindowSec = Math.max(2.5, 16 / zoom);
        const secPerPixel = visibleWindowSec / Math.max(1, rect.width);
        const nextSec = Math.min(
          durationSec,
          Math.max(0, scrubPosRef.current - deltaPx * secPerPixel)
        );
        scrubPosRef.current = Number(nextSec.toFixed(2));
        drawWaveformAtPos(scrubPosRef.current);
        onSeek(scrubPosRef.current);
      }
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    onReleaseScratch?.();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release error
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{ height: `${height}px`, touchAction: 'none' }}
      className="w-full block cursor-ew-resize touch-none select-none"
    />
  );
});
