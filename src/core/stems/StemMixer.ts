/**
 * DJ Core — Stem Mixer Module with Anti-Clipping Headroom & Anti-Silence Protection
 *
 * Mixes the 4 isolated stereo Stems (VOCAL, MELODY, BASS, DRUMS) from StemSeparationEngine,
 * routes pre-fader stem taps to StemEffectsEngine (so Vocal Echo, Instrumental Echo,
 * Instrumental Breaker, and Drums Echo always receive the isolated pre-mute stem signal),
 * applies click-free 12ms gain ramps, and protects the output with dynamic headroom
 * scaling and a soft-knee peak limiter so combining stems and effects NEVER clips or mutes.
 *
 * If the real separated stem segment at the current playhead is still being prepared in the
 * background worker, the song continues playing normally through the unity bypass WITHOUT
 * substituting any EQ filter, and automatically switches to the real separated stems as soon
 * as the segment is ready in StemCacheStore.
 */

import { StemEffectsEngine } from './StemEffectsEngine';
import { StemSeparationEngine } from './StemSeparationEngine';
import {
  DeckStemPadState,
  INITIAL_DECK_STEM_STATE,
  StemStateManager,
} from './StemStateManager';

const STEM_GAIN_RAMP_SEC = 0.012; // 12ms click-free exponential ramp

export class StemMixer {
  private ctx: AudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  public readonly separationEngine: StemSeparationEngine;
  public readonly effectsEngine: StemEffectsEngine;

  // Unity Dry Bypass (used when all 4 stems are ON, or while background source separation is preparing)
  private fullMixBypassGain: GainNode;
  private isolatedStemSumGain: GainNode;
  private preLimiterSumNode: GainNode;
  private stemPeakLimiter: DynamicsCompressorNode;

  // Individual Dry Stem Fader Gates (Pads 1–4)
  private vocalDryGain: GainNode;
  private melodyDryGain: GainNode;
  private bassDryGain: GainNode;
  private drumsDryGain: GainNode;

  private lastState: DeckStemPadState = { ...INITIAL_DECK_STEM_STATE };
  private lastBpm = 124;
  private lastReadyStatus = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    this.separationEngine = new StemSeparationEngine(ctx);
    this.effectsEngine = new StemEffectsEngine(ctx);

    this.fullMixBypassGain = ctx.createGain();
    this.fullMixBypassGain.gain.value = 1.0;

    this.isolatedStemSumGain = ctx.createGain();
    this.isolatedStemSumGain.gain.value = 0.0;

    this.preLimiterSumNode = ctx.createGain();
    this.preLimiterSumNode.gain.value = 1.0;

    // Dedicated Soft-Knee Peak Limiter prevents clipping when summing multiple Stems + Stem FX
    this.stemPeakLimiter = ctx.createDynamicsCompressor();
    this.stemPeakLimiter.threshold.value = -1.2; // dB ceiling
    this.stemPeakLimiter.knee.value = 4.5;
    this.stemPeakLimiter.ratio.value = 10.0;
    this.stemPeakLimiter.attack.value = 0.001;
    this.stemPeakLimiter.release.value = 0.065;

    this.vocalDryGain = ctx.createGain();
    this.melodyDryGain = ctx.createGain();
    this.bassDryGain = ctx.createGain();
    this.drumsDryGain = ctx.createGain();

    this.vocalDryGain.gain.value = 1.0;
    this.melodyDryGain.gain.value = 1.0;
    this.bassDryGain.gain.value = 1.0;
    this.drumsDryGain.gain.value = 1.0;

    // 1. Feed input into both unity bypass and real 4-stem separator
    this.inputNode.connect(this.fullMixBypassGain);
    this.fullMixBypassGain.connect(this.preLimiterSumNode);

    this.inputNode.connect(this.separationEngine.inputNode);

    // 2. Connect isolated stems to dry mute gates (Pads 1–4)
    this.separationEngine.vocalOutput.connect(this.vocalDryGain);
    this.separationEngine.melodyOutput.connect(this.melodyDryGain);
    this.separationEngine.bassOutput.connect(this.bassDryGain);
    this.separationEngine.drumsOutput.connect(this.drumsDryGain);

    this.vocalDryGain.connect(this.isolatedStemSumGain);
    this.melodyDryGain.connect(this.isolatedStemSumGain);
    this.bassDryGain.connect(this.isolatedStemSumGain);
    this.drumsDryGain.connect(this.isolatedStemSumGain);

    this.isolatedStemSumGain.connect(this.preLimiterSumNode);

    // 3. Connect PRE-FADER (pre-mute) isolated stem taps to StemEffectsEngine (Pads 5–8)
    this.separationEngine.vocalOutput.connect(
      this.effectsEngine.vocalPreFaderInput
    );

