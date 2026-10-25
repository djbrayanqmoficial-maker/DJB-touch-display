/**
 * DJ Core — Zero-Glitch Off-Main-Thread Instrumental Breaker Engine (PAD 7)
 *
 * Runs 100% off the main UI thread using an AudioWorkletProcessor (with native C++
 * Web Audio AudioParam automation fallback) so it NEVER blocks or stutters audio playback.
 *
 * Optimizations:
 * 1. Singleton per-AudioContext Worklet Module loader (prevents duplicate registration errors across Deck A & Deck B).
 * 2. Zero-CPU Idle Bypass when PAD 7 is OFF (`!this.isActive`).
 * 3. Live Forward Vinyl Deceleration: starts at `readPos = 0, writeIdx = 0` at the exact instant PAD 7 is pressed
 *    and smoothly decelerates playback rate from 1.0x down to 0.0x with a rhythmic 1/4-beat breaker gate.
 */

import { BeatSyncEngine } from './BeatSyncEngine';

const BREAKER_WORKLET_CODE = `
class DjbInstrumentalBreakerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sr = sampleRate || 44100;
    this.ringLen = Math.floor(this.sr * 2.5);
    this.ringL = new Float32Array(this.ringLen);
    this.ringR = new Float32Array(this.ringLen);
    this.writeIdx = 0;
    this.readPos = 0.0;

    this.isActive = false;
    this.brakeFinished = false;
    this.elapsedSec = 0;
    this.totalBrakeSec = 0.96;
    this.subBeatSec = 0.12;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === 'SET_ACTIVE') {
        const nextActive = Boolean(msg.active);
        const bpm = Number(msg.bpm) || 124;
        const beatSec = 60.0 / Math.max(30, Math.min(260, bpm));
        this.subBeatSec = beatSec * 0.25;
        if (nextActive && !this.isActive) {
          this.totalBrakeSec = Math.min(2.0, Math.max(0.35, beatSec * 2.0));
          this.elapsedSec = 0;
          this.brakeFinished = false;
          this.writeIdx = 0;
          this.readPos = 0.0;
          this.isActive = true;
        } else if (!nextActive) {
          this.isActive = false;
          this.brakeFinished = false;
          this.elapsedSec = 0;
        }
      } else if (msg.type === 'SET_BPM') {
        const bpm = Number(msg.bpm) || 124;
        const beatSec = 60.0 / Math.max(30, Math.min(260, bpm));
        this.subBeatSec = beatSec * 0.25;
      }
    };
  }

  process(inputs, outputs) {
    // Zero-CPU fast path when Pad 7 is not active or has finished braking
    if (!this.isActive || this.brakeFinished) {
      return true;
    }

    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const outL = output[0];
    const outR = output.length > 1 && output[1] ? output[1] : outL;
    const inL = input && input[0] ? input[0] : null;
    const inR = input && input.length > 1 && input[1] ? input[1] : inL;

    if (!inL || !inR) {
      return true;
    }

    const n = outL.length;
    const rLen = this.ringLen;
    const dt = 1.0 / this.sr;
    const subSec = Math.max(0.04, this.subBeatSec);

    for (let i = 0; i < n; i++) {
      // Record incoming live instrumental sample into ring buffer
      const wIdx = this.writeIdx % rLen;
      this.ringL[wIdx] = inL[i];
      this.ringR[wIdx] = inR[i];
      this.writeIdx++;

      const progress = this.elapsedSec / this.totalBrakeSec;
      if (progress >= 1.0) {
        this.brakeFinished = true;
        outL[i] = 0;
        outR[i] = 0;
        continue;
      }

      // Smooth vinyl turntable motor deceleration curve (1.0x -> 0.0x)
      const rem = 1.0 - progress;
      const rate = rem * (0.35 + 0.65 * rem);

      // Rhythmic 1/4-beat breaker stutter gate
      const phase = (this.elapsedSec % subSec) / subSec;
      const gate = progress < 0.84 ? (phase < 0.72 ? 1.0 : 0.26) : 1.0;
      const tailFade = progress > 0.85 ? (1.0 - progress) / 0.15 : 1.0;

      const idx0 = (this.readPos | 0) % rLen;
      const idx1 = (idx0 + 1) % rLen;
      const frac = this.readPos - (this.readPos | 0);

      const sL = this.ringL[idx0] * (1.0 - frac) + this.ringL[idx1] * frac;
      const sR = this.ringR[idx0] * (1.0 - frac) + this.ringR[idx1] * frac;

      const g = gate * tailFade * 1.05;
      outL[i] = sL * g;
      outR[i] = sR * g;

      this.readPos += rate;
      this.elapsedSec += dt;
    }

    return true;
  }
}

registerProcessor('djb-instrumental-breaker-worklet', DjbInstrumentalBreakerProcessor);
`;

