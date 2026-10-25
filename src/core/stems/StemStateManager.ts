/**
 * DJ Core — Stem State & Serato DJ Pro Automation Manager
 *
 * Manages independent Stem states for Deck A and Deck B:
 * - PAD 1 -> VOCAL
 * - PAD 2 -> MELODY
 * - PAD 3 -> BASS
 * - PAD 4 -> DRUMS
 * - PAD 5 -> VOCAL ECHO (Red Performance FX)
 * - PAD 6 -> INSTRUMENTAL ECHO (Red Performance FX)
 * - PAD 7 -> INSTRUMENTAL BREAKER (Red Performance FX)
 * - PAD 8 -> DRUMS ECHO (Red Performance FX)
 *
 * Exact Stem + FX Automation & Manual Lock Rules:
 * - PAD 5 (VOCAL ECHO):
 *   - Deactivates ONLY Vocal (`vocalActive: false`).
 *   - Keeps Melody, Bass, and Drums ACTIVE (`true`).
 *   - Applies short BPM-synced Echo to Vocal.
 *   - LOCKS manual activation of Vocal (Pad 1) while Vocal Echo is active.
 *   - When deactivated: retires the effect and automatically restores previous state with Vocal active (`true`).
 *
 * - PAD 6 (INSTRUMENTAL ECHO):
 *   - Deactivates Melody, Bass, and Drums (`false`).
 *   - Keeps ONLY Vocal ACTIVE (`vocalActive: true`).
 *   - Applies short BPM-synced Echo to the Instrumental (Melody + Bass + Drums).
 *   - LOCKS manual activation of Melody (Pad 2), Bass (Pad 3), and Drums (Pad 4) while active.
 *   - When deactivated: retires the effect and automatically restores previous stems state.
 *
 * - PAD 7 (INSTRUMENTAL BREAKER):
 *   - Keeps ONLY Vocal ACTIVE (`vocalActive: true`).
 *   - Deactivates Melody, Bass, and Drums (`false`).
 *   - Applies BPM-synced Break/Breaker to the Instrumental (Melody + Bass + Drums).
 *   - LOCKS manual activation of Melody (Pad 2), Bass (Pad 3), and Drums (Pad 4) while active.
 *   - When deactivated: retires the effect and automatically restores previous stems state.
 *
 * - PAD 8 (DRUMS ECHO):
 *   - Deactivates ONLY Drums (`drumsActive: false`).
 *   - Keeps Vocal, Melody, and Bass ACTIVE (`true`).
 *   - Applies short BPM-synced Echo to Drums.
 *   - LOCKS manual activation of Drums (Pad 4) while Drums Echo is active.
 *   - When deactivated: retires the effect and automatically restores previous state with Drums active (`true`).
 */

export type StemId = 'vocal' | 'melody' | 'bass' | 'drums';

export type StemFxId =
  | 'vocalEcho'
  | 'instrumentalEcho'
  | 'instrumentalBreaker'
  | 'drumsEcho';

export interface ManualStemsSnapshot {
  vocalActive: boolean;
  melodyActive: boolean;
  bassActive: boolean;
  drumsActive: boolean;
}

export interface DeckStemPadState {
  // Pads 1–4: Real-Time Isolated Stems
  vocalActive: boolean;
  melodyActive: boolean;
  bassActive: boolean;
  drumsActive: boolean;

  // Pads 5–8: Serato DJ Pro Style Stem FX (Illuminated in RED when active)
  vocalEchoActive: boolean;
  instrumentalEchoActive: boolean;
  instrumentalBreakerActive: boolean;
  drumsEchoActive: boolean;

  // Snapshot of manual Pad 1–4 state before any Pad 5–8 automation was engaged
  savedManualStems?: ManualStemsSnapshot;

  // Monotonic trigger counter so audio engines detect re-triggers of Echo/Breaker
  fxTriggerSequence?: number;
}

