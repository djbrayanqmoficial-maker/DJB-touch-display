/**
 * DJ Core — Real Mixer Engine (Optimized Anti-Clip, Smooth Crossfader & Real-Time Master VU Meter)
 * Manages constant-power crossfader curve (Deck A vs Deck B mix),
 * Master output gain, Headphone Cue monitor gain, Master Soft-Knee Limiter,
 * and real-time stereo Master VU & Peak Hold metering.
 */

export interface MasterVuMeterState {
  left: number;       // 0 - 100 real-time Master Left level
  right: number;      // 0 - 100 real-time Master Right level
  master: number;     // 0 - 100 combined Master level
  peakLeft: number;   // 0 - 100 Peak Hold Left
  peakRight: number;  // 0 - 100 Peak Hold Right
  peakMaster: number; // 0 - 100 Peak Hold Master
}

export class MixerAudioEngine {
  private ctx: AudioContext;
  public readonly deckACrossfaderGain: GainNode;
  public readonly deckBCrossfaderGain: GainNode;
  public readonly masterGainNode: GainNode;
  public readonly headphoneGainNode: GainNode;
  public readonly masterLimiterNode: DynamicsCompressorNode;

  // Real-Time Stereo Master Output Analysers (Post-MasterGain)
  private masterSplitterNode: ChannelSplitterNode;
  private masterAnalyserL: AnalyserNode;
  private masterAnalyserR: AnalyserNode;
  private bufL: Float32Array<ArrayBuffer>;
  private bufR: Float32Array<ArrayBuffer>;

  // Smooth VU ballistics & Peak Hold state
  private smoothLeft = 0;
  private smoothRight = 0;
  private peakHoldLeft = 0;
  private peakHoldRight = 0;
  private peakHoldLeftTime = 0;
  private peakHoldRightTime = 0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.deckACrossfaderGain = ctx.createGain();
    this.deckBCrossfaderGain = ctx.createGain();
    this.masterGainNode = ctx.createGain();
    this.headphoneGainNode = ctx.createGain();

    // Soft-Knee Master Limiter prevents clipping when mixing 2 decks + EQ boost + FX
    this.masterLimiterNode = ctx.createDynamicsCompressor();
    this.masterLimiterNode.threshold.value = -1.5; // dB
    this.masterLimiterNode.knee.value = 6.0;       // dB soft knee
    this.masterLimiterNode.ratio.value = 12.0;     // Limiting ratio
    this.masterLimiterNode.attack.value = 0.002;   // 2ms fast transient catch
    this.masterLimiterNode.release.value = 0.085;  // 85ms musical release

    // Stereo Master VU Analyser tap connected directly to masterGainNode output
    // so Gain, EQ, Stems, Channel Volume, Crossfader, and Master Volume all drive the VU Meter
    this.masterSplitterNode = ctx.createChannelSplitter(2);
    this.masterAnalyserL = ctx.createAnalyser();
    this.masterAnalyserL.fftSize = 256;
    this.masterAnalyserR = ctx.createAnalyser();
    this.masterAnalyserR.fftSize = 256;

    this.bufL = new Float32Array(this.masterAnalyserL.fftSize);
    this.bufR = new Float32Array(this.masterAnalyserR.fftSize);

    this.deckACrossfaderGain.connect(this.masterGainNode);
    this.deckBCrossfaderGain.connect(this.masterGainNode);

    // Connect headphone bus in parallel for cue level control
    this.deckACrossfaderGain.connect(this.headphoneGainNode);
    this.deckBCrossfaderGain.connect(this.headphoneGainNode);

    this.masterGainNode.connect(this.masterLimiterNode);
    this.masterLimiterNode.connect(ctx.destination);

    // Tap real Master Stereo Bus for the Cross DJ style Master VU Meter
    this.masterGainNode.connect(this.masterSplitterNode);
    this.masterSplitterNode.connect(this.masterAnalyserL, 0);
    this.masterSplitterNode.connect(this.masterAnalyserR, 1);

