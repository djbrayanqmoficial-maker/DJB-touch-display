/**
 * DJ Core — Modular Real-Time Stem Separation & Serato DJ Pro Stem FX Coordinator
 *
 * Delegates to the dedicated modular architecture:
 * - StemSeparationEngine (`./StemSeparationEngine.ts`)
 * - StemMixer (`./StemMixer.ts`)
 * - StemStateManager (`./StemStateManager.ts`)
 * - StemEffectsEngine (`./StemEffectsEngine.ts`)
 * - EchoEngine (`./EchoEngine.ts`)
 * - BreakerEngine (`./BreakerEngine.ts`)
 * - BeatSyncEngine (`./BeatSyncEngine.ts`)
 */

import { NeuralStemModelProvider } from './StemSeparationEngine';
import { StemMixer } from './StemMixer';
import {
  DeckStemPadState,
  INITIAL_DECK_STEM_STATE,
  StemFxId,
  StemId,
  StemStateManager,
} from './StemStateManager';

export {
  type DeckStemPadState,
  INITIAL_DECK_STEM_STATE,
  type NeuralStemModelProvider,
  type StemFxId,
  type StemId,
  StemStateManager,
};

export class DeckStemProcessor {
  public readonly deckId: 'A' | 'B';
  public readonly stemMixer: StemMixer;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  private state: DeckStemPadState = { ...INITIAL_DECK_STEM_STATE };

  constructor(deckId: 'A' | 'B', ctx: AudioContext) {
    this.deckId = deckId;
    this.stemMixer = new StemMixer(ctx);
    this.inputNode = this.stemMixer.inputNode;
    this.outputNode = this.stemMixer.outputNode;
  }

  public setStemState(nextState: DeckStemPadState, currentBpm?: number): void {
    this.state = { ...nextState };
    this.stemMixer.applyStemState(this.state, currentBpm);
  }

  public getStemState(): DeckStemPadState {
    return { ...this.state };
  }

  public registerExternalStemProvider(
    provider: NeuralStemModelProvider
  ): void {
    this.stemMixer.separationEngine.registerNeuralModelProvider(provider);
  }
}