const breakerWorkletLoadMap = new WeakMap<AudioContext, Promise<void>>();

function ensureBreakerWorkletLoaded(ctx: AudioContext): Promise<void> {
  let existing = breakerWorkletLoadMap.get(ctx);
  if (!existing) {
    existing = (async () => {
      const blob = new Blob([BREAKER_WORKLET_CODE], {
        type: 'application/javascript',
      });
      const url = URL.createObjectURL(blob);
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    breakerWorkletLoadMap.set(ctx, existing);
  }
  return existing;
}

export class InstrumentalBreakerEngine {
  private ctx: AudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  private workletNode: AudioWorkletNode | null = null;
  private isActive = false;
  private currentBpm = 124.0;

  // Native C++ Web Audio fallback nodes (used only if AudioWorklet hasn't finished loading)
  private fallbackDelayNode: DelayNode;
  private fallbackFilterNode: BiquadFilterNode;
  private fallbackGateGain: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    // Native C++ fallback nodes (0% main-thread CPU)
    this.fallbackDelayNode = ctx.createDelay(1.5);
    this.fallbackDelayNode.delayTime.value = 0.01;

    this.fallbackFilterNode = ctx.createBiquadFilter();
    this.fallbackFilterNode.type = 'lowpass';
    this.fallbackFilterNode.frequency.value = 16000;

    this.fallbackGateGain = ctx.createGain();
    this.fallbackGateGain.gain.value = 0.0;

    this.inputNode.connect(this.fallbackDelayNode);
    this.fallbackDelayNode.connect(this.fallbackFilterNode);
    this.fallbackFilterNode.connect(this.fallbackGateGain);
    this.fallbackGateGain.connect(this.outputNode);

    void this.initWorklet();
  }

  private async initWorklet(): Promise<void> {
    if (
      typeof AudioWorkletNode === 'undefined' ||
      !this.ctx.audioWorklet ||
      typeof this.ctx.audioWorklet.addModule !== 'function'
    ) {
      return;
    }

    try {
      await ensureBreakerWorkletLoaded(this.ctx);

      const node = new AudioWorkletNode(
        this.ctx,
        'djb-instrumental-breaker-worklet',
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        }
      );

      this.inputNode.connect(node);
      node.connect(this.outputNode);
      this.workletNode = node;
    } catch {
      // Keep native C++ AudioParam fallback if AudioWorklet registration fails
    }
  }

  public setBpm(bpm: number): void {
    this.currentBpm = BeatSyncEngine.resolveEffectiveBpm(bpm);
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'SET_BPM',
        bpm: this.currentBpm,
      });
    }
  }

  public setActive(active: boolean, bpm?: number): void {
    if (bpm !== undefined) {
      this.setBpm(bpm);
    }
    if (active === this.isActive) return;
    this.isActive = active;

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'SET_ACTIVE',
        active,
        bpm: this.currentBpm,
      });
      return;
    }

    // Native C++ AudioParam fallback if triggered before worklet finishes loading
    const now = this.ctx.currentTime;
    this.fallbackGateGain.gain.cancelScheduledValues(now);
    this.fallbackDelayNode.delayTime.cancelScheduledValues(now);
    this.fallbackFilterNode.frequency.cancelScheduledValues(now);

    if (active) {
      const brakeSec = BeatSyncEngine.getDivisionDurationSec(
        this.currentBpm,
        '2/1',
        0.4,
        1.8
      );
      this.fallbackDelayNode.delayTime.setValueAtTime(0.01, now);
      this.fallbackDelayNode.delayTime.linearRampToValueAtTime(
        0.55,
        now + brakeSec
      );
      this.fallbackFilterNode.frequency.setValueAtTime(14000, now);
      this.fallbackFilterNode.frequency.exponentialRampToValueAtTime(
        180,
        now + brakeSec
      );
      this.fallbackGateGain.gain.setValueAtTime(1.0, now);
      this.fallbackGateGain.gain.linearRampToValueAtTime(
        0.0,
        now + brakeSec
      );
    } else {
      this.fallbackGateGain.gain.setTargetAtTime(0.0, now, 0.012);
      this.fallbackDelayNode.delayTime.setTargetAtTime(0.01, now, 0.02);
    }
  }
}
