/**
 * MIDI ENGINE — MIDI Mapping Submodule
 * Includes:
 * - Complete bindable actions catalog (Deck A, Deck B, Mixer, Library, FX, Pads)
 * - Numark DJ2GO preset with VirtualDJ reference mapping:
 *   CUE -> cue_stop
 *   PLAY_PAUSE -> play_pause
 *   PFL -> pfl
 *   LOAD -> holding 200ms ? vinyl_mode : load
 *   BACK -> browser_window +1
 *   ENTER -> browser_folder / sideview
 *   CROSSFADER -> crossfader
 *   PITCH -> pitch
 *   BROWSER_SCROLL -> browser_scroll
 *   JOG -> jogwheel
 *   MASTER_VOLUME -> master_volume
 *   SYNC -> sync
 *   VOLUME -> filter (or channel volume)
 *   PITCHBEND+ -> volume +1 (or pitch bend +)
 *   PITCHBEND- -> volume -1 (or pitch bend -)
 *   HEADPHONE_VOL -> headphone_volume
 * - Future Controller Presets (Pioneer DDJ-400, Pioneer DDJ-FLX4, Numark NS4FX, Custom Blank)
 * - Portable JSON Export/Import ({ controller, inputs, outputs }) and localStorage persistence
 */

import { buildMidiCodeHex, parseMidiCodeHex } from './MidiInput';
import {
  ControllerProfile,
  DjbBindableActionId,
  DjbLedId,
  LedMappingEntry,
  MidiCommandType,
  MidiControlMode,
  MidiMappingEntry,
  PortableControllerMappingJson,
} from './MidiTypes';

const STORAGE_KEY_PROFILES = 'djb_midi_controller_profiles_v2';
const STORAGE_KEY_ACTIVE_PROFILE_ID = 'djb_midi_active_profile_id_v2';

export interface BindableActionMeta {
  actionId: DjbBindableActionId;
  shortKey: string;
  label: string;
  category: 'DECK_A' | 'DECK_B' | 'MIXER' | 'LIBRARY';
  defaultType: MidiCommandType;
  defaultMode: MidiControlMode;
  ledSupported: boolean;
  defaultLedId?: DjbLedId;
  vdjReferenceNote?: string;
}