    this.setCrossfader(0);
    this.setMasterLevel(82);
    this.setHeadphoneLevel(75);
  }

  /**
   * Crossfader position from -100 (Full Deck A) through 0 (Center A+B) to +100 (Full Deck B).
   * Uses smooth constant-power cosine curve so center maintains full punch without volume dips or jumps.
   */
  setCrossfader(position: number): void {
    const clamped = Math.min(100, Math.max(-100, position));
    const now = this.ctx.currentTime;

    let gainA = 1.0;
    let gainB = 1.0;

    if (clamped > 0) {
      const t = clamped / 100; // 0 to 1
      gainA = Math.cos(t * Math.PI * 0.5);
    } else if (clamped < 0) {
      const t = Math.abs(clamped) / 100; // 0 to 1
      gainB = Math.cos(t * Math.PI * 0.5);
    }

    this.deckACrossfaderGain.gain.setTargetAtTime(gainA, now, 0.008);
    this.deckBCrossfaderGain.gain.setTargetAtTime(gainB, now, 0.008);
  }

  setMasterLevel(levelPercent: number): void {
    const norm = Math.min(100, Math.max(0, levelPercent)) / 100;
    const gain = Math.pow(norm, 1.35);
    this.masterGainNode.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
  }

  setHeadphoneLevel(levelPercent: number): void {
    const norm = Math.min(100, Math.max(0, levelPercent)) / 100;
    const gain = Math.pow(norm, 1.35);
    this.headphoneGainNode.gain.setTargetAtTime(
      gain,
      this.ctx.currentTime,
      0.01
    );
  }

  /**
   * Computes real-time Master Stereo VU level & Peak Hold (0 - 100) from the live Master PCM stream.
   * Remains at 0 when no audio is playing, and responds directly to music, Gain, EQ, Volume, and Master level.
   */
  getMasterVuState(): MasterVuMeterState {
    this.masterAnalyserL.getFloatTimeDomainData(this.bufL);
    this.masterAnalyserR.getFloatTimeDomainData(this.bufR);

    const len = this.bufL.length;
    let sumSqL = 0;
    let sumSqR = 0;
    let maxAbsL = 0;
    let maxAbsR = 0;

    for (let i = 0; i < len; i++) {
      const sl = Math.abs(this.bufL[i]);
      const sr = Math.abs(this.bufR[i]);
      sumSqL += sl * sl;
      sumSqR += sr * sr;
      if (sl > maxAbsL) maxAbsL = sl;
      if (sr > maxAbsR) maxAbsR = sr;
    }

    const nowMs = performance.now();

    // Silence threshold check: when no music is playing, decay smoothly to 0
    if (maxAbsL < 0.0008 && maxAbsR < 0.0008) {
      this.smoothLeft = this.smoothLeft > 0.6 ? this.smoothLeft * 0.72 : 0;
      this.smoothRight = this.smoothRight > 0.6 ? this.smoothRight * 0.72 : 0;
      this.peakHoldLeft = this.peakHoldLeft > 0.8 ? this.peakHoldLeft * 0.82 : 0;
      this.peakHoldRight =
        this.peakHoldRight > 0.8 ? this.peakHoldRight * 0.82 : 0;

      const l = Math.round(this.smoothLeft);
      const r = Math.round(this.smoothRight);
      const pl = Math.round(this.peakHoldLeft);
      const pr = Math.round(this.peakHoldRight);
      return {
        left: l,
        right: r,
        master: Math.max(l, r),
        peakLeft: pl,
        peakRight: pr,
        peakMaster: Math.max(pl, pr),
      };
    }

    const rmsL = Math.sqrt(sumSqL / len);
    const rmsR = Math.sqrt(sumSqR / len);

    // Combine RMS body + transient Peak with professional DJ broadcast ballistics
    const envL = rmsL * 0.50 + maxAbsL * 0.50;
    const envR = rmsR * 0.50 + maxAbsR * 0.50;

    const rawLevelL = Math.min(100, Math.pow(envL, 0.56) * 118);
    const rawLevelR = Math.min(100, Math.pow(envR, 0.56) * 118);

    // Instant transient attack (85%), smooth musical VU decay (approx 280-300ms return)
    this.smoothLeft =
      rawLevelL > this.smoothLeft
        ? 0.15 * this.smoothLeft + 0.85 * rawLevelL
        : 0.85 * this.smoothLeft + 0.15 * rawLevelL;

    this.smoothRight =
      rawLevelR > this.smoothRight
        ? 0.15 * this.smoothRight + 0.85 * rawLevelR
        : 0.85 * this.smoothRight + 0.15 * rawLevelR;

    // True Peak Hold with 400ms hold time + linear gravity release
    const instPeakL = Math.min(100, Math.pow(maxAbsL, 0.52) * 116);
    const instPeakR = Math.min(100, Math.pow(maxAbsR, 0.52) * 116);

    if (instPeakL >= this.peakHoldLeft) {
      this.peakHoldLeft = instPeakL;
      this.peakHoldLeftTime = nowMs;
    } else if (nowMs - this.peakHoldLeftTime > 400) {
      this.peakHoldLeft = Math.max(this.smoothLeft, this.peakHoldLeft - 2.5);
    }

    if (instPeakR >= this.peakHoldRight) {
      this.peakHoldRight = instPeakR;
      this.peakHoldRightTime = nowMs;
    } else if (nowMs - this.peakHoldRightTime > 400) {
      this.peakHoldRight = Math.max(this.smoothRight, this.peakHoldRight - 2.5);
    }

    const l = Math.min(100, Math.max(0, Math.round(this.smoothLeft)));
    const r = Math.min(100, Math.max(0, Math.round(this.smoothRight)));
    const pl = Math.min(100, Math.max(l, Math.round(this.peakHoldLeft)));
    const pr = Math.min(100, Math.max(r, Math.round(this.peakHoldRight)));

    return {
      left: l,
      right: r,
      master: Math.max(l, r),
      peakLeft: pl,
      peakRight: pr,
      peakMaster: Math.max(pl, pr),
    };
  }
}
