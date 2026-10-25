/**
 * DJB Core — DJ Engine
 * Manages Standalone Mode & VirtualDJ Mode state, Deck A / Deck B transport,
 * Hot Cues, Loops, 3-Band EQ, Mixer Crossfader, and FX Rack parameters.
 */

export enum OperatingMode {
  UNSELECTED = 'UNSELECTED',
  STANDALONE = 'STANDALONE',
  VIRTUALDJ = 'VIRTUALDJ',
  MOBILE_ONLY = 'MOBILE_ONLY',
}

export enum MainSection {
  PERFORMANCE = 'PERFORMANCE',
  LIBRARY = 'LIBRARY',
  DECKS = 'DECKS',
  LOOPS_HOTCUES = 'LOOPS_HOTCUES',
  FX = 'FX',
  MIXER_EQ = 'MIXER_EQ',
  WAVEFORMS = 'WAVEFORMS',
  SETTINGS = 'SETTINGS',
}

export interface HotCueSlot {
  index: number; // 1 - 8
  label: string;
  positionSec: number | null;
  active: boolean;
}

export interface LoopState {
  active: boolean;
  lengthBeats: number; // 0.25, 0.5, 1, 2, 4, 8, 16, 32
  inPointSec: number | null;
  outPointSec: number | null;
}

export interface DeckEqState {
  high: number;   // -12 to +12 dB (0 default)
  mid: number;    // -12 to +12 dB (0 default)
  low: number;    // -12 to +12 dB (0 default)
  filter: number; // -100 (LPF) to +100 (HPF), 0 center
  gain: number;   // 0 to 100
}

export interface DeckState {
  id: 'A' | 'B';
  trackId: string;
  title: string;
  artist: string;
  key: string;
  baseBpm: number;
  currentBpm: number;
  pitchPercent: number; // -8% to +8%
  pitchRange: 8 | 16 | 50;
  isPlaying: boolean;
  isCueing: boolean;
  isSyncActive: boolean;
  keyLock: boolean;
  pflHeadphoneCue: boolean;
  positionSec: number;
  durationSec: number;
  jogAngleDeg: number;
  volumeFader: number; // 0 - 100
  vuMeterLevel: number; // 0 - 100
  eq: DeckEqState;
  hotCues: HotCueSlot[];
  loop: LoopState;
}

export interface FxSlotState {
  id: 1 | 2 | 3;
  name:
    | 'FILTER'
    | 'ECHO'
    | 'DELAY'
    | 'REVERB'
    | 'PING_PONG'
    | 'CUT'
    | 'FLANGER'
    | 'PHASER'
    | 'TRANS'
    | 'FILTER_LFO';
  enabledDeckA: boolean;
  enabledDeckB: boolean;
  active: boolean;
  wetDry: number;    // 0 - 100
  beatDivision: '1/4' | '1/2' | '3/4' | '1' | '2' | '4';
}

export interface MixerState {
  crossfader: number; // -100 (Deck A) to +100 (Deck B), 0 center
  crossfaderCurve: 'SMOOTH' | 'FAST_CUT' | 'LINEAR';
  masterLevel: number; // 0 - 100
  boothLevel: number;  // 0 - 100
  headphoneLevel: number; // 0 - 100
  headphoneMix: number; // 0 (Cue) to 100 (Master)
}

export function createEmptyHotCues(): HotCueSlot[] {
  return Array.from({ length: 8 }, (_, idx) => ({
    index: idx + 1,
    label: 'EMPTY',
    positionSec: null,
    active: false,
  }));
}

export const INITIAL_DECK_A: DeckState = {
  id: 'A',
  trackId: '',
  title: 'DECK A · SIN PISTA CARGADA',
  artist: '<BIBLIOTECA>',
  key: '--',
  baseBpm: 120.0,
  currentBpm: 120.0,
  pitchPercent: 0.0,
  pitchRange: 8,
  isPlaying: false,
  isCueing: false,
  isSyncActive: false,
  keyLock: true,
  pflHeadphoneCue: true,
  positionSec: 0,
  durationSec: 0,
  jogAngleDeg: 0,
  volumeFader: 85,
  vuMeterLevel: 0,
  eq: {
    high: 0,
    mid: 0,
    low: 0,
    filter: 0,
    gain: 80,
  },
  hotCues: createEmptyHotCues(),
  loop: {
    active: false,
    lengthBeats: 4,
    inPointSec: null,
    outPointSec: null,
  },
};

export const INITIAL_DECK_B: DeckState = {
  id: 'B',
  trackId: '',
  title: 'DECK B · SIN PISTA CARGADA',
  artist: '<BIBLIOTECA>',
  key: '--',
  baseBpm: 120.0,
  currentBpm: 120.0,
  pitchPercent: 0.0,
  pitchRange: 8,
  isPlaying: false,
  isCueing: false,
  isSyncActive: false,
  keyLock: true,
  pflHeadphoneCue: false,
  positionSec: 0,
  durationSec: 0,
  jogAngleDeg: 0,
  volumeFader: 85,
  vuMeterLevel: 0,
  eq: {
    high: 0,
    mid: 0,
    low: 0,
    filter: 0,
    gain: 80,
  },
  hotCues: createEmptyHotCues(),
  loop: {
    active: false,
    lengthBeats: 8,
    inPointSec: null,
    outPointSec: null,
  },
};

export const INITIAL_FX_SLOTS: FxSlotState[] = [
  {
    id: 1,
    name: 'ECHO',
    enabledDeckA: true,
    enabledDeckB: false,
    active: false,
    wetDry: 35,
    beatDivision: '1/2',
  },
  {
    id: 2,
    name: 'REVERB',
    enabledDeckA: false,
    enabledDeckB: true,
    active: false,
    wetDry: 25,
    beatDivision: '1',
  },
  {
    id: 3,
    name: 'FLANGER',
    enabledDeckA: true,
    enabledDeckB: true,
    active: false,
    wetDry: 40,
    beatDivision: '4',
  },
];

export const INITIAL_MIXER_STATE: MixerState = {
  crossfader: 0,
  crossfaderCurve: 'FAST_CUT',
  masterLevel: 82,
  boothLevel: 70,
  headphoneLevel: 76,
  headphoneMix: 35,
};

export function formatTimeCode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}
