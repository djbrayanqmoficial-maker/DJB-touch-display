/**
 * DJB Core — MIDI Engine Types
 * Modular architecture for Web MIDI API & Android USB MIDI:
 *
 * MIDI ENGINE
 * ├── MIDI Device Manager
 * ├── MIDI Input
 * ├── MIDI Output
 * ├── MIDI Mapping
 * ├── MIDI Learn
 * └── LED Feedback
 */

export enum MidiCommandType {
  NOTE_ON = 'NOTE_ON',
  NOTE_OFF = 'NOTE_OFF',
  CONTROL_CHANGE = 'CONTROL_CHANGE',
  PITCH_BEND = 'PITCH_BEND',
  UNKNOWN = 'UNKNOWN',
}

export type MidiControlMode =
  | 'BUTTON_TOGGLE'
  | 'BUTTON_MOMENTARY'
  | 'BUTTON_HOLD_200MS'
  | 'ABSOLUTE'
  | 'RELATIVE_2C'      // 1..63 = +step, 127..65 = -step (standard DJ jog/encoder)
  | 'RELATIVE_OFFSET'  // 65..127 = +step, 63..0 = -step
  | 'PITCH_BEND_14BIT';

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  direction: 'INPUT' | 'OUTPUT';
}

export interface MidiDeviceDescriptor {
  id: string;
  name: string;
  manufacturer: string;
  product: string;
  type: 'USB_MIDI' | 'VIRTUAL_BUS';
  connected: boolean;
  connectionStatus: 'OPEN' | 'CLOSED' | 'STANDBY';
  inputPortCount: number;
  outputPortCount: number;
  inputPorts: MidiPortInfo[];
  outputPorts: MidiPortInfo[];
}

export interface MidiPacket {
  id: string;
  timestamp: number;
  deviceId: string;
  deviceName: string;
  status: number;        // Raw status byte (e.g. 0x90, 0x80, 0xB0, 0xE0)
  statusHex: string;     // e.g. "B0" or "80"
  command: MidiCommandType;
  typeLabel: string;     // "NOTE ON", "NOTE OFF", "CONTROL CHANGE", "PITCH BEND"
  channel: number;       // 1 - 16
  data1: number;         // Note number or CC number (0 - 127)
  data1Hex: string;      // e.g. "19" or "3B"
  data2: number;         // Velocity or CC value (0 - 127)
  data2Hex: string;      // e.g. "7F" or "00"
  midiCode: string;      // 4-char hex code e.g. "803B", "903B", "B019"
  rawHex: string;        // Full 3-byte hex e.g. "B0 19 7F"
  relativeDelta?: number;// Signed delta if interpreted as relative encoder
}

export type DjbBindableActionId =
  // DECK A
  | 'DECK_A_PLAY_PAUSE'
  | 'DECK_A_CUE'
  | 'DECK_A_PFL'
  | 'DECK_A_SYNC'
  | 'DECK_A_LOAD'
  | 'DECK_A_VINYL_MODE'
  | 'DECK_A_JOG_WHEEL'
  | 'DECK_A_JOG_TOUCH'
  | 'DECK_A_PITCH_FADER'
  | 'DECK_A_PITCH_BEND_PLUS'
  | 'DECK_A_PITCH_BEND_MINUS'
  | 'DECK_A_VOLUME'
  | 'DECK_A_VOLUME_FILTER'
  | 'DECK_A_VOLUME_INC'
  | 'DECK_A_VOLUME_DEC'
  | 'DECK_A_GAIN'
  | 'DECK_A_EQ_HIGH'
  | 'DECK_A_EQ_MID'
  | 'DECK_A_EQ_LOW'
  | 'DECK_A_FILTER'
  | 'DECK_A_FX_ON'
  | 'DECK_A_FX_X'
  | 'DECK_A_FX_Y'
  | 'DECK_A_HOTCUE_1'
  | 'DECK_A_HOTCUE_2'
  | 'DECK_A_HOTCUE_3'
  | 'DECK_A_HOTCUE_4'
  | 'DECK_A_HOTCUE_5'
  | 'DECK_A_HOTCUE_6'
  | 'DECK_A_HOTCUE_7'
  | 'DECK_A_HOTCUE_8'
  | 'DECK_A_PAD_1'
  | 'DECK_A_PAD_2'
  | 'DECK_A_PAD_3'
  | 'DECK_A_PAD_4'
  | 'DECK_A_PAD_5'
  | 'DECK_A_PAD_6'
  | 'DECK_A_PAD_7'
  | 'DECK_A_PAD_8'
  | 'DECK_A_PAD_PAGE_1'
  | 'DECK_A_PAD_PAGE_2'
  | 'DECK_A_PAD_PAGE_3'
  | 'DECK_A_PAD_PAGE_4'
  | 'DECK_A_LOOP_IN'
  | 'DECK_A_LOOP_OUT'
  | 'DECK_A_LOOP_ACTIVE'
  // DECK B
  | 'DECK_B_PLAY_PAUSE'
  | 'DECK_B_CUE'
  | 'DECK_B_PFL'
  | 'DECK_B_SYNC'
  | 'DECK_B_LOAD'
  | 'DECK_B_VINYL_MODE'
  | 'DECK_B_JOG_WHEEL'
  | 'DECK_B_JOG_TOUCH'
  | 'DECK_B_PITCH_FADER'
  | 'DECK_B_PITCH_BEND_PLUS'
  | 'DECK_B_PITCH_BEND_MINUS'
  | 'DECK_B_VOLUME'
  | 'DECK_B_VOLUME_FILTER'
  | 'DECK_B_VOLUME_INC'
  | 'DECK_B_VOLUME_DEC'
  | 'DECK_B_GAIN'
  | 'DECK_B_EQ_HIGH'
  | 'DECK_B_EQ_MID'
  | 'DECK_B_EQ_LOW'
  | 'DECK_B_FILTER'
  | 'DECK_B_FX_ON'
  | 'DECK_B_FX_X'
  | 'DECK_B_FX_Y'
  | 'DECK_B_HOTCUE_1'
  | 'DECK_B_HOTCUE_2'
  | 'DECK_B_HOTCUE_3'
  | 'DECK_B_HOTCUE_4'
  | 'DECK_B_HOTCUE_5'
  | 'DECK_B_HOTCUE_6'
  | 'DECK_B_HOTCUE_7'
  | 'DECK_B_HOTCUE_8'
  | 'DECK_B_PAD_1'
  | 'DECK_B_PAD_2'
  | 'DECK_B_PAD_3'
  | 'DECK_B_PAD_4'
  | 'DECK_B_PAD_5'
  | 'DECK_B_PAD_6'
  | 'DECK_B_PAD_7'
  | 'DECK_B_PAD_8'
  | 'DECK_B_PAD_PAGE_1'
  | 'DECK_B_PAD_PAGE_2'
  | 'DECK_B_PAD_PAGE_3'
  | 'DECK_B_PAD_PAGE_4'
  | 'DECK_B_LOOP_IN'
  | 'DECK_B_LOOP_OUT'
  | 'DECK_B_LOOP_ACTIVE'
  // MIXER
  | 'MIXER_CROSSFADER'
  | 'MIXER_MASTER_GAIN'
  | 'MIXER_HEADPHONE_LEVEL'
  | 'MIXER_HEADPHONE_MIX'
  // LIBRARY / BROWSER
  | 'LIBRARY_SCROLL'
  | 'LIBRARY_BACK'
  | 'LIBRARY_ENTER'
  | 'LIBRARY_LOAD_DECK_A'
  | 'LIBRARY_LOAD_DECK_B';

