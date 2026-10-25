/**
 * MIDI ENGINE — Professional LED Engine & Feedback Submodule
 *
 * Architecture:
 * SINGLE SOURCE OF TRUTH (DeckState A/B + BeatGrid Clock + Mixer + FX)
 *    ↓
 * LED ENGINE (LED_ON | LED_OFF | LED_BLINK | LED_ALTERNATING)
 *    ↓
 * HARDWARE MIDI OUTPUT (Diff-based, zero-flood, dual 0x90/0x80 OFF support)
 *
 * Implements:
 * - Default PFL Deck A ON at startup
 * - Slow, clearly visible progressive phase-drift blinking between CUE and PLAY/PAUSE
 *   when a track is loaded and PAUSED:
 *   - PLAY/PAUSE: 700 ms ON / 700 ms OFF (1400 ms period)
 *   - CUE:        600 ms ON / 600 ms OFF (1200 ms period)
 *   Creates a subtle, professional progressive phase-offset cycle (coinciding occasionally
 *   and progressively separating over an 8.4s cycle)
 * - Beat-Grid-locked SYNC LED:
 *   - When Deck is PAUSED: completely OFF (no blinking, no MIDI Sync pulses sent while paused)
 *   - When Deck is PLAYING: automatically toggles ON/OFF on every beat of the real Beat Grid
 *     at the current BPM, adapting immediately to tempo/BPM changes and turning OFF immediately on pause
 * - Immediate solid LED_ON when playing (PLAY LED) or holding CUE (CUE LED)
 * - Full LED_OFF when deck has no track loaded
 * - Full hardware LED reset/cleanup on disconnect, profile change, or app unload
 */

import { DeckState } from '../dj/DjEngine';
import { buildMidiCodeHex } from './MidiInput';
import { DJB_LED_DEFINITIONS } from './MidiMapping';
import { midiOutputManager } from './MidiOutput';
import {
  ControllerProfile,
  DjbLedId,
  LedFeedbackState,
  LedMappingEntry,
  LedVisualMode,
  MidiMappingEntry,
} from './MidiTypes';

export interface CanonicalLedStateInput {
  deckA: DeckState;
  deckB: DeckState;
  vinylModeA: boolean;
  vinylModeB: boolean;
  fxActiveA: boolean;
  fxActiveB: boolean;
  /**
   * PLAY/PAUSE slow pause-blink state: 700ms ON / 700ms OFF
   */
  playPauseBlinkOn: boolean;
  /**
   * CUE slow pause-blink state: 900ms ON / 900ms OFF
   */
  cuePauseBlinkOn: boolean;
  /**
   * Beat-Grid-driven SYNC LED state for Deck A (toggles on each beat ONLY while playing; false when paused)
   */
  syncBeatPulseA: boolean;
  /**
   * Beat-Grid-driven SYNC LED state for Deck B (toggles on each beat ONLY while playing; false when paused)
   */
  syncBeatPulseB: boolean;
}

export function buildLedMidiBytesFromEntry(
  led: LedMappingEntry,
  active: boolean
): [number, number, number] {
  const highNibble = led.status & 0xf0;
  // Standardize Note LED output to 0x90 (Note On) with velocity 0x7F (ON) or 0x00 (OFF),
  // while preserving 0xB0 if mapped to Control Change.
  const effectiveNibble = highNibble === 0xb0 ? 0xb0 : 0x90;
  const status = effectiveNibble | ((led.channel - 1) & 0x0f);
  const data1 = led.data1 & 0x7f;
  const data2 = active ? led.onVelocity & 0x7f : led.offVelocity & 0x7f;
  return [status, data1, data2];
}

export function buildLedMidiBytes(
  mapping: MidiMappingEntry,
  active: boolean
): [number, number, number] {
  const status = 0x90 | ((mapping.channel - 1) & 0x0f);
  const data1 = mapping.data1 & 0x7f;
  const data2 = active ? mapping.ledOnVelocity : mapping.ledOffVelocity;
  return [status, data1, data2];
}

/**
 * Evaluates the canonical LED mode and instantaneous ON/OFF state for a single deck's LEDs
 * directly from the Single Source of Truth (`DeckState` + BeatGrid clock + slow progressive phase timer).
 */
