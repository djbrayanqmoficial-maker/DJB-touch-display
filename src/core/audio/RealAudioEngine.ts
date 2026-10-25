/**
 * DJ Core — Master Real Audio Engine Coordinator
 * Coordinates the Web Audio API context, Deck A & Deck B engines,
 * MixerAudioEngine, and real synthesized Performance Sampler Pads
 * (One-Shot, Looping, Stop, and Individual Slot Volume).
 */

import { SingleDeckAudioEngine } from '../deck/DeckEngine';
import { MixerAudioEngine } from '../mixer/MixerEngine';

interface ActiveSamplerVoice {
  slotKey: string;
  outGain: GainNode;
  masterGainPercent: number;
  padVolumePercent: number;
  loopTimer: ReturnType<typeof setInterval> | null;
  stopCallback: () => void;
}

class RealAudioEngineCoordinator {
  private ctx: AudioContext | null = null;
  public mixerEngine: MixerAudioEngine | null = null;
  public deckA: SingleDeckAudioEngine | null = null;
  public deckB: SingleDeckAudioEngine | null = null;
  private activeSamplerVoices: Map<string, ActiveSamplerVoice> = new Map();

  ensureInitialized(): {
    ctx: AudioContext;
    mixerEngine: MixerAudioEngine;
    deckA: SingleDeckAudioEngine;
    deckB: SingleDeckAudioEngine;
  } {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      try {
        this.ctx = new AudioCtx({ latencyHint: 'playback' });
      } catch {
        this.ctx = new AudioCtx();
      }
      this.mixerEngine = new MixerAudioEngine(this.ctx);
      this.deckA = new SingleDeckAudioEngine(
        'A',
        this.ctx,
        this.mixerEngine.deckACrossfaderGain
      );
      this.deckB = new SingleDeckAudioEngine(
        'B',
        this.ctx,
        this.mixerEngine.deckBCrossfaderGain
      );
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return {
      ctx: this.ctx,
      mixerEngine: this.mixerEngine!,
      deckA: this.deckA!,
      deckB: this.deckB!,
    };
  }

  /**
   * Stops an active Sampler Pad slot immediately (one-shot or looping).
   */
  stopSamplerSlot(slotKey: string): void {
    const existing = this.activeSamplerVoices.get(slotKey);
    if (!existing) return;
    if (existing.loopTimer !== null) {
      clearInterval(existing.loopTimer);
      existing.loopTimer = null;
    }
    try {
      existing.stopCallback();
    } catch {
      // Ignore already stopped
    }
    this.activeSamplerVoices.delete(slotKey);
  }

  /**
   * Adjusts live volume of an active Sampler Pad slot.
   */
  setSamplerSlotVolume(
    slotKey: string,
    padVolumePercent: number,
    masterGainPercent = 80
  ): void {
    const existing = this.activeSamplerVoices.get(slotKey);
    if (!existing || !this.ctx) return;
    existing.padVolumePercent = padVolumePercent;
    existing.masterGainPercent = masterGainPercent;
    const combinedGain =
      (Math.max(0, Math.min(100, masterGainPercent)) / 100) *
      (Math.max(0, Math.min(100, padVolumePercent)) / 100) *
      0.85;
    existing.outGain.gain.setTargetAtTime(
      combinedGain,
      this.ctx.currentTime,
      0.015
    );
  }

  /**
   * Synthesizes a single hit of the requested Sampler Pad voice into `destinationGain`.
   * Returns duration in milliseconds of the synthesized sample.
   */
  private triggerSingleSampleBurst(
    ctx: AudioContext,
    destinationGain: GainNode,
    padLabel: string
  ): number {
    const now = ctx.currentTime;
    const hitGain = ctx.createGain();
    hitGain.gain.value = 1.0;
    hitGain.connect(destinationGain);

    const upper = padLabel.toUpperCase();

    if (
      upper.includes('KICK') ||
      upper.includes('PUNCH') ||
      upper.includes('CLUB')
    ) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
      hitGain.gain.setValueAtTime(0.95, now);
      hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(hitGain);
      osc.start(now);
      osc.stop(now + 0.38);
      return 380;
    }

