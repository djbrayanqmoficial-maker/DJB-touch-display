/**
 * DJ Core — BPM & Beat Grid Synchronization Engine for Stems & FX
 *
 * Calculates exact musical time divisions (in seconds and samples) from the deck's
 * real-time BPM (including pitch fader adjustments) and Beat Grid phase.
 * Never uses arbitrary fixed times.
 */

export type MusicalBeatDivision =
  | '1/16'
  | '1/8'
  | '1/4'
  | '1/3'
  | '3/8'
  | '1/2'
  | '3/4'
  | '1/1'
  | '2/1'
  | '4/1';

const DIVISION_MULTIPLIERS: Record<MusicalBeatDivision, number> = {
  '1/16': 0.0625,
  '1/8': 0.125,
  '1/4': 0.25,
  '1/3': 1 / 3,
  '3/8': 0.375,
  '1/2': 0.5,
  '3/4': 0.75,
  '1/1': 1.0,
  '2/1': 2.0,
  '4/1': 4.0,
};

export interface DeckBeatSyncContext {
  currentBpm: number;
  baseBpm: number;
  pitchPercent: number;
  positionSec: number;
  firstBeatOffsetSec: number;
  gridResolutionMultiplier: number;
}

export class BeatSyncEngine {
  /**
   * Returns a safe, clamped effective BPM from the deck state.
   * Respects pitch adjustments (currentBpm = baseBpm * (1 + pitchPercent / 100)).
   */
  public static resolveEffectiveBpm(
    currentBpm?: number,
    baseBpm?: number,
    pitchPercent = 0
  ): number {
    if (currentBpm && Number.isFinite(currentBpm) && currentBpm >= 30) {
      return Math.min(260, Math.max(30, currentBpm));
    }
    if (baseBpm && Number.isFinite(baseBpm) && baseBpm >= 30) {
      const scaled = baseBpm * (1 + pitchPercent / 100);
      return Math.min(260, Math.max(30, scaled));
    }
    return 124.0;
  }

  /**
   * Duration of 1 quarter-note beat in seconds at the given BPM.
   * Example: 140 BPM -> 60 / 140 = 0.428571s
   */
  public static getBeatDurationSec(bpm: number): number {
    const safeBpm = this.resolveEffectiveBpm(bpm);
    return 60.0 / safeBpm;
  }

  /**
   * Returns the exact duration in seconds of a musical beat division at the given BPM.
   */
  public static getDivisionDurationSec(
    bpm: number,
    division: MusicalBeatDivision,
    minSec = 0.03,
    maxSec = 2.4
  ): number {
    const beatSec = this.getBeatDurationSec(bpm);
    const mult = DIVISION_MULTIPLIERS[division] ?? 0.5;
    return Math.min(maxSec, Math.max(minSec, beatSec * mult));
  }

  /**
   * Computes the current beat phase [0.0 .. 1.0) and time remaining until the next beat boundary
   * locked to the deck's Beat Grid (`firstBeatOffsetSec` and `gridResolutionMultiplier`).
   */
  public static getBeatGridPhaseInfo(ctx: DeckBeatSyncContext): {
    beatDurationSec: number;
    beatIndex: number;
    phaseNormalized: number; // 0.0 at beat marker .. 1.0 at next beat marker
    timeToNextBeatSec: number;
  } {
    const effectiveBpm = this.resolveEffectiveBpm(
      ctx.currentBpm,
      ctx.baseBpm,
      ctx.pitchPercent
    );
    const gridRes =
      ctx.gridResolutionMultiplier && ctx.gridResolutionMultiplier > 0
        ? ctx.gridResolutionMultiplier
        : 1;
    const beatDurationSec = 60.0 / (effectiveBpm * gridRes);
    const relPos = ctx.positionSec - (ctx.firstBeatOffsetSec || 0);
    const exactBeats = relPos / beatDurationSec;
    const beatIndex = Math.floor(exactBeats);
    const phaseNormalized = ((exactBeats % 1) + 1) % 1;
    const timeToNextBeatSec = (1 - phaseNormalized) * beatDurationSec;

    return {
      beatDurationSec,
      beatIndex,
      phaseNormalized,
      timeToNextBeatSec,
    };
  }
}
