/**
 * DJ Core — Real Deck Audio, Scratch & Transport Engine (Click-Free DSP Chain)
 *
 * Signal Flow:
 * [HTMLAudioElement → ElementMuteGainNode (Normal Playback) + Real-Time Varispeed Vinyl Scratch Node]
 *   → Input Pre-Mix GAIN Node
 *   → 3-Band Isolator EQ (LOW 200Hz, MID 1000Hz, HIGH 4200Hz)
 *   → Independent Dual-Stage Bipolar FILTER (Dedicated Low-Pass + Dedicated High-Pass in series = zero mode-switch clicks)
 *   → DeckEffectsChain (Reverb / Echo / Filter LFO / Flanger / Phaser / Trans Gate)
 *   → Channel VOLUME Fader Node
 *   → AnalyserNode (Real-time RMS/Peak VU Meter)
 *   → Mixer Crossfader Input
 */

import { DeckEffectsChain } from '../effects/EffectsEngine';
import { FxSlotState } from '../dj/DjEngine';
import {
  DeckStemPadState,
  DeckStemProcessor,
} from '../stems/StemAudioEngine';
import { stemCacheStore } from '../stems/StemCacheStore';
import { STEM_EXECUTION_ENABLED } from '../stems/StemPreparationQueue';
import { trackDatabase } from '../database/TrackDatabase';

export class SingleDeckAudioEngine {
  public readonly deckId: 'A' | 'B';
  private ctx: AudioContext;
  private audioEl: HTMLAudioElement;
  private currentObjectUrl: string | null = null;
  private currentTrackId = '';
  private sourceNode: MediaElementAudioSourceNode;
  private elementMuteGainNode: GainNode;

  // Authoritative synchronous transport state so PLAY/PAUSE and CUE respond
  // identically in Scratch/Vinyl mode, Pitch Bend mode, and normal playback
  private transportPlaying = false;

  // Decoded PCM AudioBuffer for real-time forward/reverse vinyl scratch
  private decodedBuffer: AudioBuffer | null = null;
  private scratchNode: ScriptProcessorNode | null = null;
  private isScratchActive = false;
  private wasPlayingBeforeScratch = false;
  private scratchPlayheadSec = 0;
  private currentScratchRate = 0;
  private targetScratchRate = 0;
  private lastScratchInputTimeMs = 0;
  private scratchReleaseTimer: ReturnType<typeof setTimeout> | null = null;

  // Pitch Bend state for Normal (non-Vinyl) Jog Wheel mode
  private basePitchPercent = 0;
  private pitchBendOffsetRate = 0;
  private pitchBendDecayTimer: ReturnType<typeof setTimeout> | null = null;
  private keyLockEnabled = true;

  // Persistent DSP Chain Nodes (Never recreated during parameter changes)
  private inputGainNode: GainNode;
  public readonly stemProcessor: DeckStemProcessor;
  private eqLowNode: BiquadFilterNode;
  private eqMidNode: BiquadFilterNode;
  private eqHighNode: BiquadFilterNode;
  private filterLowPassNode: BiquadFilterNode;
  private filterHighPassNode: BiquadFilterNode;
  public readonly fxChain: DeckEffectsChain;
  private channelVolumeNode: GainNode;
  private analyserNode: AnalyserNode;
  private timeDomainBuf: Float32Array<ArrayBuffer>;

  // DJ Cue State
  private cuePointSec = 0.0;
  private isHoldingCuePreview = false;

  // High-precision audio clock anchors derived directly from AudioContext hardware clock
  private clockAnchorCtxTime = 0;
  private clockAnchorAudioSec = 0;
  private clockAnchorRate = 1.0;