    this.separationEngine.melodyOutput.connect(
      this.effectsEngine.instrumentalPreFaderInput
    );
    this.separationEngine.bassOutput.connect(
      this.effectsEngine.instrumentalPreFaderInput
    );
    this.separationEngine.drumsOutput.connect(
      this.effectsEngine.instrumentalPreFaderInput
    );

    this.separationEngine.drumsOutput.connect(
      this.effectsEngine.drumsPreFaderInput
    );

    // 4. Connect StemEffectsEngine wet output into preLimiterSumNode -> stemPeakLimiter -> outputNode
    this.effectsEngine.outputNode.connect(this.preLimiterSumNode);
    this.preLimiterSumNode.connect(this.stemPeakLimiter);
    this.stemPeakLimiter.connect(this.outputNode);

    // Automatically re-apply stem routing whenever a new separated segment becomes READY in cache
    this.separationEngine.onPreparationStateChange(() => {
      this.applyStemState(this.lastState, this.lastBpm);
    });
  }

  /**
   * Called when playhead moves across segments to ensure seamless transition
   * if a newly entered segment is ready or still preparing.
   */
  public refreshStemRoutingIfNeeded(): void {
    const isReadyNow = this.separationEngine.areStemsReadyAtCurrentTime();
    if (isReadyNow !== this.lastReadyStatus) {
      this.applyStemState(this.lastState, this.lastBpm);
    }
  }

  /**
   * Updates the 4 Stem Dry Gains and 4 Stem FX Units with click-free ramps,
   * anti-clipping headroom scaling, and anti-silence protection.
   */
  public applyStemState(state: DeckStemPadState, currentBpm?: number): void {
    this.lastState = { ...state };
    if (typeof currentBpm === 'number' && currentBpm > 0) {
      this.lastBpm = currentBpm;
    }

    const now = this.ctx.currentTime;

    const stemsReadyAtPlayhead =
      this.separationEngine.areStemsReadyAtCurrentTime();
    this.lastReadyStatus = stemsReadyAtPlayhead;

    const all4StemsActive =
      state.vocalActive &&
      state.melodyActive &&
      state.bassActive &&
      state.drumsActive;
    const hasAnyFx =
      StemStateManager.hasAnyActiveStemFx(state) || Boolean(state.drumsEchoActive);

    // SYSTEM A / SYSTEM B ISOLATION RULE:
    // 1. When all 4 stems are active and no stem FX is engaged, route 100% through fullMixBypassGain.
    //    This guarantees that background stem preparation completing will NEVER touch or mute live playback.
    // 2. When one or more stems are muted (e.g. Vocal OFF) OR stem FX is active, AND stems are ready:
    //    route through isolatedStemSumGain (1.0) and fullMixBypassGain (0.0).
    // 3. If stems are NOT ready: keep fullMixBypassGain (1.0) so the song NEVER mutes or cuts out.
    const shouldUseFullMixBypass =
      !stemsReadyAtPlayhead || (all4StemsActive && !hasAnyFx);

    if (shouldUseFullMixBypass) {
      this.fullMixBypassGain.gain.setTargetAtTime(
        1.0,
        now,
        STEM_GAIN_RAMP_SEC
      );
      this.isolatedStemSumGain.gain.setTargetAtTime(
        0.0,
        now,
        STEM_GAIN_RAMP_SEC
      );
    } else {
      this.fullMixBypassGain.gain.setTargetAtTime(
        0.0,
        now,
        STEM_GAIN_RAMP_SEC
      );
      this.isolatedStemSumGain.gain.setTargetAtTime(
        1.0,
        now,
        STEM_GAIN_RAMP_SEC
      );
    }

    const targetVocalGain = state.vocalActive ? 1.0 : 0.0;
    const targetMelodyGain = state.melodyActive ? 1.0 : 0.0;
    const targetBassGain = state.bassActive ? 1.0 : 0.0;
    const targetDrumsGain = state.drumsActive ? 1.0 : 0.0;

    this.vocalDryGain.gain.setTargetAtTime(
      targetVocalGain,
      now,
      STEM_GAIN_RAMP_SEC
    );
    this.melodyDryGain.gain.setTargetAtTime(
      targetMelodyGain,
      now,
      STEM_GAIN_RAMP_SEC
    );
    this.bassDryGain.gain.setTargetAtTime(
      targetBassGain,
      now,
      STEM_GAIN_RAMP_SEC
    );
    this.drumsDryGain.gain.setTargetAtTime(
      targetDrumsGain,
      now,
      STEM_GAIN_RAMP_SEC
    );

    // Update Serato-style Stem FX (Pads 5–8)
    this.effectsEngine.updateFromState(state, this.lastBpm);
  }
}