export const INITIAL_DECK_STEM_STATE: DeckStemPadState = {
  vocalActive: true,
  melodyActive: true,
  bassActive: true,
  drumsActive: true,
  vocalEchoActive: false,
  instrumentalEchoActive: false,
  instrumentalBreakerActive: false,
  drumsEchoActive: false,
  savedManualStems: {
    vocalActive: true,
    melodyActive: true,
    bassActive: true,
    drumsActive: true,
  },
  fxTriggerSequence: 0,
};

export class StemStateManager {
  public static hasAnyActiveStemFx(state: DeckStemPadState): boolean {
    return (
      state.vocalEchoActive ||
      state.instrumentalEchoActive ||
      state.instrumentalBreakerActive ||
      state.drumsEchoActive
    );
  }

  /**
   * Returns true if a specific Stem Pad (1..4) is currently LOCKED by an active
   * Stem FX (Pads 5..8) to prevent manual state conflicts:
   * - Pad 1 (VOCAL) is locked while PAD 5 (VOCAL ECHO) is active.
   * - Pads 2, 3, 4 (MELODY, BASS, DRUMS) are locked while PAD 6 (INSTRUMENTAL ECHO)
   *   or PAD 7 (INSTRUMENTAL BREAKER) is active.
   * - Pad 4 (DRUMS) is locked while PAD 8 (DRUMS ECHO) is active.
   */
  public static isStemPadLocked(
    state: DeckStemPadState,
    padIndex: number
  ): boolean {
    if (padIndex === 1 && state.vocalEchoActive) {
      return true;
    }
    if (
      (padIndex === 2 || padIndex === 3 || padIndex === 4) &&
      (state.instrumentalEchoActive || state.instrumentalBreakerActive)
    ) {
      return true;
    }
    if (padIndex === 4 && state.drumsEchoActive) {
      return true;
    }
    return false;
  }

  private static captureManualSnapshotIfNoneActive(
    current: DeckStemPadState
  ): ManualStemsSnapshot {
    if (!this.hasAnyActiveStemFx(current)) {
      return {
        vocalActive: current.vocalActive,
        melodyActive: current.melodyActive,
        bassActive: current.bassActive,
        drumsActive: current.drumsActive,
      };
    }
    return (
      current.savedManualStems ?? {
        vocalActive: true,
        melodyActive: true,
        bassActive: true,
        drumsActive: true,
      }
    );
  }