export const DJB_BINDABLE_ACTIONS: BindableActionMeta[] = [
  // DECK A
  { actionId: 'DECK_A_PLAY_PAUSE', shortKey: 'PLAY_A', label: 'PLAY / PAUSE Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'PLAY_A_LED', vdjReferenceNote: 'PLAY_PAUSE → play_pause' },
  { actionId: 'DECK_A_CUE', shortKey: 'CUE_A', label: 'CUE Deck A (cue_stop)', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'CUE_A_LED', vdjReferenceNote: 'CUE → cue_stop' },
  { actionId: 'DECK_A_PFL', shortKey: 'PFL_A', label: 'PFL / Headphone Cue Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'PFL_A_LED', vdjReferenceNote: 'PFL → pfl' },
  { actionId: 'DECK_A_SYNC', shortKey: 'SYNC_A', label: 'SYNC Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'SYNC_A_LED', vdjReferenceNote: 'SYNC → sync' },
  { actionId: 'DECK_A_LOAD', shortKey: 'LOAD_A', label: 'LOAD Deck A (Hold 200ms = Vinyl Mode)', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_HOLD_200MS', ledSupported: true, defaultLedId: 'VINYL_A_LED', vdjReferenceNote: 'LOAD → holding 200ms ? vinyl_mode : load' },
  { actionId: 'DECK_A_VINYL_MODE', shortKey: 'VINYL_A', label: 'VINYL MODE Toggle Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'VINYL_A_LED' },
  { actionId: 'DECK_A_JOG_WHEEL', shortKey: 'JOG_A', label: 'JOGWHEEL Deck A (Scratch / Nudge)', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'RELATIVE_2C', ledSupported: false, vdjReferenceNote: 'JOG → jogwheel' },
  { actionId: 'DECK_A_PITCH_FADER', shortKey: 'PITCH_A', label: 'PITCH Fader Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false, vdjReferenceNote: 'PITCH → pitch' },
  { actionId: 'DECK_A_PITCH_BEND_PLUS', shortKey: 'PITCHBEND_PLUS_A', label: 'PITCH BEND + Deck A (VDJ: volume +1 / bend +)', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND+ → volume +1 / pitch_bend +' },
  { actionId: 'DECK_A_PITCH_BEND_MINUS', shortKey: 'PITCHBEND_MINUS_A', label: 'PITCH BEND - Deck A (VDJ: volume -1 / bend -)', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND- → volume -1 / pitch_bend -' },
  { actionId: 'DECK_A_VOLUME_FILTER', shortKey: 'VOL_FILTER_A', label: 'VOLUME / FILTER Deck A (VDJ: VOLUME → filter)', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false, vdjReferenceNote: 'VOLUME → filter' },
  { actionId: 'DECK_A_VOLUME', shortKey: 'VOLUME_A', label: 'VOLUME Channel Fader Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_VOLUME_INC', shortKey: 'VOL_INC_A', label: 'VOLUME +1 Step Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND+ → volume +1' },
  { actionId: 'DECK_A_VOLUME_DEC', shortKey: 'VOL_DEC_A', label: 'VOLUME -1 Step Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND- → volume -1' },
  { actionId: 'DECK_A_GAIN', shortKey: 'GAIN_A', label: 'GAIN Knob Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_EQ_HIGH', shortKey: 'EQ_HIGH_A', label: 'EQ HIGH Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_EQ_MID', shortKey: 'EQ_MID_A', label: 'EQ MID Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_EQ_LOW', shortKey: 'EQ_LOW_A', label: 'EQ LOW Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_FILTER', shortKey: 'FILTER_A', label: 'FILTER Bipolar Knob Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_FX_ON', shortKey: 'FX_ON_A', label: 'FX Lock / Enable Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'FX_A_LED' },
  { actionId: 'DECK_A_FX_X', shortKey: 'FX_X_A', label: 'FX Pad X Parameter Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_FX_Y', shortKey: 'FX_Y_A', label: 'FX Pad Y Wet/Dry Deck A', category: 'DECK_A', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_A_LOOP_ACTIVE', shortKey: 'LOOP_A', label: 'LOOP Toggle Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'LOOP_A_LED' },
  { actionId: 'DECK_A_LOOP_IN', shortKey: 'LOOP_HALF_A', label: 'LOOP Length -1/2 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_A_LOOP_OUT', shortKey: 'LOOP_DOUBLE_A', label: 'LOOP Length x2 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_A_HOTCUE_1', shortKey: 'HOTCUE_1_A', label: 'HOT CUE 1 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_1_A_LED' },
  { actionId: 'DECK_A_HOTCUE_2', shortKey: 'HOTCUE_2_A', label: 'HOT CUE 2 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_2_A_LED' },
  { actionId: 'DECK_A_HOTCUE_3', shortKey: 'HOTCUE_3_A', label: 'HOT CUE 3 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_3_A_LED' },
  { actionId: 'DECK_A_HOTCUE_4', shortKey: 'HOTCUE_4_A', label: 'HOT CUE 4 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_4_A_LED' },
  { actionId: 'DECK_A_HOTCUE_5', shortKey: 'HOTCUE_5_A', label: 'HOT CUE 5 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_A_HOTCUE_6', shortKey: 'HOTCUE_6_A', label: 'HOT CUE 6 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_A_HOTCUE_7', shortKey: 'HOTCUE_7_A', label: 'HOT CUE 7 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_A_HOTCUE_8', shortKey: 'HOTCUE_8_A', label: 'HOT CUE 8 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_A_PAD_1', shortKey: 'PAD_1_A', label: 'PERFORMANCE PAD 1 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 1' },
  { actionId: 'DECK_A_PAD_2', shortKey: 'PAD_2_A', label: 'PERFORMANCE PAD 2 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 2' },
  { actionId: 'DECK_A_PAD_3', shortKey: 'PAD_3_A', label: 'PERFORMANCE PAD 3 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 3' },
  { actionId: 'DECK_A_PAD_4', shortKey: 'PAD_4_A', label: 'PERFORMANCE PAD 4 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 4' },
  { actionId: 'DECK_A_PAD_5', shortKey: 'PAD_5_A', label: 'PERFORMANCE PAD 5 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 5' },
  { actionId: 'DECK_A_PAD_6', shortKey: 'PAD_6_A', label: 'PERFORMANCE PAD 6 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 6' },
  { actionId: 'DECK_A_PAD_7', shortKey: 'PAD_7_A', label: 'PERFORMANCE PAD 7 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 7' },
  { actionId: 'DECK_A_PAD_8', shortKey: 'PAD_8_A', label: 'PERFORMANCE PAD 8 Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 8' },
  { actionId: 'DECK_A_PAD_PAGE_1', shortKey: 'PAD_PAGE_1_A', label: 'PAD PAGE 1: HOT CUES Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 1' },
  { actionId: 'DECK_A_PAD_PAGE_2', shortKey: 'PAD_PAGE_2_A', label: 'PAD PAGE 2: BEAT JUMP Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 2' },
  { actionId: 'DECK_A_PAD_PAGE_3', shortKey: 'PAD_PAGE_3_A', label: 'PAD PAGE 3: STEMS Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 3' },
  { actionId: 'DECK_A_PAD_PAGE_4', shortKey: 'PAD_PAGE_4_A', label: 'PAD PAGE 4: SAMPLER Deck A', category: 'DECK_A', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 4' },

  // DECK B
  { actionId: 'DECK_B_PLAY_PAUSE', shortKey: 'PLAY_B', label: 'PLAY / PAUSE Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'PLAY_B_LED', vdjReferenceNote: 'PLAY_PAUSE → play_pause' },
  { actionId: 'DECK_B_CUE', shortKey: 'CUE_B', label: 'CUE Deck B (cue_stop)', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'CUE_B_LED', vdjReferenceNote: 'CUE → cue_stop' },
  { actionId: 'DECK_B_PFL', shortKey: 'PFL_B', label: 'PFL / Headphone Cue Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'PFL_B_LED', vdjReferenceNote: 'PFL → pfl' },
  { actionId: 'DECK_B_SYNC', shortKey: 'SYNC_B', label: 'SYNC Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'SYNC_B_LED', vdjReferenceNote: 'SYNC → sync' },
  { actionId: 'DECK_B_LOAD', shortKey: 'LOAD_B', label: 'LOAD Deck B (Hold 200ms = Vinyl Mode)', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_HOLD_200MS', ledSupported: true, defaultLedId: 'VINYL_B_LED', vdjReferenceNote: 'LOAD → holding 200ms ? vinyl_mode : load' },
  { actionId: 'DECK_B_VINYL_MODE', shortKey: 'VINYL_B', label: 'VINYL MODE Toggle Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'VINYL_B_LED' },
  { actionId: 'DECK_B_JOG_WHEEL', shortKey: 'JOG_B', label: 'JOGWHEEL Deck B (Scratch / Nudge)', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'RELATIVE_2C', ledSupported: false, vdjReferenceNote: 'JOG → jogwheel' },
  { actionId: 'DECK_B_PITCH_FADER', shortKey: 'PITCH_B', label: 'PITCH Fader Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false, vdjReferenceNote: 'PITCH → pitch' },
  { actionId: 'DECK_B_PITCH_BEND_PLUS', shortKey: 'PITCHBEND_PLUS_B', label: 'PITCH BEND + Deck B (VDJ: volume +1 / bend +)', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND+ → volume +1 / pitch_bend +' },
  { actionId: 'DECK_B_PITCH_BEND_MINUS', shortKey: 'PITCHBEND_MINUS_B', label: 'PITCH BEND - Deck B (VDJ: volume -1 / bend -)', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND- → volume -1 / pitch_bend -' },
  { actionId: 'DECK_B_VOLUME_FILTER', shortKey: 'VOL_FILTER_B', label: 'VOLUME / FILTER Deck B (VDJ: VOLUME → filter)', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false, vdjReferenceNote: 'VOLUME → filter' },
  { actionId: 'DECK_B_VOLUME', shortKey: 'VOLUME_B', label: 'VOLUME Channel Fader Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_VOLUME_INC', shortKey: 'VOL_INC_B', label: 'VOLUME +1 Step Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND+ → volume +1' },
  { actionId: 'DECK_B_VOLUME_DEC', shortKey: 'VOL_DEC_B', label: 'VOLUME -1 Step Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'PITCHBEND- → volume -1' },
  { actionId: 'DECK_B_GAIN', shortKey: 'GAIN_B', label: 'GAIN Knob Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_EQ_HIGH', shortKey: 'EQ_HIGH_B', label: 'EQ HIGH Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_EQ_MID', shortKey: 'EQ_MID_B', label: 'EQ MID Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_EQ_LOW', shortKey: 'EQ_LOW_B', label: 'EQ LOW Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_FILTER', shortKey: 'FILTER_B', label: 'FILTER Bipolar Knob Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_FX_ON', shortKey: 'FX_ON_B', label: 'FX Lock / Enable Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'FX_B_LED' },
  { actionId: 'DECK_B_FX_X', shortKey: 'FX_X_B', label: 'FX Pad X Parameter Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_FX_Y', shortKey: 'FX_Y_B', label: 'FX Pad Y Wet/Dry Deck B', category: 'DECK_B', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },
  { actionId: 'DECK_B_LOOP_ACTIVE', shortKey: 'LOOP_B', label: 'LOOP Toggle Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_TOGGLE', ledSupported: true, defaultLedId: 'LOOP_B_LED' },
  { actionId: 'DECK_B_LOOP_IN', shortKey: 'LOOP_HALF_B', label: 'LOOP Length -1/2 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_B_LOOP_OUT', shortKey: 'LOOP_DOUBLE_B', label: 'LOOP Length x2 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_B_HOTCUE_1', shortKey: 'HOTCUE_1_B', label: 'HOT CUE 1 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_1_B_LED' },
  { actionId: 'DECK_B_HOTCUE_2', shortKey: 'HOTCUE_2_B', label: 'HOT CUE 2 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_2_B_LED' },
  { actionId: 'DECK_B_HOTCUE_3', shortKey: 'HOTCUE_3_B', label: 'HOT CUE 3 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_3_B_LED' },
  { actionId: 'DECK_B_HOTCUE_4', shortKey: 'HOTCUE_4_B', label: 'HOT CUE 4 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: true, defaultLedId: 'HOTCUE_4_B_LED' },
  { actionId: 'DECK_B_HOTCUE_5', shortKey: 'HOTCUE_5_B', label: 'HOT CUE 5 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_B_HOTCUE_6', shortKey: 'HOTCUE_6_B', label: 'HOT CUE 6 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_B_HOTCUE_7', shortKey: 'HOTCUE_7_B', label: 'HOT CUE 7 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_B_HOTCUE_8', shortKey: 'HOTCUE_8_B', label: 'HOT CUE 8 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'DECK_B_PAD_1', shortKey: 'PAD_1_B', label: 'PERFORMANCE PAD 1 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 1' },
  { actionId: 'DECK_B_PAD_2', shortKey: 'PAD_2_B', label: 'PERFORMANCE PAD 2 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 2' },
  { actionId: 'DECK_B_PAD_3', shortKey: 'PAD_3_B', label: 'PERFORMANCE PAD 3 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 3' },
  { actionId: 'DECK_B_PAD_4', shortKey: 'PAD_4_B', label: 'PERFORMANCE PAD 4 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 4' },
  { actionId: 'DECK_B_PAD_5', shortKey: 'PAD_5_B', label: 'PERFORMANCE PAD 5 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 5' },
  { actionId: 'DECK_B_PAD_6', shortKey: 'PAD_6_B', label: 'PERFORMANCE PAD 6 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 6' },
  { actionId: 'DECK_B_PAD_7', shortKey: 'PAD_7_B', label: 'PERFORMANCE PAD 7 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 7' },
  { actionId: 'DECK_B_PAD_8', shortKey: 'PAD_8_B', label: 'PERFORMANCE PAD 8 Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad 8' },
  { actionId: 'DECK_B_PAD_PAGE_1', shortKey: 'PAD_PAGE_1_B', label: 'PAD PAGE 1: HOT CUES Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 1' },
  { actionId: 'DECK_B_PAD_PAGE_2', shortKey: 'PAD_PAGE_2_B', label: 'PAD PAGE 2: BEAT JUMP Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 2' },
  { actionId: 'DECK_B_PAD_PAGE_3', shortKey: 'PAD_PAGE_3_B', label: 'PAD PAGE 3: STEMS Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 3' },
  { actionId: 'DECK_B_PAD_PAGE_4', shortKey: 'PAD_PAGE_4_B', label: 'PAD PAGE 4: SAMPLER Deck B', category: 'DECK_B', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'pad_page 4' },

  // MIXER
  { actionId: 'MIXER_CROSSFADER', shortKey: 'CROSSFADER', label: 'CROSSFADER (Deck A ↔ Deck B)', category: 'MIXER', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false, vdjReferenceNote: 'CROSSFADER → crossfader' },
  { actionId: 'MIXER_MASTER_GAIN', shortKey: 'MASTER_VOLUME', label: 'MASTER VOLUME', category: 'MIXER', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false, vdjReferenceNote: 'MASTER_VOLUME → master_volume' },
  { actionId: 'MIXER_HEADPHONE_LEVEL', shortKey: 'HEADPHONE_VOL', label: 'HEADPHONE VOLUME', category: 'MIXER', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false, vdjReferenceNote: 'HEADPHONE_VOL → headphone_volume' },
  { actionId: 'MIXER_HEADPHONE_MIX', shortKey: 'HEADPHONE_MIX', label: 'HEADPHONE CUE / MASTER MIX', category: 'MIXER', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'ABSOLUTE', ledSupported: false },

  // LIBRARY / BROWSER
  { actionId: 'LIBRARY_SCROLL', shortKey: 'BROWSER_SCROLL', label: 'BROWSER Encoder (Scroll Tracks)', category: 'LIBRARY', defaultType: MidiCommandType.CONTROL_CHANGE, defaultMode: 'RELATIVE_2C', ledSupported: false, vdjReferenceNote: 'BROWSER_SCROLL → browser_scroll' },
  { actionId: 'LIBRARY_BACK', shortKey: 'BACK', label: 'BACK Button (browser_window +1)', category: 'LIBRARY', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'BACK → browser_window +1' },
  { actionId: 'LIBRARY_ENTER', shortKey: 'ENTER', label: 'ENTER Button (browser_folder / sideview)', category: 'LIBRARY', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false, vdjReferenceNote: 'ENTER → browser_folder / sideview' },
  { actionId: 'LIBRARY_LOAD_DECK_A', shortKey: 'LIB_LOAD_A', label: 'Library Direct Load Deck A', category: 'LIBRARY', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
  { actionId: 'LIBRARY_LOAD_DECK_B', shortKey: 'LIB_LOAD_B', label: 'Library Direct Load Deck B', category: 'LIBRARY', defaultType: MidiCommandType.NOTE_ON, defaultMode: 'BUTTON_MOMENTARY', ledSupported: false },
];

export const DJB_LED_DEFINITIONS: Array<{
  ledId: DjbLedId;
  label: string;
  linkedActionId: DjbBindableActionId;
  defaultStatus: number;
  defaultChannel: number;
  defaultData1: number;
}> = [
  { ledId: 'PLAY_A_LED', label: 'PLAY A LED', linkedActionId: 'DECK_A_PLAY_PAUSE', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x3b },
  { ledId: 'CUE_A_LED', label: 'CUE A LED', linkedActionId: 'DECK_A_CUE', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x33 },
  { ledId: 'SYNC_A_LED', label: 'SYNC A LED', linkedActionId: 'DECK_A_SYNC', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x40 },
  { ledId: 'PFL_A_LED', label: 'PFL A LED (Headphone A)', linkedActionId: 'DECK_A_PFL', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x65 },
  { ledId: 'VINYL_A_LED', label: 'VINYL MODE A LED', linkedActionId: 'DECK_A_LOAD', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x4b },
  { ledId: 'LOOP_A_LED', label: 'LOOP A LED', linkedActionId: 'DECK_A_LOOP_ACTIVE', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x50 },
  { ledId: 'FX_A_LED', label: 'FX A LED', linkedActionId: 'DECK_A_FX_ON', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x51 },
  { ledId: 'HOTCUE_1_A_LED', label: 'HOT CUE 1 A LED', linkedActionId: 'DECK_A_HOTCUE_1', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x20 },
  { ledId: 'HOTCUE_2_A_LED', label: 'HOT CUE 2 A LED', linkedActionId: 'DECK_A_HOTCUE_2', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x21 },
  { ledId: 'HOTCUE_3_A_LED', label: 'HOT CUE 3 A LED', linkedActionId: 'DECK_A_HOTCUE_3', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x22 },
  { ledId: 'HOTCUE_4_A_LED', label: 'HOT CUE 4 A LED', linkedActionId: 'DECK_A_HOTCUE_4', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x23 },
  { ledId: 'PLAY_B_LED', label: 'PLAY B LED', linkedActionId: 'DECK_B_PLAY_PAUSE', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x42 },
  { ledId: 'CUE_B_LED', label: 'CUE B LED', linkedActionId: 'DECK_B_CUE', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x3c },
  { ledId: 'SYNC_B_LED', label: 'SYNC B LED', linkedActionId: 'DECK_B_SYNC', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x47 },
  { ledId: 'PFL_B_LED', label: 'PFL B LED (Headphone B)', linkedActionId: 'DECK_B_PFL', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x66 },
  { ledId: 'VINYL_B_LED', label: 'VINYL MODE B LED', linkedActionId: 'DECK_B_LOAD', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x34 },
  { ledId: 'LOOP_B_LED', label: 'LOOP B LED', linkedActionId: 'DECK_B_LOOP_ACTIVE', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x52 },
  { ledId: 'FX_B_LED', label: 'FX B LED', linkedActionId: 'DECK_B_FX_ON', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x53 },
  { ledId: 'HOTCUE_1_B_LED', label: 'HOT CUE 1 B LED', linkedActionId: 'DECK_B_HOTCUE_1', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x24 },
  { ledId: 'HOTCUE_2_B_LED', label: 'HOT CUE 2 B LED', linkedActionId: 'DECK_B_HOTCUE_2', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x25 },
  { ledId: 'HOTCUE_3_B_LED', label: 'HOT CUE 3 B LED', linkedActionId: 'DECK_B_HOTCUE_3', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x26 },
  { ledId: 'HOTCUE_4_B_LED', label: 'HOT CUE 4 B LED', linkedActionId: 'DECK_B_HOTCUE_4', defaultStatus: 0x90, defaultChannel: 1, defaultData1: 0x27 },
];

function createMappingEntry(
  actionId: DjbBindableActionId,
  status: number,
  data1: number,
  modeOverride?: MidiControlMode
): MidiMappingEntry {
  const meta = DJB_BINDABLE_ACTIONS.find((a) => a.actionId === actionId)!;
  const highNibble = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  let command = meta.defaultType;
  if (highNibble === 0x90) command = MidiCommandType.NOTE_ON;
  else if (highNibble === 0x80) command = MidiCommandType.NOTE_OFF;
  else if (highNibble === 0xb0) command = MidiCommandType.CONTROL_CHANGE;
  else if (highNibble === 0xe0) command = MidiCommandType.PITCH_BEND;

  return {
    actionId,
    shortKey: meta.shortKey,
    actionLabel: meta.label,
    category: meta.category,
    command,
    status,
    channel,
    data1,
    midiCode: buildMidiCodeHex(status, data1),
    controlMode: modeOverride ?? meta.defaultMode,
    vdjReferenceNote: meta.vdjReferenceNote,
    ledFeedbackSupported: meta.ledSupported,
    ledOnVelocity: 127,
    ledOffVelocity: 0,
  };
}

function createDefaultDj2GoLeds(): LedMappingEntry[] {
  return DJB_LED_DEFINITIONS.map((def) => ({
    ledId: def.ledId,
    label: def.label,
    linkedActionId: def.linkedActionId,
    status: def.defaultStatus,
    channel: def.defaultChannel,
    data1: def.defaultData1,
    onVelocity: 127,
    offVelocity: 0,
    midiCode: buildMidiCodeHex(def.defaultStatus, def.defaultData1),
  }));
}

/**
 * Factory Presets:
 * 1. Numark DJ2GO (VirtualDJ Reference Mapping)
 * 2. Numark DJ2GO (Standard Volume & Pitch Bend Mapping)
 * 3. Pioneer DDJ-400 / DDJ-FLX4 Base Profile
 * 4. Numark NS4FX Base Profile
 * 5. Custom Blank MIDI Learn Profile
 */
export const INITIAL_CONTROLLER_PROFILES: ControllerProfile[] = [
  {
    id: 'profile-numark-dj2go-vdj',
    name: 'Numark DJ2GO (VirtualDJ Reference)',
    controllerModel: 'Numark DJ2GO',
    author: 'DJ Brayan',
    version: '2.0.0',
    updatedAt: '2026-10-04',
    mappings: [
      // Deck A
      createMappingEntry('DECK_A_PLAY_PAUSE', 0x90, 0x3b, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_CUE', 0x90, 0x33, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_A_PFL', 0x90, 0x65, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_SYNC', 0x90, 0x40, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_LOAD', 0x90, 0x4b, 'BUTTON_HOLD_200MS'),
      createMappingEntry('DECK_A_JOG_WHEEL', 0xb0, 0x19, 'RELATIVE_2C'),
      createMappingEntry('DECK_A_PITCH_FADER', 0xb0, 0x0d, 'ABSOLUTE'),
      createMappingEntry('DECK_A_VOLUME_FILTER', 0xb0, 0x08, 'ABSOLUTE'),
      createMappingEntry('DECK_A_VOLUME_INC', 0x90, 0x43, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_A_VOLUME_DEC', 0x90, 0x44, 'BUTTON_MOMENTARY'),
      // Deck B
      createMappingEntry('DECK_B_PLAY_PAUSE', 0x90, 0x42, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_CUE', 0x90, 0x3c, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_B_PFL', 0x90, 0x66, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_SYNC', 0x90, 0x47, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_LOAD', 0x90, 0x34, 'BUTTON_HOLD_200MS'),
      createMappingEntry('DECK_B_JOG_WHEEL', 0xb0, 0x18, 'RELATIVE_2C'),
      createMappingEntry('DECK_B_PITCH_FADER', 0xb0, 0x0e, 'ABSOLUTE'),
      createMappingEntry('DECK_B_VOLUME_FILTER', 0xb0, 0x09, 'ABSOLUTE'),
      createMappingEntry('DECK_B_VOLUME_INC', 0x90, 0x45, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_B_VOLUME_DEC', 0x90, 0x46, 'BUTTON_MOMENTARY'),
      // Mixer & Browser
      createMappingEntry('MIXER_CROSSFADER', 0xb0, 0x0a, 'ABSOLUTE'),
      createMappingEntry('MIXER_MASTER_GAIN', 0xb0, 0x17, 'ABSOLUTE'),
      createMappingEntry('MIXER_HEADPHONE_LEVEL', 0xb0, 0x0b, 'ABSOLUTE'),
      createMappingEntry('LIBRARY_SCROLL', 0xb0, 0x1a, 'RELATIVE_2C'),
      createMappingEntry('LIBRARY_BACK', 0x90, 0x59, 'BUTTON_MOMENTARY'),
      createMappingEntry('LIBRARY_ENTER', 0x90, 0x5a, 'BUTTON_MOMENTARY'),
    ],
    ledMappings: createDefaultDj2GoLeds(),
  },
  {
    id: 'profile-numark-dj2go-standard',
    name: 'Numark DJ2GO (Standard Volume + PitchBend)',
    controllerModel: 'Numark DJ2GO',
    author: 'DJ Brayan',
    version: '2.0.0',
    updatedAt: '2026-10-04',
    mappings: [
      createMappingEntry('DECK_A_PLAY_PAUSE', 0x90, 0x3b, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_CUE', 0x90, 0x33, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_A_PFL', 0x90, 0x65, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_SYNC', 0x90, 0x40, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_LOAD', 0x90, 0x4b, 'BUTTON_HOLD_200MS'),
      createMappingEntry('DECK_A_JOG_WHEEL', 0xb0, 0x19, 'RELATIVE_2C'),
      createMappingEntry('DECK_A_PITCH_FADER', 0xb0, 0x0d, 'ABSOLUTE'),
      createMappingEntry('DECK_A_VOLUME', 0xb0, 0x08, 'ABSOLUTE'),
      createMappingEntry('DECK_A_PITCH_BEND_PLUS', 0x90, 0x43, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_A_PITCH_BEND_MINUS', 0x90, 0x44, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_B_PLAY_PAUSE', 0x90, 0x42, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_CUE', 0x90, 0x3c, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_B_PFL', 0x90, 0x66, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_SYNC', 0x90, 0x47, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_LOAD', 0x90, 0x34, 'BUTTON_HOLD_200MS'),
      createMappingEntry('DECK_B_JOG_WHEEL', 0xb0, 0x18, 'RELATIVE_2C'),
      createMappingEntry('DECK_B_PITCH_FADER', 0xb0, 0x0e, 'ABSOLUTE'),
      createMappingEntry('DECK_B_VOLUME', 0xb0, 0x09, 'ABSOLUTE'),
      createMappingEntry('DECK_B_PITCH_BEND_PLUS', 0x90, 0x45, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_B_PITCH_BEND_MINUS', 0x90, 0x46, 'BUTTON_MOMENTARY'),
      createMappingEntry('MIXER_CROSSFADER', 0xb0, 0x0a, 'ABSOLUTE'),
      createMappingEntry('MIXER_MASTER_GAIN', 0xb0, 0x17, 'ABSOLUTE'),
      createMappingEntry('MIXER_HEADPHONE_LEVEL', 0xb0, 0x0b, 'ABSOLUTE'),
      createMappingEntry('LIBRARY_SCROLL', 0xb0, 0x1a, 'RELATIVE_2C'),
      createMappingEntry('LIBRARY_BACK', 0x90, 0x59, 'BUTTON_MOMENTARY'),
      createMappingEntry('LIBRARY_ENTER', 0x90, 0x5a, 'BUTTON_MOMENTARY'),
    ],
    ledMappings: createDefaultDj2GoLeds(),
  },
  {
    id: 'profile-pioneer-ddj400-flx4',
    name: 'Pioneer DDJ-400 / DDJ-FLX4 (Base Profile)',
    controllerModel: 'Pioneer DDJ-400 / FLX4',
    author: 'DJ Brayan',
    version: '1.0.0',
    updatedAt: '2026-10-04',
    mappings: [
      createMappingEntry('DECK_A_PLAY_PAUSE', 0x90, 0x0b, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_CUE', 0x90, 0x0c, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_A_SYNC', 0x90, 0x58, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_PFL', 0x90, 0x54, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_VOLUME', 0xb0, 0x13, 'ABSOLUTE'),
      createMappingEntry('DECK_A_PITCH_FADER', 0xb0, 0x00, 'ABSOLUTE'),
      createMappingEntry('DECK_A_EQ_HIGH', 0xb0, 0x07, 'ABSOLUTE'),
      createMappingEntry('DECK_A_EQ_MID', 0xb0, 0x0b, 'ABSOLUTE'),
      createMappingEntry('DECK_A_EQ_LOW', 0xb0, 0x0f, 'ABSOLUTE'),
      createMappingEntry('DECK_B_PLAY_PAUSE', 0x91, 0x0b, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_CUE', 0x91, 0x0c, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_B_SYNC', 0x91, 0x58, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_PFL', 0x91, 0x54, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_VOLUME', 0xb1, 0x13, 'ABSOLUTE'),
      createMappingEntry('DECK_B_PITCH_FADER', 0xb1, 0x00, 'ABSOLUTE'),
      createMappingEntry('DECK_B_EQ_HIGH', 0xb1, 0x07, 'ABSOLUTE'),
      createMappingEntry('DECK_B_EQ_MID', 0xb1, 0x0b, 'ABSOLUTE'),
      createMappingEntry('DECK_B_EQ_LOW', 0xb1, 0x0f, 'ABSOLUTE'),
      createMappingEntry('MIXER_CROSSFADER', 0xb6, 0x1f, 'ABSOLUTE'),
    ],
    ledMappings: createDefaultDj2GoLeds(),
  },
  {
    id: 'profile-numark-ns4fx',
    name: 'Numark NS4FX (Base Profile)',
    controllerModel: 'Numark NS4FX',
    author: 'DJ Brayan',
    version: '1.0.0',
    updatedAt: '2026-10-04',
    mappings: [
      createMappingEntry('DECK_A_PLAY_PAUSE', 0x90, 0x00, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_A_CUE', 0x90, 0x01, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_A_SYNC', 0x90, 0x02, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_PLAY_PAUSE', 0x91, 0x00, 'BUTTON_TOGGLE'),
      createMappingEntry('DECK_B_CUE', 0x91, 0x01, 'BUTTON_MOMENTARY'),
      createMappingEntry('DECK_B_SYNC', 0x91, 0x02, 'BUTTON_TOGGLE'),
      createMappingEntry('MIXER_CROSSFADER', 0xb0, 0x08, 'ABSOLUTE'),
    ],
    ledMappings: createDefaultDj2GoLeds(),
  },
  {
    id: 'profile-custom-learn',
    name: 'Custom MIDI Learn Profile',
    controllerModel: 'Generic USB MIDI Controller',
    author: 'DJ Brayan',
    version: '1.0.0',
    updatedAt: '2026-10-04',
    mappings: [],
    ledMappings: createDefaultDj2GoLeds(),
  },
];

/**
 * Converts a ControllerProfile into the requested portable JSON format:
 * {
 *   "controller": "Numark DJ2GO",
 *   "inputs": { "PLAY_A": "803B", "CUE_A": "8033", ... },
 *   "outputs": { "PLAY_A_LED": "903B", "CUE_A_LED": "9033", ... }
 * }
 */
export function serializeProfileToPortableJson(
  profile: ControllerProfile
): PortableControllerMappingJson {
  const inputs: Record<string, string> = {};
  for (const m of profile.mappings) {
    inputs[m.shortKey || m.actionId] = m.midiCode;
  }

  const outputs: Record<string, string> = {};
  for (const led of profile.ledMappings || []) {
    outputs[led.ledId] = led.midiCode;
  }

  return {
    controller: profile.controllerModel || profile.name,
    id: profile.id,
    name: profile.name,
    author: profile.author,
    version: profile.version,
    updatedAt: profile.updatedAt,
    inputs,
    outputs,
    mappings: profile.mappings,
    ledMappings: profile.ledMappings,
  };
}

/**
 * Parses either a PortableControllerMappingJson ({ controller, inputs, outputs })
 * or a full ControllerProfile JSON back into a valid ControllerProfile.
 */
export function parsePortableJsonToProfile(
  jsonText: string
): ControllerProfile | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') return null;

    // Case 1: Full mappings array already included
    if (Array.isArray(parsed.mappings) && parsed.mappings.length > 0 && parsed.mappings[0].actionId) {
      return {
        id: parsed.id || `profile-import-${Date.now()}`,
        name: parsed.name || parsed.controller || 'Imported Controller Profile',
        controllerModel: parsed.controllerModel || parsed.controller || 'USB MIDI Controller',
        author: parsed.author || 'DJ Brayan',
        version: parsed.version || '1.0.0',
        updatedAt: new Date().toISOString().slice(0, 10),
        mappings: parsed.mappings,
        ledMappings: Array.isArray(parsed.ledMappings)
          ? parsed.ledMappings
          : createDefaultDj2GoLeds(),
      };
    }

    // Case 2: Concise { controller, inputs, outputs } format
    if (parsed.inputs && typeof parsed.inputs === 'object') {
      const mappings: MidiMappingEntry[] = [];
      for (const [key, codeVal] of Object.entries(parsed.inputs)) {
        if (typeof codeVal !== 'string') continue;
        const decoded = parseMidiCodeHex(codeVal);
        if (!decoded) continue;

        const meta = DJB_BINDABLE_ACTIONS.find(
          (a) => a.shortKey === key || a.actionId === key
        );
        if (!meta) continue;

        mappings.push(
          createMappingEntry(meta.actionId, decoded.status, decoded.data1)
        );
      }

      const ledMappings = createDefaultDj2GoLeds();
      if (parsed.outputs && typeof parsed.outputs === 'object') {
        for (const [ledKey, codeVal] of Object.entries(parsed.outputs)) {
          if (typeof codeVal !== 'string') continue;
          const decoded = parseMidiCodeHex(codeVal);
          if (!decoded) continue;
          const idx = ledMappings.findIndex((l) => l.ledId === ledKey);
          if (idx !== -1) {
            ledMappings[idx] = {
              ...ledMappings[idx],
              status: decoded.status,
              channel: decoded.channel,
              data1: decoded.data1,
              midiCode: buildMidiCodeHex(decoded.status, decoded.data1),
            };
          }
        }
      }

      return {
        id: parsed.id || `profile-${Date.now()}`,
        name: parsed.name || `${parsed.controller || 'Custom'} Mapping`,
        controllerModel: parsed.controller || 'USB MIDI Controller',
        author: parsed.author || 'DJ Brayan',
        version: parsed.version || '1.0.0',
        updatedAt: new Date().toISOString().slice(0, 10),
        mappings,
        ledMappings,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function loadSavedProfilesFromStorage(): {
  profiles: ControllerProfile[];
  activeProfileId: string;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    const activeId =
      localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE_ID) ||
      INITIAL_CONTROLLER_PROFILES[0].id;
    if (!raw) {
      return {
        profiles: INITIAL_CONTROLLER_PROFILES,
        activeProfileId: activeId,
      };
    }
    const parsed = JSON.parse(raw) as ControllerProfile[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return {
        profiles: INITIAL_CONTROLLER_PROFILES,
        activeProfileId: INITIAL_CONTROLLER_PROFILES[0].id,
      };
    }
    // Ensure ledMappings exist on all loaded profiles
    const normalized = parsed.map((p) => ({
      ...p,
      ledMappings:
        Array.isArray(p.ledMappings) && p.ledMappings.length > 0
          ? p.ledMappings
          : createDefaultDj2GoLeds(),
    }));
    return {
      profiles: normalized,
      activeProfileId: activeId,
    };
  } catch {
    return {
      profiles: INITIAL_CONTROLLER_PROFILES,
      activeProfileId: INITIAL_CONTROLLER_PROFILES[0].id,
    };
  }
}

export function saveProfilesToStorage(
  profiles: ControllerProfile[],
  activeProfileId: string
): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE_ID, activeProfileId);
  } catch {
    // Ignore storage quota errors
  }
}