function evaluateDeckLeds(
  deck: DeckState,
  vinylMode: boolean,
  fxActive: boolean,
  playPauseBlinkOn: boolean,
  cuePauseBlinkOn: boolean,
  syncBeatPulse: boolean
): {
  play: { mode: LedVisualMode; active: boolean };
  cue: { mode: LedVisualMode; active: boolean };
  sync: { mode: LedVisualMode; active: boolean };
  pfl: { mode: LedVisualMode; active: boolean };
  vinyl: { mode: LedVisualMode; active: boolean };
  loop: { mode: LedVisualMode; active: boolean };
  fx: { mode: LedVisualMode; active: boolean };
  hotcues: Array<{ mode: LedVisualMode; active: boolean }>;
} {
  const hasTrack = Boolean(deck.trackId && deck.durationSec > 0);

  // PFL & Vinyl Mode reflect controller/mixer state even if deck is empty
  const pfl = {
    mode: (deck.pflHeadphoneCue ? 'LED_ON' : 'LED_OFF') as LedVisualMode,
    active: Boolean(deck.pflHeadphoneCue),
  };
  const vinyl = {
    mode: (vinylMode ? 'LED_ON' : 'LED_OFF') as LedVisualMode,
    active: Boolean(vinylMode),
  };
  const fx = {
    mode: (fxActive ? 'LED_ON' : 'LED_OFF') as LedVisualMode,
    active: Boolean(fxActive),
  };

  // State 1: SIN CANCIÓN -> Deck vacío
  if (!hasTrack) {
    return {
      play: { mode: 'LED_OFF', active: false },
      cue: { mode: 'LED_OFF', active: false },
      sync: { mode: 'LED_OFF', active: false },
      pfl,
      vinyl,
      loop: { mode: 'LED_OFF', active: false },
      fx,
      hotcues: [
        { mode: 'LED_OFF', active: false },
        { mode: 'LED_OFF', active: false },
        { mode: 'LED_OFF', active: false },
        { mode: 'LED_OFF', active: false },
      ],
    };
  }

  const loop = {
    mode: (deck.loop.active ? 'LED_ON' : 'LED_OFF') as LedVisualMode,
    active: Boolean(deck.loop.active),
  };
  const hotcues = [0, 1, 2, 3].map((idx) => {
    const isOn = Boolean(deck.hotCues[idx]?.active);
    return {
      mode: (isOn ? 'LED_ON' : 'LED_OFF') as LedVisualMode,
      active: isOn,
    };
  });

  // State 2: CUE ACTIVADO (Previewing / Holding CUE)
  if (deck.isCueing) {
    return {
      play: { mode: 'LED_OFF', active: false },
      cue: { mode: 'LED_ON', active: true },
      sync: { mode: 'LED_OFF', active: false },
      pfl,
      vinyl,
      loop,
      fx,
      hotcues,
    };
  }

  // State 3: REPRODUCIENDO ->
  // - Detener parpadeo de pausa: PLAY encendido fijo, CUE apagado
  // - LED SYNC comienza automáticamente a encenderse y apagarse con cada beat del Beat Grid real
  if (deck.isPlaying) {
    return {
      play: { mode: 'LED_ON', active: true },
      cue: { mode: 'LED_OFF', active: false },
      sync: {
        mode: 'LED_BLINK',
        active: Boolean(syncBeatPulse),
      },
      pfl,
      vinyl,
      loop,
      fx,
      hotcues,
    };
  }

  // State 4: CANCIÓN CARGADA + PAUSA ->
  // - PLAY/PAUSE y CUE en desfase progresivo lento y claramente visible (700ms vs 900ms)
  // - LED SYNC completamente APAGADO en pausa (no parpadea ni envía pulsos MIDI)
  return {
    play: { mode: 'LED_ALTERNATING', active: playPauseBlinkOn },
    cue: { mode: 'LED_ALTERNATING', active: cuePauseBlinkOn },
    sync: { mode: 'LED_OFF', active: false },
    pfl,
    vinyl,
    loop,
    fx,
    hotcues,
  };
}

/**
 * Computes the complete LED Feedback table from the canonical Single Source of Truth.
 */
