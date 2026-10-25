/**
 * DJ Core — Pre-Primed Beat-Synced Stem Echo Engine (Pads 5, 6, 8)
 *
 * Implements a reliable, short-duration musical DJ Echo-Out locked to the song's BPM:
 * - Continuously primes the delay line with the pre-fader stem signal while inactive
 *   (with wetOutputGain = 0 and feedbackGain = 0), so the delay buffer ALWAYS holds
 *   the exact musical phrase that was playing right when the DJ presses the pad!
 * - When triggered (Vocal Echo, Instrumental Echo, or Drums Echo):
 *   Immediately opens wetOutputGain and feedbackGain (~0.44 for 4 crisp musical repeats),
 *   holds the capture gate open for 1/2 beat (~240ms), and then closes the capture gate
 *   so the phrase echoes out rhythmically in time with the Beat Grid.
 * - Retires cleanly when the Stem FX pad is turned OFF.
 */

import { BeatSyncEngine, MusicalBeatDivision } from './BeatSyncEngine';

export type StemEchoMode = 'ECHO_OUT_CAPTURE' | 'CONTINUOUS_STEM_ECHO';

export interface StemEchoConfig {
  mode: StemEchoMode;
  division: MusicalBeatDivision;
  feedback: number; // Short musical DJ Echo: ~0.42 .. 0.46 (4 repeats)
  highPassHz: number;
  lowPassHz: number;
  wetLevel: number;
}

export class StemEchoUnit {
  private ctx: AudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  private config: StemEchoConfig;
  private isActive = false;
  private currentBpm = 124.0;

  // Audio Graph Nodes
  private preCaptureGate: GainNode;
  private delayNode: DelayNode;
  private feedbackGain: GainNode;
  private highPassFilter: BiquadFilterNode;
  private lowPassFilter: BiquadFilterNode;
  private wetOutputGain: GainNode;

  // Short DJ Echo-Out timers
  private captureCutoffTimer: ReturnType<typeof setTimeout> | null = null;
  private tailDampTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: AudioContext, config: StemEchoConfig) {
    this.ctx = ctx;
    this.config = config;

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    // Keep preCaptureGate at 1.0 while inactive so delayNode is always primed with the latest stem audio
    this.preCaptureGate = ctx.createGain();
    this.preCaptureGate.gain.value = 1.0;

    // Band-limiting filters for warm, clean DJ echo repeats
    this.highPassFilter = ctx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = config.highPassHz;
    this.highPassFilter.Q.value = 0.707;

    this.lowPassFilter = ctx.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = config.lowPassHz;
    this.lowPassFilter.Q.value = 0.707;

    // Tight BPM-synced stereo delay line
    this.delayNode = ctx.createDelay(2.0);
    const initialDelaySec = BeatSyncEngine.getDivisionDurationSec(
      this.currentBpm,
      config.division,
      0.06,
      0.65
    );
    this.delayNode.delayTime.value = initialDelaySec;

    this.feedbackGain = ctx.createGain();
    this.feedbackGain.gain.value = 0.0;

    this.wetOutputGain = ctx.createGain();
    this.wetOutputGain.gain.value = 0.0;

    // Connect Audio Graph:
    // inputNode -> preCaptureGate -> highPassFilter -> lowPassFilter -> delayNode -> wetOutputGain -> outputNode
    this.inputNode.connect(this.preCaptureGate);
    this.preCaptureGate.connect(this.highPassFilter);
    this.highPassFilter.connect(this.lowPassFilter);
    this.lowPassFilter.connect(this.delayNode);

    // Feedback loop through band-pass filters so each repeat warms and decays naturally
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.highPassFilter);

    this.delayNode.connect(this.wetOutputGain);
    this.wetOutputGain.connect(this.outputNode);
  }

  private clearTimers(): void {
    if (this.captureCutoffTimer) {
      clearTimeout(this.captureCutoffTimer);
      this.captureCutoffTimer = null;
    }
    if (this.tailDampTimer) {
      clearTimeout(this.tailDampTimer);
      this.tailDampTimer = null;
    }
  }

  /**
   * Updates the delay time dynamically whenever the song's BPM or pitch changes.
   */
  public setBpm(bpm: number): void {
    const safeBpm = BeatSyncEngine.resolveEffectiveBpm(bpm);
    if (Math.abs(safeBpm - this.currentBpm) < 0.02) return;
    this.currentBpm = safeBpm;

    const now = this.ctx.currentTime;
    const delaySec = BeatSyncEngine.getDivisionDurationSec(
      this.currentBpm,
      this.config.division,
      0.06,
      0.65
    );
    this.delayNode.delayTime.setTargetAtTime(delaySec, now, 0.015);
  }

  /**
   * Activates or deactivates the short musical DJ Stem Echo.
   */
  public setActive(active: boolean, bpm?: number): void {
    if (bpm !== undefined) {
      this.setBpm(bpm);
    }

    if (active === this.isActive) return;
    this.isActive = active;
    this.clearTimers();

    const now = this.ctx.currentTime;
    const delaySec = BeatSyncEngine.getDivisionDurationSec(
      this.currentBpm,
      this.config.division,
      0.06,
      0.65
    );
    this.delayNode.delayTime.setTargetAtTime(delaySec, now, 0.01);

    if (active) {
      // Musical feedback (~0.44 -> 4 clean rhythmic repeats)
      const musicalFeedback = Math.min(
        0.48,
        Math.max(0.38, this.config.feedback)
      );
      this.preCaptureGate.gain.cancelScheduledValues(now);
      this.feedbackGain.gain.cancelScheduledValues(now);
      this.wetOutputGain.gain.cancelScheduledValues(now);

      this.preCaptureGate.gain.setTargetAtTime(1.0, now, 0.004);
      this.wetOutputGain.gain.setTargetAtTime(
        this.config.wetLevel,
        now,
        0.005
      );
      this.feedbackGain.gain.setTargetAtTime(musicalFeedback, now, 0.005);

      // Hold capture open for 1/2 beat (~220ms) then close input so the captured phrase echoes out cleanly
      const captureWindowMs = Math.max(
        160,
        Math.min(
          320,
          Math.round(
            BeatSyncEngine.getDivisionDurationSec(this.currentBpm, '1/2') * 1000
          )
        )
      );

      this.captureCutoffTimer = setTimeout(() => {
        this.captureCutoffTimer = null;
        if (!this.isActive) return;
        const tCut = this.ctx.currentTime;
        this.preCaptureGate.gain.setTargetAtTime(0.0, tCut, 0.018);
      }, captureWindowMs);

      // Damp feedback after ~4.5 repeats (~1.1s) so the echo finishes cleanly without dragging
      const totalEchoDurationMs = Math.max(
        650,
        Math.min(1350, Math.round(delaySec * 4.8 * 1000))
      );
      this.tailDampTimer = setTimeout(() => {
        this.tailDampTimer = null;
        if (!this.isActive) return;
        const tEnd = this.ctx.currentTime;
        this.feedbackGain.gain.setTargetAtTime(0.0, tEnd, 0.03);
        this.wetOutputGain.gain.setTargetAtTime(0.0, tEnd, 0.04);
      }, totalEchoDurationMs);
    } else {
      // Retire the Stem Echo and re-prime preCaptureGate for the next trigger
      this.feedbackGain.gain.setTargetAtTime(0.0, now, 0.01);
      this.wetOutputGain.gain.setTargetAtTime(0.0, now, 0.012);
      this.preCaptureGate.gain.setTargetAtTime(1.0, now, 0.025);
    }
  }
}
