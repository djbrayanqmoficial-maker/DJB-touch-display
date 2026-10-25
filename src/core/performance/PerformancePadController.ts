/**
 * DJ Core — Performance Pad Controller
 *
 * Centralizes logic for the 8 Performance Pads per Deck across all 4 pages:
 * 1. HOT_CUES
 * 2. BEAT_JUMP
 * 3. STEMS (Pads 1–4: Real Stems VOCAL, MELODY, BASS, DRUMS · Pads 5–8: Serato DJ Pro Red Stem FX)
 * 4. SAMPLER
 */

import {
  DeckStemPadState,
  StemStateManager,
} from '../stems/StemStateManager';

export interface StemPadVisualDescriptor {
  padIndex: number; // 1..8
  defaultLabel: string;
  sublabel: string;
  isActive: boolean;
  isSeratoStemFx: boolean; // true for Pads 5–8 (Illuminated in RED when active, never blue)
  isLocked?: boolean; // true when a Stem Pad (1–4) is locked by an active Stem FX (5–8)
}

export class PerformancePadController {
  /**
   * Processes a Stem Pad press (1..8) using StemStateManager's conflict-free
   * Serato DJ Pro Stem + FX automation rules.
   */
  public static handleStemPadTrigger(
    current: DeckStemPadState,
    padIndex: number
  ): DeckStemPadState {
    return StemStateManager.applyPadPress(current, padIndex);
  }

  /**
   * Builds the 8 visual pad descriptors for Page 3 (STEMS).
   * - Pads 1–4: VOCAL, MELODY, BASS, DRUMS (Standard ON/OFF state, with manual lock protection during active Stem FX)
   * - Pads 5–8: VOCAL ECHO, INSTRUMENTAL ECHO, INSTRUMENTAL BREAKER, DRUMS ECHO
   *   (isSeratoStemFx = true -> Illuminated in RED when ON, normal when OFF)
   */
  public static buildStemPadDescriptors(
    stems: DeckStemPadState
  ): StemPadVisualDescriptor[] {
    const vocalLocked = StemStateManager.isStemPadLocked(stems, 1);
    const melodyLocked = StemStateManager.isStemPadLocked(stems, 2);
    const bassLocked = StemStateManager.isStemPadLocked(stems, 3);
    const drumsLocked = StemStateManager.isStemPadLocked(stems, 4);

    return [
      {
        padIndex: 1,
        defaultLabel: 'VOCAL',
        sublabel: vocalLocked
          ? 'FX LOCKED'
          : stems.vocalActive
          ? 'ON · ACTIVE'
          : 'OFF · MUTED',
        isActive: stems.vocalActive,
        isSeratoStemFx: false,
        isLocked: vocalLocked,
      },
      {
        padIndex: 2,
        defaultLabel: 'MELODY',
        sublabel: melodyLocked
          ? 'FX LOCKED'
          : stems.melodyActive
          ? 'ON · ACTIVE'
          : 'OFF · MUTED',
        isActive: stems.melodyActive,
        isSeratoStemFx: false,
        isLocked: melodyLocked,
      },
      {
        padIndex: 3,
        defaultLabel: 'BASS',
        sublabel: bassLocked
          ? 'FX LOCKED'
          : stems.bassActive
          ? 'ON · ACTIVE'
          : 'OFF · MUTED',
        isActive: stems.bassActive,
        isSeratoStemFx: false,
        isLocked: bassLocked,
      },
      {
        padIndex: 4,
        defaultLabel: 'DRUMS',
        sublabel: drumsLocked
          ? 'FX LOCKED'
          : stems.drumsActive
          ? 'ON · ACTIVE'
          : 'OFF · MUTED',
        isActive: stems.drumsActive,
        isSeratoStemFx: false,
        isLocked: drumsLocked,
      },
      {
        padIndex: 5,
        defaultLabel: 'VOCAL ECHO',
        sublabel: stems.vocalEchoActive ? 'FX ON · ECHO' : 'STEM FX',
        isActive: stems.vocalEchoActive,
        isSeratoStemFx: true,
        isLocked: false,
      },
      {
        padIndex: 6,
        defaultLabel: 'INSTRUMENTAL ECHO',
        sublabel: stems.instrumentalEchoActive ? 'FX ON · ECHO' : 'STEM FX',
        isActive: stems.instrumentalEchoActive,
        isSeratoStemFx: true,
        isLocked: false,
      },
      {
        padIndex: 7,
        defaultLabel: 'INSTRUMENTAL BREAKER',
        sublabel: stems.instrumentalBreakerActive ? 'FX ON · BREAK' : 'STEM FX',
        isActive: stems.instrumentalBreakerActive,
        isSeratoStemFx: true,
        isLocked: false,
      },
      {
        padIndex: 8,
        defaultLabel: 'DRUMS ECHO',
        sublabel: stems.drumsEchoActive ? 'FX ON · ECHO' : 'STEM FX',
        isActive: stems.drumsEchoActive,
        isSeratoStemFx: true,
        isLocked: false,
      },
    ];
  }
}
