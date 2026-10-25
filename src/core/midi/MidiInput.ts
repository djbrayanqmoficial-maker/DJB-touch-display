/**
 * MIDI ENGINE — MIDI Input Submodule
 * Decodes raw MIDI 1.0 packets (Note On, Note Off, Control Change, Pitch Bend),
 * computes hex codes (e.g. 803B, B019), distinguishes absolute vs relative continuous encoders,
 * and manages 200ms hold detection for dual-function buttons (e.g. DJ2GO LOAD / Vinyl Mode).
 */

import {
  MidiCommandType,
  MidiControlMode,
  MidiPacket,
} from './MidiTypes';

export function toHexByte(val: number): string {
  return (val & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

export function formatMidiStatusHex(status: number): string {
  return toHexByte(status);
}

export function buildMidiCodeHex(status: number, data1: number): string {
  return `${toHexByte(status)}${toHexByte(data1)}`;
}

export function parseMidiCodeHex(midiCode: string): {
  status: number;
  channel: number;
  command: MidiCommandType;
  data1: number;
} | null {
  const cleaned = midiCode.trim().replace(/^0x/i, '').replace(/\s+/g, '').toUpperCase();
  if (!/^[0-9A-F]{4}$/.test(cleaned)) return null;
  const status = parseInt(cleaned.slice(0, 2), 16);
  const data1 = parseInt(cleaned.slice(2, 4), 16) & 0x7f;
  const highNibble = status & 0xf0;
  const channel = (status & 0x0f) + 1;

  let command = MidiCommandType.NOTE_ON;
  if (highNibble === 0x90) command = MidiCommandType.NOTE_ON;
  else if (highNibble === 0x80) command = MidiCommandType.NOTE_OFF;
  else if (highNibble === 0xb0) command = MidiCommandType.CONTROL_CHANGE;
  else if (highNibble === 0xe0) command = MidiCommandType.PITCH_BEND;

  return { status, channel, command, data1 };
}

/**
 * Decodes raw 3-byte MIDI message according to MIDI 1.0 specification.
 * Note On (0x90) with velocity 0 is treated as Note Off per MIDI standard,
 * while preserving the raw status byte for accurate hex code display (e.g. 803B / 903B).
 */
export function parseRawMidiBytes(
  statusByte: number,
  data1Byte: number,
  data2Byte: number,
  deviceId: string,
  deviceName: string
): MidiPacket {
  const status = statusByte & 0xff;
  const highNibble = status & 0xf0;
  const channel = (status & 0x0f) + 1; // 1 - 16
  const data1 = data1Byte & 0x7f;
  const data2 = data2Byte & 0x7f;

  let command = MidiCommandType.UNKNOWN;
  let typeLabel = 'UNKNOWN';

  if (highNibble === 0x90) {
    command = data2 === 0 ? MidiCommandType.NOTE_OFF : MidiCommandType.NOTE_ON;
    typeLabel = data2 === 0 ? 'NOTE OFF' : 'NOTE ON';
  } else if (highNibble === 0x80) {
    command = MidiCommandType.NOTE_OFF;
    typeLabel = 'NOTE OFF';
  } else if (highNibble === 0xb0) {
    command = MidiCommandType.CONTROL_CHANGE;
    typeLabel = 'CONTROL CHANGE';
  } else if (highNibble === 0xe0) {
    command = MidiCommandType.PITCH_BEND;
    typeLabel = 'PITCH BEND';
  }

  const statusHex = toHexByte(status);
  const data1Hex = toHexByte(data1);
  const data2Hex = toHexByte(data2);
  const midiCode = `${statusHex}${data1Hex}`;
  const rawHex = `${statusHex} ${data1Hex} ${data2Hex}`;

  // Relative 2's complement delta for encoders/jogwheels (1..63 = +1..+63, 127..65 = -1..-63)
  let relativeDelta = 0;
  if (command === MidiCommandType.CONTROL_CHANGE) {
    if (data2 >= 1 && data2 <= 63) {
      relativeDelta = data2;
    } else if (data2 >= 65 && data2 <= 127) {
      relativeDelta = data2 - 128;
    }
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    deviceId,
    deviceName,
    status,
    statusHex,
    command,
    typeLabel,
    channel,
    data1,
    data1Hex,
    data2,
    data2Hex,
    midiCode,
    rawHex,
    relativeDelta,
  };
}

/**
 * Decodes either an absolute normalized value [0..1] or a relative signed step
 * from a MIDI packet based on the configured MidiControlMode.
 */
export function decodeContinuousControl(
  packet: MidiPacket,
  mode: MidiControlMode
): { kind: 'ABSOLUTE'; normalized: number } | { kind: 'RELATIVE'; delta: number } {
  if (packet.command === MidiCommandType.PITCH_BEND || mode === 'PITCH_BEND_14BIT') {
    const val14 = ((packet.data2 & 0x7f) << 7) | (packet.data1 & 0x7f);
    return {
      kind: 'ABSOLUTE',
      normalized: Math.max(0, Math.min(1, val14 / 16383)),
    };
  }

  if (mode === 'RELATIVE_2C') {
    const d = packet.data2;
    const delta = d < 64 ? d : d - 128;
    return { kind: 'RELATIVE', delta };
  }

  if (mode === 'RELATIVE_OFFSET') {
    const delta = packet.data2 - 64;
    return { kind: 'RELATIVE', delta };
  }

  return {
    kind: 'ABSOLUTE',
    normalized: Math.max(0, Math.min(1, packet.data2 / 127)),
  };
}

/**
 * Tracks button hold duration (e.g. VirtualDJ reference for DJ2GO:
 * `LOAD -> holding 200ms ? vinyl_mode : load`).
 */
export class MidiHoldTracker {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private holdTriggered = new Set<string>();

  public handleButtonEvent(
    key: string,
    isPressed: boolean,
    holdThresholdMs: number,
    onTap: () => void,
    onHold: () => void
  ): void {
    if (isPressed) {
      this.clearTimer(key);
      this.holdTriggered.delete(key);
      const timer = setTimeout(() => {
        this.holdTriggered.add(key);
        this.timers.delete(key);
        onHold();
      }, holdThresholdMs);
      this.timers.set(key, timer);
    } else {
      const hadTimer = this.timers.has(key);
      this.clearTimer(key);
      if (hadTimer && !this.holdTriggered.has(key)) {
        onTap();
      }
      this.holdTriggered.delete(key);
    }
  }

  private clearTimer(key: string): void {
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(key);
    }
  }

  public clearAll(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.holdTriggered.clear();
  }
}