  /**
   * Processes a Performance Pad press (1..8) on the STEMS page and returns
   * the conflict-free updated DeckStemPadState.
   */
  public static applyPadPress(
    current: DeckStemPadState,
    padIndex: number
  ): DeckStemPadState {
    const nextSeq = (current.fxTriggerSequence ?? 0) + 1;

    // ========================================================================
    // PADS 1–4: Direct Stem Toggle (VOCAL, MELODY, BASS, DRUMS)
    // Respects active Stem FX manual locks!
    // ========================================================================
    if (padIndex >= 1 && padIndex <= 4) {
      if (this.isStemPadLocked(current, padIndex)) {
        return current;
      }

      const next: DeckStemPadState = {
        ...current,
        vocalActive:
          padIndex === 1 ? !current.vocalActive : current.vocalActive,
        melodyActive:
          padIndex === 2 ? !current.melodyActive : current.melodyActive,
        bassActive: padIndex === 3 ? !current.bassActive : current.bassActive,
        drumsActive:
          padIndex === 4 ? !current.drumsActive : current.drumsActive,
      };

      const prevSaved = current.savedManualStems ?? {
        vocalActive: true,
        melodyActive: true,
        bassActive: true,
        drumsActive: true,
      };

      next.savedManualStems = {
        vocalActive: padIndex === 1 ? next.vocalActive : prevSaved.vocalActive,
        melodyActive:
          padIndex === 2 ? next.melodyActive : prevSaved.melodyActive,
        bassActive: padIndex === 3 ? next.bassActive : prevSaved.bassActive,
        drumsActive: padIndex === 4 ? next.drumsActive : prevSaved.drumsActive,
      };

      return next;
    }

    // ========================================================================
    // PADS 5–8: Serato DJ Pro Style Automated Stem FX
    // ========================================================================
    const savedSnapshot = this.captureManualSnapshotIfNoneActive(current);

    switch (padIndex) {
      case 5: {
        // PAD 5 -> VOCAL ECHO
        const willBeActive = !current.vocalEchoActive;
        if (!willBeActive) {
          const restored: ManualStemsSnapshot = {
            vocalActive: true,
            melodyActive: savedSnapshot.melodyActive,
            bassActive: savedSnapshot.bassActive,
            drumsActive: savedSnapshot.drumsActive,
          };
          return {
            ...current,
            ...restored,
            vocalEchoActive: false,
            instrumentalEchoActive: false,
            instrumentalBreakerActive: false,
            drumsEchoActive: false,
            savedManualStems: restored,
            fxTriggerSequence: nextSeq,
          };
        }
        return {
          ...current,
          vocalActive: false,
          melodyActive: true,
          bassActive: true,
          drumsActive: true,
          vocalEchoActive: true,
          instrumentalEchoActive: false,
          instrumentalBreakerActive: false,
          drumsEchoActive: false,
          savedManualStems: savedSnapshot,
          fxTriggerSequence: nextSeq,
        };
      }

      case 6: {
        // PAD 6 -> INSTRUMENTAL ECHO
        const willBeActive = !current.instrumentalEchoActive;
        if (!willBeActive) {
          const restored: ManualStemsSnapshot = {
            vocalActive: savedSnapshot.vocalActive,
            melodyActive: true,
            bassActive: true,
            drumsActive: true,
          };
          return {
            ...current,
            ...restored,
            vocalEchoActive: false,
            instrumentalEchoActive: false,
            instrumentalBreakerActive: false,
            drumsEchoActive: false,
            savedManualStems: restored,
            fxTriggerSequence: nextSeq,
          };
        }
        return {
          ...current,
          vocalActive: true,
          melodyActive: false,
          bassActive: false,
          drumsActive: false,
          vocalEchoActive: false,
          instrumentalEchoActive: true,
          instrumentalBreakerActive: false,
          drumsEchoActive: false,
          savedManualStems: savedSnapshot,
          fxTriggerSequence: nextSeq,
        };
      }

      case 7: {
        // PAD 7 -> INSTRUMENTAL BREAKER
        const willBeActive = !current.instrumentalBreakerActive;
        if (!willBeActive) {
          const restored: ManualStemsSnapshot = {
            vocalActive: savedSnapshot.vocalActive,
            melodyActive: true,
            bassActive: true,
            drumsActive: true,
          };
          return {
            ...current,
            ...restored,
            vocalEchoActive: false,
            instrumentalEchoActive: false,
            instrumentalBreakerActive: false,
            drumsEchoActive: false,
            savedManualStems: restored,
            fxTriggerSequence: nextSeq,
          };
        }
        return {
          ...current,
          vocalActive: true,
          melodyActive: false,
          bassActive: false,
          drumsActive: false,
          vocalEchoActive: false,
          instrumentalEchoActive: false,
          instrumentalBreakerActive: true,
          drumsEchoActive: false,
          savedManualStems: savedSnapshot,
          fxTriggerSequence: nextSeq,
        };
      }

      case 8: {
        // PAD 8 -> DRUMS ECHO
        const willBeActive = !current.drumsEchoActive;
        if (!willBeActive) {
          const restored: ManualStemsSnapshot = {
            vocalActive: savedSnapshot.vocalActive,
            melodyActive: savedSnapshot.melodyActive,
            bassActive: savedSnapshot.bassActive,
            drumsActive: true,
          };
          return {
            ...current,
            ...restored,
            vocalEchoActive: false,
            instrumentalEchoActive: false,
            instrumentalBreakerActive: false,
            drumsEchoActive: false,
            savedManualStems: restored,
            fxTriggerSequence: nextSeq,
          };
        }
        return {
          ...current,
          vocalActive: true,
          melodyActive: true,
          bassActive: true,
          drumsActive: false,
          vocalEchoActive: false,
          instrumentalEchoActive: false,
          instrumentalBreakerActive: false,
          drumsEchoActive: true,
          savedManualStems: savedSnapshot,
          fxTriggerSequence: nextSeq,
        };
      }

      default:
        return current;
    }
  }
}