export function computeCanonicalLedFeedbackStates(
  profile: ControllerProfile,
  input: CanonicalLedStateInput
): LedFeedbackState[] {
  const ledsA = evaluateDeckLeds(
    input.deckA,
    input.vinylModeA,
    input.fxActiveA,
    input.playPauseBlinkOn,
    input.cuePauseBlinkOn,
    input.syncBeatPulseA
  );
  const ledsB = evaluateDeckLeds(
    input.deckB,
    input.vinylModeB,
    input.fxActiveB,
    input.playPauseBlinkOn,
    input.cuePauseBlinkOn,
    input.syncBeatPulseB
  );

  const stateById: Record<DjbLedId, { mode: LedVisualMode; active: boolean }> = {
    PLAY_A_LED: ledsA.play,
    CUE_A_LED: ledsA.cue,
    SYNC_A_LED: ledsA.sync,
    PFL_A_LED: ledsA.pfl,
    VINYL_A_LED: ledsA.vinyl,
    LOOP_A_LED: ledsA.loop,
    FX_A_LED: ledsA.fx,
    HOTCUE_1_A_LED: ledsA.hotcues[0],
    HOTCUE_2_A_LED: ledsA.hotcues[1],
    HOTCUE_3_A_LED: ledsA.hotcues[2],
    HOTCUE_4_A_LED: ledsA.hotcues[3],
    PLAY_B_LED: ledsB.play,
    CUE_B_LED: ledsB.cue,
    SYNC_B_LED: ledsB.sync,
    PFL_B_LED: ledsB.pfl,
    VINYL_B_LED: ledsB.vinyl,
    LOOP_B_LED: ledsB.loop,
    FX_B_LED: ledsB.fx,
    HOTCUE_1_B_LED: ledsB.hotcues[0],
    HOTCUE_2_B_LED: ledsB.hotcues[1],
    HOTCUE_3_B_LED: ledsB.hotcues[2],
    HOTCUE_4_B_LED: ledsB.hotcues[3],
  };

  const ledMappings: LedMappingEntry[] =
    profile.ledMappings && profile.ledMappings.length > 0
      ? profile.ledMappings
      : DJB_LED_DEFINITIONS.map((def) => ({
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

  return ledMappings.map((led) => {
    const resolved = stateById[led.ledId] || {
      mode: 'LED_OFF' as LedVisualMode,
      active: false,
    };
    const [status, data1, velocity] = buildLedMidiBytesFromEntry(
      led,
      resolved.active
    );
    return {
      ledId: led.ledId,
      label: led.label,
      actionId: led.linkedActionId,
      status: led.status,
      channel: led.channel,
      data1,
      midiCode: led.midiCode || buildMidiCodeHex(led.status, data1),
      visualMode: resolved.mode,
      active: resolved.active,
      lastSentStatus: status,
      lastSentVelocity: velocity,
    };
  });
}

/**
 * Legacy helper maintained for compatibility.
 */
export function computeLedFeedbackStates(
  profile: ControllerProfile,
  activeStatesById: Record<string, boolean>
): LedFeedbackState[] {
  const ledMappings: LedMappingEntry[] =
    profile.ledMappings && profile.ledMappings.length > 0
      ? profile.ledMappings
      : DJB_LED_DEFINITIONS.map((def) => ({
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

  return ledMappings.map((led) => {
    const isActive = Boolean(
      activeStatesById[led.ledId] ?? activeStatesById[led.linkedActionId]
    );
    const [status, data1, velocity] = buildLedMidiBytesFromEntry(led, isActive);
    return {
      ledId: led.ledId,
      label: led.label,
      actionId: led.linkedActionId,
      status: led.status,
      channel: led.channel,
      data1,
      midiCode: led.midiCode || buildMidiCodeHex(led.status, data1),
      visualMode: isActive ? 'LED_ON' : 'LED_OFF',
      active: isActive,
      lastSentStatus: status,
      lastSentVelocity: velocity,
    };
  });
}

/**
 * Sends a single LED state to hardware MIDI outputs, ensuring both Note On (vel 0)
 * and Note Off (0x80, vel 0) are sent when turning off a Note LED for 100% compatibility
 * with Numark DJ2GO and other controllers.
 */
export function sendHardwareLedState(
  midiAccess: MIDIAccess | null,
  led: LedFeedbackState
): void {
  if (!midiAccess) return;
  midiOutputManager.sendRawMessage(
    midiAccess,
    led.lastSentStatus,
    led.data1,
    led.lastSentVelocity
  );
  // If turning OFF a Note-based LED, also send 0x80 Note Off for controllers that require 0x80
  if (!led.active && (led.lastSentStatus & 0xf0) === 0x90) {
    const noteOffStatus = 0x80 | (led.lastSentStatus & 0x0f);
    midiOutputManager.sendRawMessage(midiAccess, noteOffStatus, led.data1, 0x00);
  }
}

/**
 * Turns OFF all mapped LEDs on the controller (used on app close, controller disconnect,
 * or profile reset to prevent frozen/stuck LEDs on the Numark DJ2GO).
 */
export function resetAllControllerLeds(
  midiAccess: MIDIAccess | null,
  profile: ControllerProfile
): void {
  if (!midiAccess) return;
  const ledMappings = profile.ledMappings || [];
  for (const led of ledMappings) {
    const chNibble = (led.channel - 1) & 0x0f;
    const data1 = led.data1 & 0x7f;
    const offVel = (led.offVelocity ?? 0) & 0x7f;
    midiOutputManager.sendRawMessage(midiAccess, 0x90 | chNibble, data1, offVel);
    midiOutputManager.sendRawMessage(midiAccess, 0x80 | chNibble, data1, 0x00);
  }
}
