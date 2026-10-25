/**
 * DJB Core — Waveform Data Engine (Separated from Visual Rendering)
 *
 * WAVEFORM DATA:
 * - Manages high-resolution multi-band audio amplitude data (600 overview + 4,800 detail samples).
 * - Provides sub-sample continuous interpolation so WaveformCanvas renders smooth, fluid contours
 *   at any zoom level (1x to 6x) without blocky rectangles.
 */

import { CachedWaveformRecord } from '../database/TrackDatabase';

export interface WaveformPeakSample {
  low: number;  // 0.0 - 1.0 (Sub/Bass body)
  mid: number;  // 0.0 - 1.0 (Mid harmonic body)
  high: number; // 0.0 - 1.0 (High transient detail)
}

export function convertCachedWaveformToSamples(
  cached: CachedWaveformRecord | null | undefined,
  variant: 'overview' | 'scrolling'
): WaveformPeakSample[] {
  if (!cached) return [];
  if (variant === 'overview') {
    return cached.overviewPeaks.map((p) => ({
      low: p,
      mid: p * 0.78,
      high: p * 0.48,
    }));
  }

  const len = Math.min(
    cached.detailLow.length,
    cached.detailMid.length,
    cached.detailHigh.length
  );
  const samples: WaveformPeakSample[] = new Array(len);
  for (let i = 0; i < len; i++) {
    samples[i] = {
      low: cached.detailLow[i],
      mid: cached.detailMid[i],
      high: cached.detailHigh[i],
    };
  }
  return samples;
}

/**
 * Continuous sub-sample interpolation at a normalized track ratio (0.0 - 1.0)
 * with window-max transient preservation when zoomed out and smooth cosine interpolation when zoomed in.
 */
export function sampleWaveformAtRatioInto(
  peaks: WaveformPeakSample[],
  ratio: number,
  windowSpanSamples: number,
  out: WaveformPeakSample
): WaveformPeakSample {
  const len = peaks.length;
  if (len === 0 || ratio < 0 || ratio > 1) {
    out.low = 0;
    out.mid = 0;
    out.high = 0;
    return out;
  }

  const exactIdx = ratio * (len - 1);

  // If 1 screen pixel spans multiple waveform data buckets, aggregate peak + RMS so transients are never lost
  if (windowSpanSamples >= 1.5) {
    const half = Math.min(16, Math.ceil(windowSpanSamples * 0.5));
    const center = Math.round(exactIdx);
    const start = Math.max(0, center - half);
    const end = Math.min(len - 1, center + half);

    let maxL = 0;
    let maxM = 0;
    let maxH = 0;
    let sumL = 0;
    let sumM = 0;
    let sumH = 0;
    let count = 0;

    for (let i = start; i <= end; i++) {
      const s = peaks[i];
      if (s.low > maxL) maxL = s.low;
      if (s.mid > maxM) maxM = s.mid;
      if (s.high > maxH) maxH = s.high;
      sumL += s.low;
      sumM += s.mid;
      sumH += s.high;
      count++;
    }

    if (count === 0) {
      out.low = 0;
      out.mid = 0;
      out.high = 0;
      return out;
    }

    out.low = maxL * 0.68 + (sumL / count) * 0.32;
    out.mid = maxM * 0.68 + (sumM / count) * 0.32;
    out.high = maxH * 0.75 + (sumH / count) * 0.25;
    return out;
  }

  // Sub-sample cosine interpolation when zoomed in
  const i0 = Math.max(0, Math.min(len - 1, Math.floor(exactIdx)));
  const i1 = Math.min(len - 1, i0 + 1);
  const frac = exactIdx - i0;
  const mu = (1 - Math.cos(frac * Math.PI)) * 0.5;

  const s0 = peaks[i0];
  const s1 = peaks[i1];

  out.low = s0.low * (1 - mu) + s1.low * mu;
  out.mid = s0.mid * (1 - mu) + s1.mid * mu;
  out.high = s0.high * (1 - mu) + s1.high * mu;
  return out;
}

export function sampleWaveformAtRatio(
  peaks: WaveformPeakSample[],
  ratio: number,
  windowSpanSamples: number
): WaveformPeakSample {
  return sampleWaveformAtRatioInto(peaks, ratio, windowSpanSamples, {
    low: 0,
    mid: 0,
    high: 0,
  });
}

export function generateDeterministicWaveform(
  seedString: string,
  sampleCount = 600
): WaveformPeakSample[] {
  let hash = 2166136261;
  for (let i = 0; i < seedString.length; i++) {
    hash ^= seedString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const samples: WaveformPeakSample[] = new Array(sampleCount);
  let smoothL = 0.5;
  let smoothM = 0.4;
  let smoothH = 0.3;

  for (let i = 0; i < sampleCount; i++) {
    hash ^= i * 37;
    hash = Math.imul(hash, 16777619);
    const norm = Math.abs(hash % 1000) / 1000;
    const posRatio = i / sampleCount;
    let envelope = 0.88;
    if (posRatio < 0.07 || posRatio > 0.91) envelope = 0.45;
    else if (posRatio > 0.38 && posRatio < 0.5) envelope = 0.38;

    const beatPhase = (i % 16) / 16;
    const beatPulse = Math.exp(-beatPhase * 3.2);
    const rawL = Math.min(1, (0.32 + norm * 0.68) * envelope * (0.55 + 0.45 * beatPulse));
    const rawM = Math.min(1, (0.24 + ((norm * 7) % 1) * 0.66) * envelope);
    const rawH = Math.min(1, (0.14 + ((norm * 13) % 1) * 0.78) * envelope);

    smoothL = smoothL * 0.55 + rawL * 0.45;
    smoothM = smoothM * 0.55 + rawM * 0.45;
    smoothH = smoothH * 0.4 + rawH * 0.6;

    samples[i] = { low: smoothL, mid: smoothM, high: smoothH };
  }
  return samples;
}
