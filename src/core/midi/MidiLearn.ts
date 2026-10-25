/**
 * MIDI ENGINE — MIDI Learn & LED Learn Submodule
 * Implements the 2-step MIDI Learn workflow:
 * 1. Select function -> Press [LEARN]
 * 2. Press physical button or move fader/knob/jog on controller ->
 *    Detects STATUS, DATA 1, DATA 2, CHANNEL and shows MIDI CODE (e.g. 803B)
 * 3. Press [ASSIGN] -> Saves mapping to active ControllerProfile.
 */

import { buildMidiCodeHex } from './MidiInput';
import { DJB_BINDABLE_ACTIONS } from './MidiMapping';
import {
  DjbBindableActionId,
  MidiCommandType,
  MidiControlMode,
  MidiMappingEntry,
  MidiPacket,
} from './MidiTypes';

export interface MidiLearnCandidate {
  actionId: DjbBindableActionId;
  packet: MidiPacket;
  detectedMode: MidiControlMode;
}

export function inferControlModeForLearnedPacket(
  actionId: DjbBindableActionId,
  packet: MidiPacket
): MidiControlMode {
  const meta = DJB_BINDABLE_ACTIONS.find((a) => a.actionId === actionId);
  if (packet.command === MidiCommandType.PITCH_BEND) {
    return 'PITCH_BEND_14BIT';
  }
  if (meta) {
    if (meta.defaultMode === 'BUTTON_HOLD_200MS') return 'BUTTON_HOLD_200MS';
    if (meta.defaultMode === 'RELATIVE_2C') return 'RELATIVE_2C';
    if (
      packet.command === MidiCommandType.NOTE_ON ||
      packet.command === MidiCommandType.NOTE_OFF
    ) {
      return meta.defaultMode.startsWith('BUTTON')
        ? meta.defaultMode
        : 'BUTTON_TOGGLE';
    }
    if (packet.command === MidiCommandType.CONTROL_CHANGE) {
      return meta.defaultMode === 'RELATIVE_OFFSET'
        ? 'RELATIVE_OFFSET'
        : 'ABSOLUTE';
    }
  }
  return packet.command === MidiCommandType.CONTROL_CHANGE
    ? 'ABSOLUTE'
    : 'BUTTON_TOGGLE';
}

export function createLearnedMappingEntry(
  actionId: DjbBindableActionId,
  packet: MidiPacket,
  overrideMode?: MidiControlMode
): MidiMappingEntry {
  const meta = DJB_BINDABLE_ACTIONS.find((a) => a.actionId === actionId)!;
  const controlMode =
    overrideMode ?? inferControlModeForLearnedPacket(actionId, packet);

  return {
    actionId,
    shortKey: meta.shortKey,
    actionLabel: meta.label,
    category: meta.category,
    command: packet.command,
    status: packet.status,
    channel: packet.channel,
    data1: packet.data1,
    midiCode: buildMidiCodeHex(packet.status, packet.data1),
    controlMode,
    vdjReferenceNote: meta.vdjReferenceNote,
    ledFeedbackSupported: meta.ledSupported,
    ledOnVelocity: 127,
    ledOffVelocity: 0,
  };
}
