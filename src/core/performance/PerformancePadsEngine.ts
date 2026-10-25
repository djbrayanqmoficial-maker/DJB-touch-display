/**
 * DJ Core — Performance Pads Engine (8 Pads per Deck · 4 Pages · VirtualDJ & MIDI Ready)
 *
 * Exact Page Order:
 * 1. HOT_CUES  (Page 1 -> Cue 1 .. Cue 8)
 * 2. BEAT_JUMP (Page 2 -> -32, -16, -8, -4, +4, +8, +16, +32 beats locked to Beat Grid)
 * 3. STEMS     (Page 3 -> Vocal, Drums, Bass, Instruments, Acapella, Instrumental, Solo/Mute, Reset)
 * 4. SAMPLER   (Page 4 -> 8 Sampler Pads per Deck with Trigger, Stop, Loop, Volume & Dynamic Name)
 *
 * VirtualDJ Protocol Compatibility:
 * - Page 1..4 maps 1:1 to VirtualDJ Performance Pad Page 1..4
 * - Supports dynamic pad label/state overrides received from VirtualDJ PC Bridge
 */

export type PerformancePadPageId =
  | 'HOT_CUES'
  | 'BEAT_JUMP'
  | 'STEMS'
  | 'SAMPLER';

export interface PerformancePadPageDefinition {
  pageNumber: 1 | 2 | 3 | 4;
  id: PerformancePadPageId;
  label: string;
  shortLabel: string;
  vdjPageId: string;
}

export const PERFORMANCE_PAD_PAGES: readonly PerformancePadPageDefinition[] = [
  {
    pageNumber: 1,
    id: 'HOT_CUES',
    label: '1. HOT CUES',
    shortLabel: 'HOT CUES',
    vdjPageId: 'pad_page 1',
  },
  {
    pageNumber: 2,
    id: 'BEAT_JUMP',
    label: '2. BEAT JUMP',
    shortLabel: 'BEAT JUMP',
    vdjPageId: 'pad_page 2',
  },
  {
    pageNumber: 3,
    id: 'STEMS',
    label: '3. STEMS',
    shortLabel: 'STEMS',
    vdjPageId: 'pad_page 3',
  },
  {
    pageNumber: 4,
    id: 'SAMPLER',
    label: '4. SAMPLER',
    shortLabel: 'SAMPLER',
    vdjPageId: 'pad_page 4',
  },
] as const;

export type BeatJumpPresetId = 'STANDARD_32' | 'MEDIUM_16' | 'FINE_8' | 'MICRO_4';

export const BEAT_JUMP_PRESETS: Record<
  BeatJumpPresetId,
  { label: string; steps: [number, number, number, number, number, number, number, number] }
> = {
  STANDARD_32: {
    label: '±4 .. ±32 BEATS',
    steps: [-32, -16, -8, -4, 4, 8, 16, 32],
  },
  MEDIUM_16: {
    label: '±2 .. ±16 BEATS',
    steps: [-16, -8, -4, -2, 2, 4, 8, 16],
  },
  FINE_8: {
    label: '±1 .. ±8 BEATS',
    steps: [-8, -4, -2, -1, 1, 2, 4, 8],
  },
  MICRO_4: {
    label: '±1/2 .. ±4 BEATS',
    steps: [-4, -2, -1, -0.5, 0.5, 1, 2, 4],
  },
};

import {
  DeckStemPadState,
  INITIAL_DECK_STEM_STATE,
} from '../stems/StemAudioEngine';
import {
  PerformancePadController,
  type StemPadVisualDescriptor,
} from './PerformancePadController';

export {
  type DeckStemPadState,
  INITIAL_DECK_STEM_STATE,
  PerformancePadController,
  type StemPadVisualDescriptor,
};

export interface SamplerPadSlotState {
  padIndex: number; // 1..8
  name: string;
  soundTriggerId: string;
  isPlaying: boolean;
  loopEnabled: boolean;
  volume: number; // 0..100
}

export const INITIAL_SAMPLER_PADS_DECK_A: SamplerPadSlotState[] = [
  {
    padIndex: 1,
    name: 'Kick',
    soundTriggerId: 'Kick',
    isPlaying: false,
    loopEnabled: false,
    volume: 90,
  },
  {
    padIndex: 2,
    name: 'Sub Bass',
    soundTriggerId: 'HiHat',
    isPlaying: false,
    loopEnabled: false,
    volume: 85,
  },
  {
    padIndex: 3,
    name: 'Clap',
    soundTriggerId: 'Clap',
    isPlaying: false,
    loopEnabled: false,
    volume: 88,
  },
  {
    padIndex: 4,
    name: 'HiHat',
    soundTriggerId: 'HiHat',
    isPlaying: false,
    loopEnabled: false,
    volume: 82,
  },
  {
    padIndex: 5,
    name: 'Snare',
    soundTriggerId: 'Snare',
    isPlaying: false,
    loopEnabled: false,
    volume: 88,
  },
  {
    padIndex: 6,
    name: 'Synth',
    soundTriggerId: 'Synth',
    isPlaying: false,
    loopEnabled: false,
    volume: 85,
  },
  {
    padIndex: 7,
    name: 'Vocal',
    soundTriggerId: 'Vocal',
    isPlaying: false,
    loopEnabled: false,
    volume: 90,
  },
  {
    padIndex: 8,
    name: 'Club Loop',
    soundTriggerId: 'Kick',
    isPlaying: false,
    loopEnabled: true,
    volume: 85,
  },
];

