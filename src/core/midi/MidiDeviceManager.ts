/**
 * MIDI ENGINE — MIDI Device Manager Submodule
 * Detects Web MIDI API availability, enumerates input & output ports,
 * groups ports by physical controller, and listens for hot-plug USB OTG events.
 */

import { MidiDeviceDescriptor, MidiPortInfo } from './MidiTypes';

export interface MidiDeviceScanResult {
  webMidiSupported: boolean;
  errorMessage: string | null;
  midiAccess: MIDIAccess | null;
  devices: MidiDeviceDescriptor[];
}

export function isWebMidiApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export function buildDeviceDescriptorsFromAccess(
  access: MIDIAccess,
  disabledDeviceIds: Set<string> = new Set()
): MidiDeviceDescriptor[] {
  const inputPorts: MidiPortInfo[] = [];
  const outputPorts: MidiPortInfo[] = [];

  access.inputs.forEach((input) => {
    inputPorts.push({
      id: input.id,
      name: input.name || 'USB MIDI Input',
      manufacturer: input.manufacturer || 'USB MIDI',
      state: input.state === 'connected' ? 'connected' : 'disconnected',
      connection: input.connection,
      direction: 'INPUT',
    });
  });

  access.outputs.forEach((output) => {
    outputPorts.push({
      id: output.id,
      name: output.name || 'USB MIDI Output',
      manufacturer: output.manufacturer || 'USB MIDI',
      state: output.state === 'connected' ? 'connected' : 'disconnected',
      connection: output.connection,
      direction: 'OUTPUT',
    });
  });

  // Group ports by controller name so IN & OUT ports of e.g. Numark DJ2GO appear together
  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      manufacturer: string;
      inputs: MidiPortInfo[];
      outputs: MidiPortInfo[];
    }
  >();

  for (const inp of inputPorts) {
    const key = inp.name.trim() || inp.id;
    const existing = grouped.get(key);
    if (existing) {
      existing.inputs.push(inp);
    } else {
      grouped.set(key, {
        id: inp.id,
        name: inp.name,
        manufacturer: inp.manufacturer,
        inputs: [inp],
        outputs: [],
      });
    }
  }

  for (const out of outputPorts) {
    const key = out.name.trim() || out.id;
    const existing = grouped.get(key);
    if (existing) {
      existing.outputs.push(out);
    } else {
      grouped.set(key, {
        id: out.id,
        name: out.name,
        manufacturer: out.manufacturer,
        inputs: [],
        outputs: [out],
      });
    }
  }

  const descriptors: MidiDeviceDescriptor[] = [];

  grouped.forEach((group) => {
    const isPhysicallyConnected =
      group.inputs.some((i) => i.state === 'connected') ||
      group.outputs.some((o) => o.state === 'connected');
    const isUserConnected = !disabledDeviceIds.has(group.id);
    const connected = isPhysicallyConnected && isUserConnected;

    descriptors.push({
      id: group.id,
      name: group.name,
      manufacturer: group.manufacturer || 'USB MIDI',
      product: group.name,
      type: 'USB_MIDI',
      connected,
      connectionStatus: connected ? 'OPEN' : 'CLOSED',
      inputPortCount: group.inputs.length,
      outputPortCount: group.outputs.length,
      inputPorts: group.inputs,
      outputPorts: group.outputs,
    });
  });

  return descriptors;
}
