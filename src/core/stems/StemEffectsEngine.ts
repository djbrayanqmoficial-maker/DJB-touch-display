/**
 * DJ Core — Stem Effects Engine (Serato DJ Pro Style Pads 5–8 Coordinator)
 *
 * Coordinates the 4 Stem Performance Effects per Deck:
 * - PAD 5: VOCAL ECHO (Short, tight 1/4-beat BPM-synced Echo-Out on VOCAL while Melody, Bass & Drums stay ON)
 * - PAD 6: INSTRUMENTAL ECHO (Short, tight 1/4-beat BPM-synced Echo-Out on MELODY + BASS + DRUMS while VOCAL stays ON)
 * - PAD 7: INSTRUMENTAL BREAKER (Beat-synced Turntable Brake + Rhythmic Breaker on MELODY + BASS + DRUMS while VOCAL stays ON)
 * - PAD 8: DRUMS ECHO (Short, tight 1/4-beat BPM-synced Echo-Out on DRUMS while Vocal, Melody & Bass stay ON)
 */

import { BeatSyncEngine } from './BeatSyncEngine';
import { InstrumentalBreakerEngine } from './BreakerEngine';
import { StemEchoUnit } from './EchoEngine';
import { DeckStemPadState } from './StemStateManager';

export class StemEffectsEngine {
  private ctx: AudioContext;

  // Pre-Fader Stem Tap Inputs (fed continuously from StemSeparationEngine before dry stem mute gates)
  public readonly vocalPreFaderInput: GainNode;
  public readonly instrumentalPreFaderInput: GainNode;
  public readonly drumsPreFaderInput: GainNode;

  // Combined Wet FX Output Node
  public readonly outputNode: GainNode;

  // Individual Serato-Style Stem FX Processors
  public readonly vocalEchoUnit: StemEchoUnit;
  public readonly instrumentalEchoUnit: StemEchoUnit;
  public readonly instrumentalBreakerUnit: InstrumentalBreakerEngine;
  public readonly drumsEchoUnit: StemEchoUnit;

  private currentBpm = 124.0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.vocalPreFaderInput = ctx.createGain();
    this.instrumentalPreFaderInput = ctx.createGain();
    this.drumsPreFaderInput = ctx.createGain();
    this.outputNode = ctx.createGain();

    // PAD 5: VOCAL ECHO (Short 1/4-beat musical DJ Echo-Out on Vocal)
    this.vocalEchoUnit = new StemEchoUnit(ctx, {
      mode: 'ECHO_OUT_CAPTURE',
      division: '1/4',
      feedback: 0.34,
      highPassHz: 240,
      lowPassHz: 4000,
      wetLevel: 0.92,
    });

    // PAD 6: INSTRUMENTAL ECHO (Short 1/4-beat musical DJ Echo-Out on Melody + Bass + Drums)
    this.instrumentalEchoUnit = new StemEchoUnit(ctx, {
      mode: 'ECHO_OUT_CAPTURE',
      division: '1/4',
      feedback: 0.34,
      highPassHz: 150,
      lowPassHz: 4200,
      wetLevel: 0.9,
    });

    // PAD 7: INSTRUMENTAL BREAKER (BPM-synced turntable motor brake + rhythmic breaker on Instrumental)
    this.instrumentalBreakerUnit = new InstrumentalBreakerEngine(ctx);

    // PAD 8: DRUMS ECHO (Short 1/4-beat musical DJ Echo-Out on Drums)
    this.drumsEchoUnit = new StemEchoUnit(ctx, {
      mode: 'ECHO_OUT_CAPTURE',
      division: '1/4',
      feedback: 0.35,
      highPassHz: 140,
      lowPassHz: 5500,
      wetLevel: 0.92,
    });

    // Wire pre-fader stem buses into their respective FX units
    this.vocalPreFaderInput.connect(this.vocalEchoUnit.inputNode);
    this.instrumentalPreFaderInput.connect(this.instrumentalEchoUnit.inputNode);
    this.instrumentalPreFaderInput.connect(
      this.instrumentalBreakerUnit.inputNode
    );
    this.drumsPreFaderInput.connect(this.drumsEchoUnit.inputNode);

    // Sum all Stem FX wet outputs into outputNode
    this.vocalEchoUnit.outputNode.connect(this.outputNode);
    this.instrumentalEchoUnit.outputNode.connect(this.outputNode);
    this.instrumentalBreakerUnit.outputNode.connect(this.outputNode);
    this.drumsEchoUnit.outputNode.connect(this.outputNode);
  }

  /**
   * Synchronizes all Stem FX processors with the deck's real-time BPM (and pitch changes).
   */
  public setBpm(bpm: number): void {
    const safeBpm = BeatSyncEngine.resolveEffectiveBpm(bpm);
    this.currentBpm = safeBpm;
    this.vocalEchoUnit.setBpm(safeBpm);
    this.instrumentalEchoUnit.setBpm(safeBpm);
    this.instrumentalBreakerUnit.setBpm(safeBpm);
    this.drumsEchoUnit.setBpm(safeBpm);
  }

  /**
   * Applies the active/inactive states of Pads 5–8 to the Stem FX processors.
   */
  public updateFromState(state: DeckStemPadState, bpm?: number): void {
    if (bpm !== undefined) {
      this.setBpm(bpm);
    }
    this.vocalEchoUnit.setActive(state.vocalEchoActive, this.currentBpm);
    this.instrumentalEchoUnit.setActive(
      state.instrumentalEchoActive,
      this.currentBpm
    );
    this.instrumentalBreakerUnit.setActive(
      state.instrumentalBreakerActive,
      this.currentBpm
    );
    this.drumsEchoUnit.setActive(state.drumsEchoActive, this.currentBpm);
  }
}