export type DjbLedId =
  | 'PLAY_A_LED'
  | 'CUE_A_LED'
  | 'SYNC_A_LED'
  | 'PFL_A_LED'
  | 'VINYL_A_LED'
  | 'LOOP_A_LED'
  | 'FX_A_LED'
  | 'HOTCUE_1_A_LED'
  | 'HOTCUE_2_A_LED'
  | 'HOTCUE_3_A_LED'
  | 'HOTCUE_4_A_LED'
  | 'PLAY_B_LED'
  | 'CUE_B_LED'
  | 'SYNC_B_LED'
  | 'PFL_B_LED'
  | 'VINYL_B_LED'
  | 'LOOP_B_LED'
  | 'FX_B_LED'
  | 'HOTCUE_1_B_LED'
  | 'HOTCUE_2_B_LED'
  | 'HOTCUE_3_B_LED'
  | 'HOTCUE_4_B_LED';

export interface MidiMappingEntry {
  actionId: DjbBindableActionId;
  shortKey: string;         // e.g. "PLAY_A", "CUE_A", "JOG_A", "CROSSFADER"
  actionLabel: string;
  category: 'DECK_A' | 'DECK_B' | 'MIXER' | 'LIBRARY';
  command: MidiCommandType;
  status: number;           // e.g. 0x90, 0x80, 0xB0, 0xE0
  channel: number;          // 1 - 16
  data1: number;            // Note or CC number (0 - 127)
  midiCode: string;         // e.g. "803B", "903B", "B00A"
  controlMode: MidiControlMode;
  vdjReferenceNote?: string;// e.g. "holding 200ms ? vinyl_mode : load"
  ledFeedbackSupported: boolean;
  ledOnVelocity: number;    // Default 127 (0x7F)
  ledOffVelocity: number;   // Default 0 (0x00)
}

export interface LedMappingEntry {
  ledId: DjbLedId;
  label: string;
  linkedActionId: DjbBindableActionId;
  status: number;           // Default 0x90 (Note On) or 0xB0 (CC)
  channel: number;          // 1 - 16
  data1: number;            // LED Note/CC number (0 - 127)
  onVelocity: number;       // Data 2 for LED ON (default 127 / 0x7F)
  offVelocity: number;      // Data 2 for LED OFF (default 0 / 0x00)
  midiCode: string;         // e.g. "903B"
}

/**
 * Portable JSON Mapping Format requested by specification:
 * {
 *   "controller": "Numark DJ2GO",
 *   "inputs": { "PLAY_A": "803B", "CUE_A": "8033", "JOG_A": "B019" },
 *   "outputs": { "PLAY_A_LED": "903B", "CUE_A_LED": "9033" }
 * }
 */
export interface PortableControllerMappingJson {
  controller: string;
  id?: string;
  name?: string;
  author?: string;
  version?: string;
  updatedAt?: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  mappings?: MidiMappingEntry[];
  ledMappings?: LedMappingEntry[];
}

export interface ControllerProfile {
  id: string;
  name: string;
  controllerModel: string;
  author: string;
  version: string;
  updatedAt: string;
  mappings: MidiMappingEntry[];
  ledMappings: LedMappingEntry[];
}

export type LedVisualMode =
  | 'LED_ON'
  | 'LED_OFF'
  | 'LED_BLINK'
  | 'LED_ALTERNATING';

export interface LedFeedbackState {
  ledId: DjbLedId;
  label: string;
  actionId: DjbBindableActionId;
  status: number;
  channel: number;
  data1: number;
  midiCode: string;
  visualMode: LedVisualMode;
  active: boolean;
  lastSentStatus: number;
  lastSentVelocity: number;
}