  constructor(
    deckId: 'A' | 'B',
    ctx: AudioContext,
    destinationCrossfaderNode: GainNode
  ) {
    this.deckId = deckId;
    this.ctx = ctx;

    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.audioEl.crossOrigin = 'anonymous';
    this.setKeyLock(true);

    this.audioEl.addEventListener('ended', () => {
      this.transportPlaying = false;
      this.wasPlayingBeforeScratch = false;
      this.clockAnchorAudioSec = this.audioEl.currentTime || 0;
      this.clockAnchorCtxTime = this.ctx.currentTime;
    });

    this.audioEl.addEventListener('playing', () => {
      this.clockAnchorCtxTime = this.ctx.currentTime;
      this.clockAnchorAudioSec = this.audioEl.currentTime || 0;
      this.clockAnchorRate = this.audioEl.playbackRate || 1.0;
    });

    this.audioEl.addEventListener('timeupdate', () => {
      if (this.transportPlaying && !this.isScratchActive && !this.audioEl.paused) {
        const rawEl = this.audioEl.currentTime || 0;
        const current =
          this.clockAnchorAudioSec +
          (this.ctx.currentTime - this.clockAnchorCtxTime) * this.clockAnchorRate;
        const drift = rawEl - current;
        if (Math.abs(drift) > 0.12) {
          this.clockAnchorAudioSec = rawEl;
          this.clockAnchorCtxTime = this.ctx.currentTime;
        } else if (Math.abs(drift) > 0.02) {
          this.clockAnchorAudioSec += drift * 0.20;
        }
      }
    });

    this.audioEl.addEventListener('seeked', () => {
      this.clockAnchorAudioSec = this.audioEl.currentTime || 0;
      this.clockAnchorCtxTime = this.ctx.currentTime;
    });

    this.sourceNode = ctx.createMediaElementSource(this.audioEl);

    // Dedicated mute gate for HTMLAudioElement during active vinyl scratch
    // so we never abort pending audioEl.play() promises or block transport controls
    this.elementMuteGainNode = ctx.createGain();
    this.elementMuteGainNode.gain.value = 1.0;

    // 1. Pre-Mix Input Gain (0 - 100, where 80 = 1.0 unity)
    this.inputGainNode = ctx.createGain();
    this.inputGainNode.gain.value = 1.0;

    // 1B. Real-Time 4-Stem Separator (VOCAL, MELODY, BASS, DRUMS + Stem FX 5-8)
    this.stemProcessor = new DeckStemProcessor(deckId, ctx);

    // 2. 3-Band Isolator EQ (LOW / MID / HIGH)
    this.eqLowNode = ctx.createBiquadFilter();
    this.eqLowNode.type = 'lowshelf';
    this.eqLowNode.frequency.value = 200;
    this.eqLowNode.gain.value = 0;

    this.eqMidNode = ctx.createBiquadFilter();
    this.eqMidNode.type = 'peaking';
    this.eqMidNode.frequency.value = 1000;
    this.eqMidNode.Q.value = 0.95;
    this.eqMidNode.gain.value = 0;

    this.eqHighNode = ctx.createBiquadFilter();
    this.eqHighNode.type = 'highshelf';
    this.eqHighNode.frequency.value = 4200;
    this.eqHighNode.gain.value = 0;

    // 3. Independent Click-Free Bipolar Filter (Dedicated LPF + HPF in series)
    this.filterLowPassNode = ctx.createBiquadFilter();
    this.filterLowPassNode.type = 'lowpass';
    this.filterLowPassNode.frequency.value = 20000;
    this.filterLowPassNode.Q.value = 0.707;

    this.filterHighPassNode = ctx.createBiquadFilter();
    this.filterHighPassNode.type = 'highpass';
    this.filterHighPassNode.frequency.value = 20;
    this.filterHighPassNode.Q.value = 0.707;

    // 4. Per-Deck Real-Time FX Unit
    this.fxChain = new DeckEffectsChain(ctx);

    // 5. Channel Volume Fader
    this.channelVolumeNode = ctx.createGain();
    this.channelVolumeNode.gain.value = 0.85;

    // 6. Real-Time Level Analyser
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.timeDomainBuf = new Float32Array(this.analyserNode.fftSize);

    // 7. Real-Time Varispeed Vinyl Scratch Node (512 samples for ultra-low latency)
    try {
      this.scratchNode = ctx.createScriptProcessor(512, 0, 2);
      this.scratchNode.onaudioprocess = (e) => {
        const outL = e.outputBuffer.getChannelData(0);
        const outR =
          e.outputBuffer.numberOfChannels > 1
            ? e.outputBuffer.getChannelData(1)
            : outL;

        if (!this.isScratchActive || !this.decodedBuffer) {
          outL.fill(0);
          if (outR !== outL) outR.fill(0);
          return;
        }

        const buf = this.decodedBuffer;
        const sr = buf.sampleRate;
        const totalFrames = buf.length;
        const ch0 = buf.getChannelData(0);
        const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;

        // If no jog movement occurred in the last 45ms, damp target velocity toward 0
        const nowMs = performance.now();
        if (nowMs - this.lastScratchInputTimeMs > 45) {
          this.targetScratchRate *= 0.72;
          if (Math.abs(this.targetScratchRate) < 0.015) {
            this.targetScratchRate = 0;
          }
        }

        const dtPerSample = 1 / this.ctx.sampleRate;
        for (let i = 0; i < outL.length; i++) {
          // Smoothly slewing currentScratchRate toward targetScratchRate avoids zipper noise
          this.currentScratchRate +=
            (this.targetScratchRate - this.currentScratchRate) * 0.085;

          const rate = this.currentScratchRate;
          if (Math.abs(rate) < 0.003) {
            outL[i] = 0;
            outR[i] = 0;
            continue;
          }

          this.scratchPlayheadSec += rate * dtPerSample;
          if (this.scratchPlayheadSec < 0) {
            this.scratchPlayheadSec = 0;
            this.currentScratchRate = 0;
          } else if (this.scratchPlayheadSec * sr >= totalFrames - 2) {
            this.scratchPlayheadSec = Math.max(0, (totalFrames - 2) / sr);
            this.currentScratchRate = 0;
          }

          const exactFrame = this.scratchPlayheadSec * sr;
          const idx0 = Math.floor(exactFrame);
          const frac = exactFrame - idx0;
          const idx1 = Math.min(totalFrames - 1, idx0 + 1);

          // Linear interpolation + subtle vinyl motor gain envelope
          const env = Math.min(1.15, Math.abs(rate) * 0.95 + 0.15);
          outL[i] = (ch0[idx0] * (1 - frac) + ch0[idx1] * frac) * env;
          outR[i] = (ch1[idx0] * (1 - frac) + ch1[idx1] * frac) * env;
        }
      };
      // Only connect scratchNode dynamically during active vinyl scratch to avoid main-thread callbacks during normal playback
    } catch {
      this.scratchNode = null;
    }

    // Connect Audio Graph Once (Direct, Click-Free Professional Signal Chain)
    this.sourceNode.connect(this.elementMuteGainNode);
    this.elementMuteGainNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.eqLowNode);
    this.eqLowNode.connect(this.eqMidNode);
    this.eqMidNode.connect(this.eqHighNode);
    this.eqHighNode.connect(this.filterLowPassNode);
    this.filterLowPassNode.connect(this.filterHighPassNode);
    this.filterHighPassNode.connect(this.fxChain.inputNode);
    this.fxChain.outputNode.connect(this.channelVolumeNode);
    this.channelVolumeNode.connect(this.analyserNode);
    this.analyserNode.connect(destinationCrossfaderNode);
  }

  async loadAudioBlob(blob: Blob, trackId = ''): Promise<number> {
    this.endScratch(false);
    this.transportPlaying = false;
    this.wasPlayingBeforeScratch = false;
    this.isHoldingCuePreview = false;
    this.audioEl.pause();
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
    }
    this.currentObjectUrl = URL.createObjectURL(blob);
    this.currentTrackId = trackId;
    this.audioEl.src = this.currentObjectUrl;
    this.audioEl.currentTime = 0;
    this.cuePointSec = 0;
    this.scratchPlayheadSec = 0;
    this.elementMuteGainNode.gain.value = 1.0;

    // Strictly load pre-prepared stems if this song was already prepared by the user.
    // Never execute real-time or automatic stem separation during playback or track load.
    if (STEM_EXECUTION_ENABLED) {
      void this.tryActivatePreparedStems(trackId);
    }

    // Decode PCM buffer only when CPU is idle (never blocks initial playback or track load)
    this.decodedBuffer = null;
    const schedulePcmDecode = () => {
      if (this.currentTrackId !== trackId) return;
      blob
        .arrayBuffer()
        .then((ab) => {
          const OfflineCtx =
            window.OfflineAudioContext ||
            (
              window as unknown as {
                webkitOfflineAudioContext: typeof OfflineAudioContext;
              }
            ).webkitOfflineAudioContext;
          const decoderCtx = OfflineCtx
            ? new OfflineCtx(2, 1, this.ctx.sampleRate || 44100)
            : this.ctx;
          return decoderCtx.decodeAudioData(ab.slice(0));
        })
        .then((decoded) => {
          if (this.currentTrackId === trackId) {
            this.decodedBuffer = decoded;
            this.syncStemTransport();
          }
        })
        .catch(() => {
          // Keep null if format cannot be decoded into memory buffer
        });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(schedulePcmDecode, { timeout: 5000 });
    } else {
      setTimeout(schedulePcmDecode, 3500);
    }

    return new Promise((resolve) => {
      const onLoaded = () => {
        this.audioEl.removeEventListener('loadedmetadata', onLoaded);
        const dur =
          Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0
            ? this.audioEl.duration
            : 0;
        resolve(dur);
      };
      this.audioEl.addEventListener('loadedmetadata', onLoaded);
      this.audioEl.load();
    });
  }

  /**
   * Checks if `trackId` has prepared stems in StemCacheStore or IndexedDB.
   * If prepared stems exist, activates them in the 4-stem playback AudioWorklet.
   * Otherwise, clears stems so the deck plays as a clean, uninterrupted full mix.
   */
  public async tryActivatePreparedStems(trackId: string): Promise<boolean> {
    if (!STEM_EXECUTION_ENABLED) {
      this.stemProcessor.stemMixer.separationEngine.clearTrackStems('');
      this.stemProcessor.stemMixer.refreshStemRoutingIfNeeded();
      return false;
    }
    if (!trackId) {
      this.stemProcessor.stemMixer.separationEngine.clearTrackStems('');
      this.stemProcessor.stemMixer.refreshStemRoutingIfNeeded();
      return false;
    }

    const inMemory = stemCacheStore.getTrackStems(trackId);
    if (inMemory && inMemory.completedSegments >= inMemory.totalSegments) {
      if (this.currentTrackId === trackId) {
        this.syncStemTransport();
        this.stemProcessor.stemMixer.separationEngine.loadPreparedCacheForTrack(
          trackId
        );
        this.syncStemTransport();
        this.stemProcessor.stemMixer.refreshStemRoutingIfNeeded();
      }
      return true;
    }

    try {
      const persisted = await trackDatabase.getPreparedStems(trackId);
      if (persisted) {
        stemCacheStore.hydrateFromPreparedRecord(trackId, persisted);
        if (this.currentTrackId === trackId) {
          this.syncStemTransport();
          this.stemProcessor.stemMixer.separationEngine.loadPreparedCacheForTrack(
            trackId
          );
          this.syncStemTransport();
          this.stemProcessor.stemMixer.refreshStemRoutingIfNeeded();
        }
        return true;
      }
    } catch {
      // Ignore IndexedDB read errors
    }

    if (this.currentTrackId === trackId) {
      this.stemProcessor.stemMixer.separationEngine.clearTrackStems(trackId);
      this.stemProcessor.stemMixer.refreshStemRoutingIfNeeded();
    }
    return false;
  }

  public areStemsPrepared(): boolean {
    if (!STEM_EXECUTION_ENABLED) return false;
    return this.stemProcessor.stemMixer.separationEngine.areStemsReadyAtCurrentTime();
  }

  private stemSyncInterval: ReturnType<typeof setInterval> | null = null;

  private startStemSyncLoop(): void {
    if (!STEM_EXECUTION_ENABLED) return;
    if (this.stemSyncInterval) return;
    this.stemSyncInterval = setInterval(() => {
      if (this.transportPlaying || this.isScratchActive) {
        this.syncStemTransport();
      }
    }, 250);
  }

  private stopStemSyncLoop(): void {
    if (this.stemSyncInterval) {
      clearInterval(this.stemSyncInterval);
      this.stemSyncInterval = null;
    }
  }

  private syncStemTransport(): void {
    if (!STEM_EXECUTION_ENABLED) return;
    if (!this.stemProcessor) return;
    const pos = this.isScratchActive
      ? this.scratchPlayheadSec
      : this.audioEl.currentTime || 0;
    const rate = this.isScratchActive
      ? this.currentScratchRate
      : this.audioEl.playbackRate || 1.0;
    const active = this.isPlaying() || this.isScratchActive;
    const keyLock = this.isScratchActive ? false : this.keyLockEnabled;

    this.stemProcessor.stemMixer.separationEngine.syncTransport(
      pos,
      rate,
      active,
      keyLock
    );
    this.stemProcessor.stemMixer.refreshStemRoutingIfNeeded();
  }

  async play(): Promise<void> {
    // Update authoritative transport state synchronously BEFORE any async resume/play
    this.transportPlaying = true;
    this.wasPlayingBeforeScratch = true;
    this.endScratch(false);
    this.clockAnchorAudioSec = this.audioEl.currentTime || 0;
    this.clockAnchorCtxTime = this.ctx.currentTime;
    this.clockAnchorRate = this.audioEl.playbackRate || 1.0;
    this.elementMuteGainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.004);
    this.syncStemTransport();
    this.startStemSyncLoop();

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Ignore resume error
      }
    }
    if (this.transportPlaying && !this.isScratchActive) {
      try {
        await this.audioEl.play();
        this.clockAnchorAudioSec = this.audioEl.currentTime || 0;
        this.clockAnchorCtxTime = this.ctx.currentTime;
        this.clockAnchorRate = this.audioEl.playbackRate || 1.0;
      } catch {
        // Ignore play interruption
      }
    }
    this.syncStemTransport();
  }

  pause(): void {
    this.transportPlaying = false;
    this.wasPlayingBeforeScratch = false;
    this.stopStemSyncLoop();
    this.endScratch(false);
    this.clockAnchorAudioSec = this.audioEl.currentTime || 0;
    this.clockAnchorCtxTime = this.ctx.currentTime;
    this.elementMuteGainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.004);
    this.audioEl.pause();
    this.syncStemTransport();
  }

  stop(): void {
    this.transportPlaying = false;
    this.wasPlayingBeforeScratch = false;
    this.stopStemSyncLoop();
    this.endScratch(false);
    this.elementMuteGainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.004);
    this.audioEl.pause();
    this.audioEl.currentTime = 0;
    this.scratchPlayheadSec = 0;
    this.clockAnchorAudioSec = 0;
    this.clockAnchorCtxTime = this.ctx.currentTime;
    this.syncStemTransport();
  }

  isPlaying(): boolean {
    if (this.audioEl.ended) {
      this.transportPlaying = false;
      this.stopStemSyncLoop();
      return false;
    }
    return this.transportPlaying;
  }

  getIsScratchActive(): boolean {
    return this.isScratchActive;
  }

  getCurrentTime(): number {
    if (this.isScratchActive) {
      return this.scratchPlayheadSec;
    }
    if (!this.transportPlaying || this.audioEl.paused || this.audioEl.ended) {
      return this.audioEl.currentTime || 0;
    }
    // High-precision audio clock directly derived from AudioContext hardware DAC clock
    const dt = this.ctx.currentTime - this.clockAnchorCtxTime;
    const interpolated = this.clockAnchorAudioSec + dt * this.clockAnchorRate;
    const dur = this.getDuration();
    if (dur > 0 && interpolated >= dur) {
      return dur;
    }
    return Math.max(0, interpolated);
  }

  getDuration(): number {
    if (Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
      return this.audioEl.duration;
    }
    return this.decodedBuffer ? this.decodedBuffer.duration : 0;
  }

  seek(seconds: number): void {
    const dur = this.getDuration();
    const target =
      dur > 0 ? Math.min(dur, Math.max(0, seconds)) : Math.max(0, seconds);
    this.scratchPlayheadSec = target;
    this.clockAnchorAudioSec = target;
    this.clockAnchorCtxTime = this.ctx.currentTime;
    if (Math.abs(this.audioEl.currentTime - target) > 0.003) {
      this.audioEl.currentTime = target;
    }
    this.syncStemTransport();
  }

  getCuePoint(): number {
    return this.cuePointSec;
  }

  /**
   * 1. NORMAL MODE JOG WHEEL (Vinyl/Scratch OFF):
   * Performs smooth, subtle VirtualDJ-style Pitch Bending (when playing)
   * or micro-millisecond cue adjustment (when paused), moving only a few
   * milliseconds per jog step instead of jumping large amounts.
   */
  public nudgePitchBend(deltaDeg: number): number {
    if (Math.abs(deltaDeg) < 0.001) {
      return this.getCurrentTime();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const playing = this.transportPlaying && !this.audioEl.ended;
    const dur = this.getDuration();

    if (playing) {
      // Temporary smooth pitch bend rate offset (+ / - up to 12% depending on spin speed)
      const bendDelta = Math.max(-0.14, Math.min(0.14, deltaDeg * 0.0085));
      this.pitchBendOffsetRate = Math.max(
        -0.16,
        Math.min(0.16, this.pitchBendOffsetRate * 0.45 + bendDelta)
      );
      this.applyEffectivePlaybackRate();

      // Subtle millisecond phase nudge (~1.4 ms per degree) so beats align with precision
      const microShiftSec = deltaDeg * 0.0014;
      const nextPos = Math.max(
        0,
        dur > 0
          ? Math.min(dur, this.audioEl.currentTime + microShiftSec)
          : this.audioEl.currentTime + microShiftSec
      );

      if (this.pitchBendDecayTimer) {
        clearTimeout(this.pitchBendDecayTimer);
      }
      this.pitchBendDecayTimer = setTimeout(() => {
        this.pitchBendOffsetRate = 0;
        this.applyEffectivePlaybackRate();
        this.pitchBendDecayTimer = null;
      }, 90);

      return nextPos;
    }

    // When paused in Normal mode: ultra-fine millisecond cue search (~2.2 ms per degree)
    const fineStepSec = deltaDeg * 0.0022;
    const nextSec = Math.max(
      0,
      dur > 0
        ? Math.min(dur, this.getCurrentTime() + fineStepSec)
        : this.getCurrentTime() + fineStepSec
    );
    this.seek(nextSec);
    return nextSec;
  }

  /**
   * 2. REAL AUDIBLE VINYL SCRATCH (Vinyl/Scratch ON):
   * Drives the real-time varispeed PCM interpolator both forward and backward
   * with audible pitch-shifted vinyl scratch sound and low latency.
   * Never blocks or interferes with PLAY/PAUSE or CUE buttons.
   */
  public performVinylScratch(deltaDeg: number): number {
    if (Math.abs(deltaDeg) < 0.001) {
      return this.getCurrentTime();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const nowMs = performance.now();
    const dtMs = Math.max(
      8,
      Math.min(60, nowMs - (this.lastScratchInputTimeMs || nowMs - 16))
    );
    this.lastScratchInputTimeMs = nowMs;

    // 360 degrees of platter rotation ≈ 1.8 seconds of vinyl audio (standard 33.3 RPM record feel)
    const deltaSec = deltaDeg * (1.8 / 360);
    const instantaneousRate = Math.max(
      -3.2,
      Math.min(3.2, deltaSec / (dtMs / 1000))
    );

    if (!this.isScratchActive) {
      this.isScratchActive = true;
      this.wasPlayingBeforeScratch = this.transportPlaying;
      this.scratchPlayheadSec = this.audioEl.currentTime || 0;
      this.currentScratchRate = instantaneousRate * 0.6;
      if (this.scratchNode) {
        try {
          this.scratchNode.connect(this.inputGainNode);
        } catch {
          // Ignore if already connected
        }
      }
      // Mute HTMLAudioElement output smoothly without aborting its play state
      this.elementMuteGainNode.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.003);
    }

    this.targetScratchRate = instantaneousRate;

    // If decodedBuffer isn't ready yet, advance scratchPlayheadSec directly
    const dur = this.getDuration();
    if (!this.decodedBuffer) {
      const fallbackPos = Math.max(
        0,
        dur > 0
          ? Math.min(dur, this.scratchPlayheadSec + deltaSec)
          : this.scratchPlayheadSec + deltaSec
      );
      this.scratchPlayheadSec = fallbackPos;
      this.audioEl.currentTime = fallbackPos;
    }

    if (this.scratchReleaseTimer) {
      clearTimeout(this.scratchReleaseTimer);
    }
    this.scratchReleaseTimer = setTimeout(() => {
      this.endScratch(true);
    }, 115);

    return this.scratchPlayheadSec;
  }

  public endScratch(resumeIfWasPlaying = true): void {
    if (this.scratchReleaseTimer) {
      clearTimeout(this.scratchReleaseTimer);
      this.scratchReleaseTimer = null;
    }
    if (!this.isScratchActive) return;

    const finalSec = this.scratchPlayheadSec;
    const shouldResume =
      resumeIfWasPlaying &&
      (this.transportPlaying || this.wasPlayingBeforeScratch);

    this.isScratchActive = false;
    this.targetScratchRate = 0;
    this.currentScratchRate = 0;
    if (this.scratchNode) {
      try {
        this.scratchNode.disconnect();
      } catch {
        // Ignore if already disconnected
      }
    }

    const dur = this.getDuration();
    const clamped =
      dur > 0 ? Math.min(dur, Math.max(0, finalSec)) : Math.max(0, finalSec);
    this.audioEl.currentTime = clamped;
    this.elementMuteGainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.004);

    if (shouldResume) {
      this.transportPlaying = true;
      if (this.audioEl.paused) {
        this.audioEl.play().catch(() => {});
      }
    } else if (!this.transportPlaying && !this.audioEl.paused) {
      this.audioEl.pause();
    }
  }

  /**
   * Standard Professional DJ CUE Behavior (Works identically in Scratch/Vinyl & Normal modes):
   * - If currently playing: immediately pauses and jumps back to the stored Cue Point.
   * - If paused at a position > 0.08s away from the Cue Point: sets the new Cue Point at current position.
   * - If paused right at the Cue Point and held down: starts temporary Cue Preview playback.
   */
  handleCueDown(): {
    isPlaying: boolean;
    positionSec: number;
    cuePointSec: number;
  } {
    // Capture playing state and current position BEFORE ending any active scratch
    const wasPlaying = this.transportPlaying;
    const currentPos = this.getCurrentTime();
    this.endScratch(false);

    if (wasPlaying && !this.isHoldingCuePreview) {
      this.pause();
      this.seek(this.cuePointSec);
      return {
        isPlaying: false,
        positionSec: this.cuePointSec,
        cuePointSec: this.cuePointSec,
      };
    }

    if (Math.abs(currentPos - this.cuePointSec) > 0.08) {
      this.cuePointSec = Number(currentPos.toFixed(2));
      this.seek(this.cuePointSec);
      return {
        isPlaying: false,
        positionSec: this.cuePointSec,
        cuePointSec: this.cuePointSec,
      };
    }

    this.isHoldingCuePreview = true;
    this.play();
    return {
      isPlaying: true,
      positionSec: this.cuePointSec,
      cuePointSec: this.cuePointSec,
    };
  }

  handleCueUp(): { isPlaying: boolean; positionSec: number } | null {
    if (!this.isHoldingCuePreview) return null;
    this.isHoldingCuePreview = false;
    this.pause();
    this.seek(this.cuePointSec);
    return {
      isPlaying: false,
      positionSec: this.cuePointSec,
    };
  }

  private applyEffectivePlaybackRate(): void {
    const baseRate = 1 + this.basePitchPercent / 100;
    const rate = Math.min(
      2.0,
      Math.max(0.5, baseRate + this.pitchBendOffsetRate)
    );
    if (Math.abs(this.audioEl.playbackRate - rate) > 0.0004) {
      if (this.transportPlaying && !this.isScratchActive) {
        const cur = this.getCurrentTime();
        this.clockAnchorAudioSec = cur;
        this.clockAnchorCtxTime = this.ctx.currentTime;
        this.clockAnchorRate = rate;
      }
      this.audioEl.playbackRate = rate;
    }
    this.syncStemTransport();
  }

  /**
   * Modifies real playback speed while preserving musical pitch when KeyLock is active.
   */
  setPitchPercent(pitchPercent: number): void {
    this.basePitchPercent = pitchPercent;
    this.applyEffectivePlaybackRate();
  }

  setKeyLock(enabled: boolean): void {
    this.keyLockEnabled = enabled;
    const el = this.audioEl as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    el.preservesPitch = enabled;
    el.mozPreservesPitch = enabled;
    el.webkitPreservesPitch = enabled;
    this.syncStemTransport();
  }

  /**
   * Pre-mix input GAIN (0 - 100, where 80 is 0dB unity gain, 100 is +4.5dB boost)
   */
  setInputGain(gainValue: number): void {
    const norm = Math.min(100, Math.max(0, gainValue));
    const linear = norm <= 80 ? norm / 80 : 1.0 + ((norm - 80) / 20) * 0.68;
    this.inputGainNode.gain.setTargetAtTime(
      linear,
      this.ctx.currentTime,
      0.008
    );
  }

  /**
   * Channel VOLUME fader (0 - 100) with smooth logarithmic DJ taper
   */
  setChannelVolume(volumePercent: number): void {
    const norm = Math.min(100, Math.max(0, volumePercent)) / 100;
    const gain = Math.pow(norm, 1.5);
    this.channelVolumeNode.gain.setTargetAtTime(
      gain,
      this.ctx.currentTime,
      0.008
    );
  }

  /**
   * Real 3-Band Isolator EQ (-12 dB to +12 dB, with deep isolator kill at -12 dB → -34 dB)
   */
  setEq(lowDb: number, midDb: number, highDb: number): void {
    const now = this.ctx.currentTime;
    const mapDb = (db: number) => {
      if (db <= -11.5) return -34;
      if (db < 0) return db * 1.8; // Smooth transition to deep cut
      return db;
    };
    this.eqLowNode.gain.setTargetAtTime(mapDb(lowDb), now, 0.008);
    this.eqMidNode.gain.setTargetAtTime(mapDb(midDb), now, 0.008);
    this.eqHighNode.gain.setTargetAtTime(mapDb(highDb), now, 0.008);
  }

  /**
   * Click-Free Independent Bipolar Filter:
   * -100 to -2: Low-Pass Filter sweep (20kHz down to 85Hz, HPF stays parked at 20Hz)
   * -2 to +2: Neutral Bypass (LPF @ 20kHz, HPF @ 20Hz, Q = 0.707)
   * +2 to +100: High-Pass Filter sweep (20Hz up to 7200Hz, LPF stays parked at 20Hz)
   */
  setBipolarFilter(filterVal: number): void {
    const now = this.ctx.currentTime;
    if (Math.abs(filterVal) <= 2) {
      this.filterLowPassNode.frequency.setTargetAtTime(20000, now, 0.01);
      this.filterLowPassNode.Q.setTargetAtTime(0.707, now, 0.01);
      this.filterHighPassNode.frequency.setTargetAtTime(20, now, 0.01);
      this.filterHighPassNode.Q.setTargetAtTime(0.707, now, 0.01);
    } else if (filterVal < 0) {
      const t = Math.abs(filterVal) / 100; // 0 to 1
      const cutoff = 20000 * Math.pow(85 / 20000, t);
      const q = 0.707 + Math.sin(t * Math.PI) * 1.35;
      this.filterLowPassNode.frequency.setTargetAtTime(cutoff, now, 0.008);
      this.filterLowPassNode.Q.setTargetAtTime(q, now, 0.01);
      this.filterHighPassNode.frequency.setTargetAtTime(20, now, 0.01);
      this.filterHighPassNode.Q.setTargetAtTime(0.707, now, 0.01);
    } else {
      const t = filterVal / 100; // 0 to 1
      const cutoff = 20 * Math.pow(7200 / 20, t);
      const q = 0.707 + Math.sin(t * Math.PI) * 1.35;
      this.filterHighPassNode.frequency.setTargetAtTime(cutoff, now, 0.008);
      this.filterHighPassNode.Q.setTargetAtTime(q, now, 0.01);
      this.filterLowPassNode.frequency.setTargetAtTime(20000, now, 0.01);
      this.filterLowPassNode.Q.setTargetAtTime(0.707, now, 0.01);
    }
  }

  setFx(
    type: FxSlotState['name'],
    engaged: boolean,
    wetDryPercent: number,
    xCoord = 0.5,
    currentBpm = 124
  ): void {
    this.fxChain.updateParameters(
      type,
      engaged,
      wetDryPercent,
      xCoord,
      currentBpm
    );
  }

  /**
   * Updates the deck's real-time Stem separation & Stem FX states (Pads 1-8)
   * with click-free 12ms gain ramping.
   */
  setStemState(state: DeckStemPadState, currentBpm?: number): void {
    this.syncStemTransport();
    this.stemProcessor.setStemState(state, currentBpm);
  }

  /**
   * Computes real-time audio output level (0 - 100) from the PCM stream.
   * Accurately reflects audio during playback, active scratch, or when FX tails
   * (Echo, Reverb, Ping Pong) are circulating while paused.
   */
  getMeterLevel(): number {
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuf);
    let sumSq = 0;
    let maxAbs = 0;
    const len = this.timeDomainBuf.length;
    // Sample every 4th element for 4x faster execution while preserving VU peak accuracy
    for (let i = 0; i < len; i += 4) {
      const s = Math.abs(this.timeDomainBuf[i]);
      sumSq += s * s;
      if (s > maxAbs) maxAbs = s;
    }
    if (maxAbs < 0.0008) return 0;
    const rms = Math.sqrt((sumSq * 4) / len);
    const env = rms * 0.65 + maxAbs * 0.35;
    return Math.min(100, Math.round(Math.pow(env, 0.65) * 118));
  }
}
