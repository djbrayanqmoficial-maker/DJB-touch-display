/**
 * MIDI ENGINE — MIDI Output Submodule
 * Sends raw 3-byte MIDI messages to connected Web MIDI Output ports
 * for controller LED feedback and experimental LED Learn testing.
 */

export class MidiOutputManager {
  /**
   * Sends a 3-byte MIDI message [status, data1, data2] to all active MIDI outputs
   * (or to a specific output port if targetDeviceId is specified).
   */
  public sendRawMessage(
    midiAccess: MIDIAccess | null,
    status: number,
    data1: number,
    data2: number,
    targetDeviceId?: string
  ): number {
    if (!midiAccess) return 0;

    const bytes: [number, number, number] = [
      status & 0xff,
      data1 & 0x7f,
      data2 & 0x7f,
    ];

    let sentCount = 0;
    midiAccess.outputs.forEach((output) => {
      if (targetDeviceId && output.id !== targetDeviceId) return;
      if (output.state === 'connected') {
        try {
          output.send(bytes);
          sentCount++;
        } catch {
          // Ignore transient USB port write errors
        }
      }
    });

    return sentCount;
  }

  /**
   * Helper for LED Learn: sends an explicit LED ON or LED OFF message.
   */
  public sendLedTest(
    midiAccess: MIDIAccess | null,
    status: number,
    data1: number,
    velocity: number
  ): number {
    return this.sendRawMessage(midiAccess, status, data1, velocity);
  }
}

export const midiOutputManager = new MidiOutputManager();