    if (upper.includes('SUB') || upper.includes('DROP') || upper.includes('IMPACT')) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.55);
      hitGain.gain.setValueAtTime(0.95, now);
      hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(hitGain);
      osc.start(now);
      osc.stop(now + 0.62);
      return 620;
    }

    if (
      upper.includes('SNARE') ||
      upper.includes('CLAP') ||
      upper.includes('GUNSHOT')
    ) {
      const bufSize = Math.floor(ctx.sampleRate * 0.25);
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] =
          (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = upper.includes('CLAP') ? 1250 : 920;
      noise.connect(filter);
      filter.connect(hitGain);
      noise.start(now);
      return 260;
    }

    if (
      upper.includes('HAT') ||
      upper.includes('RIDE') ||
      upper.includes('NOISE')
    ) {
      const dur =
        upper.includes('OPEN') ||
        upper.includes('RIDE') ||
        upper.includes('NOISE')
          ? 0.36
          : 0.1;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] =
          (Math.random() * 2 - 1) *
          Math.exp(-i / (ctx.sampleRate * (dur * 0.4)));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = upper.includes('NOISE') ? 2200 : 6500;
      noise.connect(hp);
      hp.connect(hitGain);
      noise.start(now);
      return Math.round(dur * 1000);
    }

    if (upper.includes('LASER') || upper.includes('RISER')) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      if (upper.includes('RISER')) {
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.55);
      } else {
        osc.frequency.setValueAtTime(1600, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.24);
      }
      const dur = upper.includes('RISER') ? 0.58 : 0.26;
      hitGain.gain.setValueAtTime(0.6, now);
      hitGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(hitGain);
      osc.start(now);
      osc.stop(now + dur + 0.02);
      return Math.round(dur * 1000);
    }

    if (upper.includes('SYNTH') || upper.includes('VOCAL')) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      const rootFreq = upper.includes('VOCAL') ? 440 : 330;
      osc1.frequency.setValueAtTime(rootFreq, now);
      osc2.frequency.setValueAtTime(rootFreq * 1.5, now);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.35);
      hitGain.gain.setValueAtTime(0.55, now);
      hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(hitGain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
      return 400;
    }

    // Default: Horn / Siren / Gong
    const osc = ctx.createOscillator();
    osc.type = upper.includes('GONG') ? 'triangle' : 'sawtooth';
    if (upper.includes('SIREN')) {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.25);
      osc.frequency.linearRampToValueAtTime(520, now + 0.5);
    } else {
      osc.frequency.setValueAtTime(upper.includes('GONG') ? 220 : 415, now);
    }
    hitGain.gain.setValueAtTime(0.55, now);
    hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(hitGain);
    osc.start(now);
    osc.stop(now + 0.56);
    return 560;
  }

  /**
   * Triggers a real synthesized drum/SFX sample when the user taps a Performance Pad.
   * Supports One-Shot and Loop modes, individual pad volume, and completion callbacks.
   */
  triggerSamplerPad(
    padLabel: string,
    gainPercent = 75,
    options?: {
      slotKey?: string;
      padVolumePercent?: number;
      loop?: boolean;
      onEnded?: () => void;
    }
  ): void {
    const { ctx, mixerEngine } = this.ensureInitialized();
    const slotKey = options?.slotKey || `default:${padLabel}`;
    const padVol = options?.padVolumePercent ?? 90;
    const isLoop = Boolean(options?.loop);

    // If already looping on this slot and triggered again, retrigger cleanly
    this.stopSamplerSlot(slotKey);

    const outGain = ctx.createGain();
    const combinedGain =
      (Math.max(0, Math.min(100, gainPercent)) / 100) *
      (Math.max(0, Math.min(100, padVol)) / 100) *
      0.85;
    outGain.gain.value = combinedGain;
    outGain.connect(mixerEngine.masterGainNode);

    const durMs = this.triggerSingleSampleBurst(ctx, outGain, padLabel);

    let loopTimer: ReturnType<typeof setInterval> | null = null;
    let oneShotEndTimer: ReturnType<typeof setTimeout> | null = null;

    const voice: ActiveSamplerVoice = {
      slotKey,
      outGain,
      masterGainPercent: gainPercent,
      padVolumePercent: padVol,
      loopTimer: null,
      stopCallback: () => {
        if (oneShotEndTimer !== null) {
          clearTimeout(oneShotEndTimer);
          oneShotEndTimer = null;
        }
        try {
          outGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.01);
          setTimeout(() => {
            try {
              outGain.disconnect();
            } catch {
              // Ignore
            }
          }, 40);
        } catch {
          // Ignore
        }
      },
    };

    if (isLoop) {
      const intervalMs = Math.max(250, durMs + 60);
      loopTimer = setInterval(() => {
        if (!this.activeSamplerVoices.has(slotKey)) return;
        this.triggerSingleSampleBurst(ctx, outGain, padLabel);
      }, intervalMs);
      voice.loopTimer = loopTimer;
      this.activeSamplerVoices.set(slotKey, voice);
    } else {
      this.activeSamplerVoices.set(slotKey, voice);
      oneShotEndTimer = setTimeout(() => {
        if (this.activeSamplerVoices.get(slotKey) === voice) {
          this.activeSamplerVoices.delete(slotKey);
          try {
            outGain.disconnect();
          } catch {
            // Ignore
          }
          options?.onEnded?.();
        }
      }, durMs + 30);
    }
  }
}

export const realAudioEngine = new RealAudioEngineCoordinator();