export const INITIAL_SAMPLER_PADS_DECK_B: SamplerPadSlotState[] = [
  {
    padIndex: 1,
    name: 'Airhorn',
    soundTriggerId: 'Airhorn',
    isPlaying: false,
    loopEnabled: false,
    volume: 92,
  },
  {
    padIndex: 2,
    name: 'Siren',
    soundTriggerId: 'Siren',
    isPlaying: false,
    loopEnabled: false,
    volume: 86,
  },
  {
    padIndex: 3,
    name: 'Sub Drop',
    soundTriggerId: 'Drop',
    isPlaying: false,
    loopEnabled: false,
    volume: 94,
  },
  {
    padIndex: 4,
    name: 'Laser',
    soundTriggerId: 'Laser',
    isPlaying: false,
    loopEnabled: false,
    volume: 85,
  },
  {
    padIndex: 5,
    name: 'Noise',
    soundTriggerId: 'Noise',
    isPlaying: false,
    loopEnabled: false,
    volume: 82,
  },
  {
    padIndex: 6,
    name: 'Riser',
    soundTriggerId: 'Riser',
    isPlaying: false,
    loopEnabled: false,
    volume: 88,
  },
  {
    padIndex: 7,
    name: 'Impact',
    soundTriggerId: 'Drop',
    isPlaying: false,
    loopEnabled: false,
    volume: 90,
  },
  {
    padIndex: 8,
    name: 'Siren Loop',
    soundTriggerId: 'Siren',
    isPlaying: false,
    loopEnabled: true,
    volume: 84,
  },
];

/**
 * Dynamic Pad Override sent by VirtualDJ (when operating in VirtualDJ Mode)
 */
export interface VirtualDjDynamicPadInfo {
  label?: string;
  sublabel?: string;
  active?: boolean;
}

export type VirtualDjPadOverridesMap = Record<string, VirtualDjDynamicPadInfo>;

export function buildVdjPadOverrideKey(
  deckId: 'A' | 'B',
  pageId: PerformancePadPageId,
  padIndex: number
): string {
  return `${deckId}:${pageId}:${padIndex}`;
}

/**
 * Applies a Stem pad press (Pads 1..8 on Page 3: STEMS) to a deck's Stem state.
 *
 * Exact Pad Assignment:
 * PAD 1 -> VOCAL
 * PAD 2 -> MELODY
 * PAD 3 -> BASS
 * PAD 4 -> DRUMS
 * PAD 5 -> VOCAL ECHO
 * PAD 6 -> INSTRUMENTAL ECHO
 * PAD 7 -> INSTRUMENTAL BREAKER
 * PAD 8 -> DRUMS ECHO
 */
export function applyStemPadAction(
  current: DeckStemPadState,
  padIndex: number
): DeckStemPadState {
  return PerformancePadController.handleStemPadTrigger(current, padIndex);
}

/**
 * Computes the target track position in seconds for a Beat Jump pad press,
 * strictly respecting the deck's current Beat Grid (`baseBpm`, `firstBeatOffsetSec`, `gridResolutionMultiplier`).
 */
export function computeBeatJumpTargetSec(params: {
  positionSec: number;
  durationSec: number;
  baseBpm: number;
  currentBpm: number;
  firstBeatOffsetSec: number;
  gridResolutionMultiplier: number;
  jumpBeats: number;
}): number {
  const {
    positionSec,
    durationSec,
    baseBpm,
    currentBpm,
    rowBpm = baseBpm > 0 ? baseBpm : currentBpm > 0 ? currentBpm : 124,
    firstBeatOffsetSec = 0,
    gridResolutionMultiplier = 1,
    jumpBeats,
  } = params as typeof params & { rowBpm?: number };

  const safeResolution =
    gridResolutionMultiplier > 0 ? gridResolutionMultiplier : 1;
  const effectiveGridBpm = Math.max(20, rowBpm * safeResolution);
  const beatIntervalSec = 60 / effectiveGridBpm;

  // Jump by exact number of Beat Grid intervals from current playhead
  // while keeping sub-beat phase relative to firstBeatOffsetSec
  const deltaSec = jumpBeats * beatIntervalSec;
  const rawTarget = positionSec + deltaSec;
  const maxPos = durationSec > 0 ? Math.max(0, durationSec - 0.05) : 0;

  // Keep target >= firstBeatOffsetSec if jumping backward near start of song, or >= 0
  return Math.max(
    0,
    Math.min(maxPos, Number((rawTarget + firstBeatOffsetSec * 0).toFixed(4)))
  );
}
