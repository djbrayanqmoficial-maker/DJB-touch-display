import React, { useEffect, useRef, useState } from 'react';
import {
  ControllerProfile,
  DjbBindableActionId,
  DjbLedId,
  LedFeedbackState,
  LedMappingEntry,
  MidiCommandType,
  MidiControlMode,
  MidiDeviceDescriptor,
  MidiMappingEntry,
  MidiPacket,
} from '../core/midi/MidiTypes';
import {
  buildMidiCodeHex,
  DJB_BINDABLE_ACTIONS,
  DJB_LED_DEFINITIONS,
  inferControlModeForLearnedPacket,
  parseMidiCodeHex,
  serializeProfileToPortableJson,
  toHexByte,
} from '../core/midi/MidiEngine';
import {
  AudioEngineConfig,
  AVAILABLE_AUDIO_DEVICES,
} from '../core/audio/AudioEngine';
import { MusicFolderConfig } from '../core/library/LibraryEngine';
import { AnalysisConfig } from '../core/analyzer/AnalyzerEngine';
import { OperatingMode, MixerState } from '../core/dj/DjEngine';
import { VirtualDjBridgeConfig } from '../core/virtualdj/VirtualDjBridge';

type SettingsCategory = 'CONTROLLER' | 'AUDIO' | 'LIBRARY' | 'SYSTEM';
type ControllerSubTab =
  | 'MIDI_DEVICES'
  | 'MIDI_LEARN'
  | 'MAPPING_EDITOR'
  | 'LED_LEARN'
  | 'CONTROLLER_PROFILES';

interface SettingsViewProps {
  operatingMode: OperatingMode;
  onChangeOperatingMode: (mode: OperatingMode) => void;
  onCloseSettings: () => void;
  // MIDI Engine Props
  midiDevices: MidiDeviceDescriptor[];
  midiPackets: MidiPacket[];
  activeProfile: ControllerProfile;
  profiles: ControllerProfile[];
  midiLearnActionId: DjbBindableActionId | null;
  midiLearnCandidatePacket: MidiPacket | null;
  ledStates: LedFeedbackState[];
  webMidiSupported: boolean;
  webMidiErrorMessage: string | null;
  onScanMidiDevices: () => void;
  onToggleConnectMidiDevice: (deviceId: string) => void;
  onClearMidiPackets: () => void;
  onSimulateIncomingMidi: (status: number, data1: number, data2: number) => void;
  onSendRawMidiOut: (status: number, data1: number, data2: number) => void;
  onStartMidiLearn: (actionId: DjbBindableActionId | null) => void;
  onAssignLearnedMapping: (
    actionId: DjbBindableActionId,
    packet: MidiPacket,
    controlMode: MidiControlMode
  ) => void;
  onUpdateMappingEntry: (
    actionId: DjbBindableActionId,
    midiCodeHex: string,
    controlMode: MidiControlMode
  ) => boolean;
  onRemoveMapping: (actionId: DjbBindableActionId) => void;
  onUpdateLedMappingEntry: (
    ledId: DjbLedId,
    status: number,
    channel: number,
    data1: number,
    onVelocity: number,
    offVelocity: number
  ) => void;
  onSelectProfile: (profileId: string) => void;
  onCreateNewProfile: (name: string, model: string) => void;
  onImportProfileJson: (jsonText: string) => boolean;
  onRestoreDefaultProfiles: () => void;
  // Audio Engine Props
  audioConfig: AudioEngineConfig;
  onUpdateAudioConfig: (patch: Partial<AudioEngineConfig>) => void;
  mixer: MixerState;
  onUpdateMixer: (patch: Partial<MixerState>) => void;
  // Library & Analyzer Props
  folders: MusicFolderConfig[];
  onAddMusicFolder: (path: string, storageType: MusicFolderConfig['storageType']) => void;
  onToggleFolderAutoScan: (id: string) => void;
  analysisConfig: AnalysisConfig;
  onUpdateAnalysisConfig: (patch: Partial<AnalysisConfig>) => void;
  // System / VirtualDJ Bridge Props
  vdjConfig: VirtualDjBridgeConfig;
  onUpdateVdjConfig: (patch: Partial<VirtualDjBridgeConfig>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  operatingMode,
  onChangeOperatingMode,
  onCloseSettings,
  midiDevices,
  midiPackets,
  activeProfile,
  profiles,
  midiLearnActionId,
  midiLearnCandidatePacket,
  ledStates,
  webMidiSupported,
  webMidiErrorMessage,
  onScanMidiDevices,
  onToggleConnectMidiDevice,
  onClearMidiPackets,
  onSimulateIncomingMidi,
  onSendRawMidiOut,
  onStartMidiLearn,
  onAssignLearnedMapping,
  onUpdateMappingEntry,
  onRemoveMapping,
  onUpdateLedMappingEntry,
  onSelectProfile,
  onCreateNewProfile,
  onImportProfileJson,
  onRestoreDefaultProfiles,
  audioConfig,
  onUpdateAudioConfig,
  mixer,
  onUpdateMixer,
  folders,
  onAddMusicFolder,
  onToggleFolderAutoScan,
  analysisConfig,
  onUpdateAnalysisConfig,
  vdjConfig,
  onUpdateVdjConfig,
}) => {
  const [category, setCategory] = useState<SettingsCategory>('CONTROLLER');
  const [controllerTab, setControllerTab] = useState<ControllerSubTab>('MIDI_DEVICES');

  // MIDI Learn Inspector State
  const [learnFilterCategory, setLearnFilterCategory] = useState<
    'ALL' | 'DECK_A' | 'DECK_B' | 'MIXER' | 'LIBRARY'
  >('ALL');
  const [selectedLearnMode, setSelectedLearnMode] =
    useState<MidiControlMode>('BUTTON_TOGGLE');
  const [autoAssignOnLearn, setAutoAssignOnLearn] = useState(false);

  // Sync control mode when candidate packet arrives
  useEffect(() => {
    if (midiLearnActionId && midiLearnCandidatePacket) {
      const inferred = inferControlModeForLearnedPacket(
        midiLearnActionId,
        midiLearnCandidatePacket
      );
      setSelectedLearnMode(inferred);
    } else if (midiLearnActionId) {
      const meta = DJB_BINDABLE_ACTIONS.find(
        (a) => a.actionId === midiLearnActionId
      );
      if (meta) setSelectedLearnMode(meta.defaultMode);
    }
  }, [midiLearnActionId, midiLearnCandidatePacket]);

  // Mapping Editor Inline State
  const [editingActionId, setEditingActionId] =
    useState<DjbBindableActionId | null>(null);
  const [editingHexCode, setEditingHexCode] = useState('');
  const [editingMode, setEditingMode] =
    useState<MidiControlMode>('BUTTON_TOGGLE');
  const [newMappingActionId, setNewMappingActionId] =
    useState<DjbBindableActionId>('DECK_A_PLAY_PAUSE');
  const [newMappingHexCode, setNewMappingHexCode] = useState('803B');

  // LED Learn Tool State
  const [selectedLedId, setSelectedLedId] = useState<DjbLedId>('PLAY_A_LED');
  const [ledStatusNibble, setLedStatusNibble] = useState<number>(0x90);
  const [ledChannel, setLedChannel] = useState<number>(1);
  const [ledData1, setLedData1] = useState<number>(0x3b);
  const [ledData2, setLedData2] = useState<number>(0x7f);
  const [ledOnVel, setLedOnVel] = useState<number>(127);
  const [ledOffVel, setLedOffVel] = useState<number>(0);
  const [ledSavedMsg, setLedSavedMsg] = useState<string | null>(null);

  // Sync LED Learn fields when user selects a different LED
  useEffect(() => {
    const existingLed: LedMappingEntry | undefined =
      activeProfile.ledMappings?.find((l) => l.ledId === selectedLedId);
    const def = DJB_LED_DEFINITIONS.find((d) => d.ledId === selectedLedId);
    if (existingLed) {
      setLedStatusNibble(existingLed.status & 0xf0);
      setLedChannel(existingLed.channel);
      setLedData1(existingLed.data1);
      setLedData2(existingLed.onVelocity);
      setLedOnVel(existingLed.onVelocity);
      setLedOffVel(existingLed.offVelocity);
    } else if (def) {
      setLedStatusNibble(def.defaultStatus & 0xf0);
      setLedChannel(def.defaultChannel);
      setLedData1(def.defaultData1);
      setLedData2(127);
      setLedOnVel(127);
      setLedOffVel(0);
    }
  }, [selectedLedId, activeProfile.ledMappings]);

  // Custom Packet Tester State
  const [txChannel, setTxChannel] = useState<number>(1);
  const [txType, setTxType] = useState<'NOTE_ON' | 'NOTE_OFF' | 'CC'>('NOTE_ON');
  const [txData1, setTxData1] = useState<number>(59);
  const [txData2, setTxData2] = useState<number>(127);

  // Profile & JSON State
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileModel, setNewProfileModel] = useState('Numark DJ2GO');
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const [newFolderPath, setNewFolderPath] = useState(
    '/storage/emulated/0/Music/New_DJ_Crate'
  );

  const lastPacket = midiPackets[0] || null;

  const triggerCustomPacket = (direction: 'INCOMING_SIM' | 'OUTGOING_TX') => {
    const highNibble =
      txType === 'NOTE_ON' ? 0x90 : txType === 'NOTE_OFF' ? 0x80 : 0xb0;
    const statusByte = highNibble | ((txChannel - 1) & 0x0f);
    if (direction === 'INCOMING_SIM') {
      onSimulateIncomingMidi(statusByte, txData1, txData2);
    } else {
      onSendRawMidiOut(statusByte, txData1, txData2);
    }
  };

  const portableJsonString = JSON.stringify(
    serializeProfileToPortableJson(activeProfile),
    null,
    2
  );

  const handleExportCopy = () => {
    navigator.clipboard?.writeText(portableJsonString);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  const handleDownloadJsonFile = () => {
    const blob = new Blob([portableJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProfile.controllerModel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-mapping.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setImportJsonText(text);
      const ok = onImportProfileJson(text);
      setImportStatusMsg(
        ok
          ? `Mapping "${file.name}" cargado y activado correctamente.`
          : 'Formato JSON inválido.'
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getShortCommandType = (cmd: MidiCommandType) => {
    if (cmd === MidiCommandType.NOTE_ON || cmd === MidiCommandType.NOTE_OFF)
      return 'NOTE';
    if (cmd === MidiCommandType.CONTROL_CHANGE) return 'CC';
    if (cmd === MidiCommandType.PITCH_BEND) return 'PITCH BEND';
    return 'MIDI';
  };

  const filteredBindableActions = DJB_BINDABLE_ACTIONS.filter(
    (a) => learnFilterCategory === 'ALL' || a.category === learnFilterCategory
  );

  const currentLearningMeta = midiLearnActionId
    ? DJB_BINDABLE_ACTIONS.find((a) => a.actionId === midiLearnActionId)
    : null;

  const computedLedStatusByte =
    (ledStatusNibble & 0xf0) | ((ledChannel - 1) & 0x0f);
  const computedLedCodeHex = buildMidiCodeHex(computedLedStatusByte, ledData1);

  return (
    <div className="flex flex-col h-full bg-[#181A1F] text-[#F3F4F6] select-none overflow-hidden">
      {/* Top Bar */}
      <div className="h-12 shrink-0 bg-[#121417] border-b border-[#2C3038] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCloseSettings}
            className="h-8 px-3 rounded bg-[#2B2F37] hover:bg-[#383D47] text-xs font-medium text-[#F3F4F6] flex items-center gap-1.5 transition"
          >
            <span>←</span>
            <span>Back to Decks</span>
          </button>
          <span className="text-sm font-semibold text-[#F3F4F6]">
            SETTINGS & HARDWARE CONFIGURATION
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-[#9CA3AF]">
          <span>
            MODE:{' '}
            <strong className="text-[#F3F4F6]">
              {operatingMode === OperatingMode.VIRTUALDJ
                ? 'VIRTUALDJ MODE'
                : 'STANDALONE MODE'}
            </strong>
          </span>
          <span>·</span>
          <span>
            CONTROLLER:{' '}
            <strong className="text-[#0099DB]">{activeProfile.name}</strong>
          </span>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-12 gap-4 p-4 flex-1 overflow-hidden">
        {/* Left Category Rail */}
        <aside className="col-span-3 bg-[#1E2127] border border-[#2C3038] rounded-md p-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            {(
              [
                {
                  id: 'CONTROLLER',
                  title: 'CONTROLLER',
                  sub: 'Devices · MIDI Learn · Editor · LED Learn',
                },
                {
                  id: 'AUDIO',
                  title: 'AUDIO',
                  sub: 'Audio Device · Master · Headphones · Latency',
                },
                {
                  id: 'LIBRARY',
                  title: 'LIBRARY',
                  sub: 'Music Folders · Storage · Analysis',
                },
                {
                  id: 'SYSTEM',
                  title: 'SYSTEM',
                  sub: 'Standalone · VirtualDJ · About',
                },
              ] as const
            ).map((item) => {
              const active = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded border transition ${
                    active
                      ? 'bg-[#2C313A] border-[#0099DB] text-[#F3F4F6]'
                      : 'bg-[#15171C] border-[#262930] text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  <div className="text-xs font-semibold tracking-wide text-[#F3F4F6]">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">
                    {item.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live MIDI Telemetry Box (Always visible in left sidebar) */}
          <div className="bg-[#121417] border border-[#2C3038] rounded p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#D1D5DB]">
                MIDI MONITOR
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[#0099DB]">
                  {lastPacket ? lastPacket.typeLabel : 'STANDBY'}
                </span>
                {midiPackets.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearMidiPackets}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#23272E] text-[#9CA3AF] hover:text-white"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center font-mono tabular-nums">
              <div className="bg-[#1A1D22] border border-[#262A32] rounded p-1">
                <div className="text-[8px] text-[#9CA3AF]">STATUS</div>
                <div className="text-[11px] font-bold text-[#F3F4F6]">
                  {lastPacket ? lastPacket.statusHex : '--'}
                </div>
              </div>
              <div className="bg-[#1A1D22] border border-[#262A32] rounded p-1">
                <div className="text-[8px] text-[#9CA3AF]">DATA 1</div>
                <div className="text-[11px] font-bold text-[#F3F4F6]">
                  {lastPacket ? lastPacket.data1Hex : '--'}
                </div>
              </div>
              <div className="bg-[#1A1D22] border border-[#262A32] rounded p-1">
                <div className="text-[8px] text-[#9CA3AF]">DATA 2</div>
                <div className="text-[11px] font-bold text-[#F3F4F6]">
                  {lastPacket ? lastPacket.data2Hex : '--'}
                </div>
              </div>
              <div className="bg-[#1A1D22] border border-[#262A32] rounded p-1">
                <div className="text-[8px] text-[#9CA3AF]">CODE</div>
                <div className="text-[11px] font-bold text-[#0099DB]">
                  {lastPacket ? lastPacket.midiCode : '----'}
                </div>
              </div>
              <div className="bg-[#1A1D22] border border-[#262A32] rounded p-1">
                <div className="text-[8px] text-[#9CA3AF]">CH</div>
                <div className="text-[11px] font-bold text-[#F3F4F6]">
                  {lastPacket ? lastPacket.channel : '--'}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Category Content Panel */}
        <div className="col-span-9 bg-[#1E2127] border border-[#2C3038] rounded-md p-4 flex flex-col h-full overflow-y-auto">
          {category === 'CONTROLLER' && (
            <div className="flex flex-col h-full space-y-3">
              {/* Sub-Navigation Bar */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#2C3038] flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'MIDI_DEVICES', label: '1. MIDI Devices & Monitor' },
                      { id: 'MIDI_LEARN', label: '2. MIDI Learn' },
                      { id: 'MAPPING_EDITOR', label: '3. Mapping Editor' },
                      { id: 'LED_LEARN', label: '4. LED Feedback & LED Learn' },
                      { id: 'CONTROLLER_PROFILES', label: '5. Profiles & JSON Map' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setControllerTab(tab.id)}
                      className={`min-h-[34px] px-3 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
                        controllerTab === tab.id
                          ? 'bg-[#0099DB] text-[#0B0C0E] font-semibold'
                          : 'bg-[#14161A] text-[#9CA3AF] border border-[#2C3038] hover:text-[#F3F4F6]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Web MIDI API Availability Banner (Section 11 Security Requirement) */}
              {!webMidiSupported && (
                <div className="px-3 py-2 rounded bg-[#2B1F1D] border border-[#E03131]/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F59F00]" />
                    <span className="font-semibold text-[#F3F4F6]">
                      MIDI no disponible en este navegador/dispositivo.
                    </span>
                    <span className="text-[#9CA3AF]">
                      {webMidiErrorMessage ||
                        'La aplicación continúa funcionando normalmente mediante pantalla táctil.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onScanMidiDevices}
                    className="px-2.5 py-1 rounded bg-[#262930] text-[11px] font-mono text-[#F3F4F6] hover:border-white border border-[#3E434F]"
                  >
                    Reintentar MIDI
                  </button>
                </div>
              )}

              {/* ============================================================
                  TAB 1: MIDI DEVICES & REAL-TIME MIDI MONITOR
                 ============================================================ */}
              {controllerTab === 'MIDI_DEVICES' && (
                <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
                  <div className="col-span-7 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-semibold text-[#F3F4F6]">
                            MIDI Device Manager (Web MIDI / USB OTG)
                          </h3>
                          <p className="text-xs text-[#9CA3AF]">
                            Nombre del dispositivo, conexión, estado y puertos MIDI de entrada y salida.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onScanMidiDevices}
                          className="min-h-[34px] px-3 rounded bg-[#2B2F37] border border-[#454B56] text-xs font-medium text-[#F3F4F6] hover:border-white transition whitespace-nowrap"
                        >
                          Scan USB MIDI
                        </button>
                      </div>

                      <div className="space-y-2 mt-2 max-h-[175px] overflow-y-auto pr-1">
                        {midiDevices.map((dev) => (
                          <div
                            key={dev.id}
                            className="p-2.5 rounded bg-[#14161A] border border-[#2C3038] space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-[#F3F4F6]">
                                    {dev.name}
                                  </span>
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                      dev.connected
                                        ? 'bg-[#0099DB]/20 text-[#0099DB]'
                                        : 'bg-[#252830] text-[#9CA3AF]'
                                    }`}
                                  >
                                    {dev.connected ? 'CONNECTED' : 'DISCONNECTED'}
                                  </span>
                                  <span className="text-[10px] font-mono text-[#9CA3AF]">
                                    PORT: {dev.connectionStatus}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#9CA3AF] mt-0.5 font-mono">
                                  {dev.manufacturer} · IN PORTS: {dev.inputPortCount} · OUT PORTS: {dev.outputPortCount}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onToggleConnectMidiDevice(dev.id)}
                                className={`min-h-[32px] px-3 rounded text-xs font-medium border transition ${
                                  dev.connected
                                    ? 'bg-[#282C34] text-[#F3F4F6] border-[#0099DB]'
                                    : 'bg-[#1D2026] text-[#D1D5DB] border-[#383D47]'
                                }`}
                              >
                                {dev.connected ? 'Disconnect' : 'Connect'}
                              </button>
                            </div>

                            {/* Detailed Input & Output Ports */}
                            {(dev.inputPorts.length > 0 || dev.outputPorts.length > 0) && (
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#22262E] text-[10px] font-mono">
                                <div className="text-[#9CA3AF] truncate">
                                  <span className="text-[#0099DB] font-bold">ENTRADA (IN): </span>
                                  {dev.inputPorts.length > 0
                                    ? dev.inputPorts.map((p) => `${p.name} (${p.state})`).join(', ')
                                    : 'None'}
                                </div>
                                <div className="text-[#9CA3AF] truncate">
                                  <span className="text-[#0099DB] font-bold">SALIDA (OUT): </span>
                                  {dev.outputPorts.length > 0
                                    ? dev.outputPorts.map((p) => `${p.name} (${p.state})`).join(', ')
                                    : 'None'}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Numark DJ2GO Hardware Simulator + Custom Packet Test Bench */}
                    <div className="bg-[#14161A] border border-[#2C3038] rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#F3F4F6]">
                          Numark DJ2GO Quick Hardware Test & MIDI I/O
                        </span>
                        <span className="text-[10px] font-mono text-[#0099DB]">
                          {webMidiSupported ? 'Web MIDI API Active' : 'Touch / Virtual MIDI Bus'}
                        </span>
                      </div>

                      {/* Quick DJ2GO Buttons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSimulateIncomingMidi(0x90, 0x3b, 0x7f)}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          PLAY A (803B)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSimulateIncomingMidi(0x90, 0x33, 0x7f);
                            setTimeout(() => onSimulateIncomingMidi(0x80, 0x33, 0x00), 120);
                          }}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          CUE A (8033)
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateIncomingMidi(0xb0, 0x19, 0x03)}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          JOG A + (B019)
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateIncomingMidi(0xb0, 0x0a, 0x40)}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          XFADER (B00A)
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateIncomingMidi(0x90, 0x42, 0x7f)}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          PLAY B (8042)
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateIncomingMidi(0x90, 0x65, 0x7f)}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          PFL A (8065)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSimulateIncomingMidi(0x90, 0x4b, 0x7f);
                            setTimeout(() => onSimulateIncomingMidi(0x80, 0x4b, 0x00), 80);
                          }}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          LOAD A (804B)
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateIncomingMidi(0xb0, 0x1a, 0x01)}
                          className="h-7 rounded bg-[#1E2127] border border-[#383D47] hover:border-[#0099DB] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          BROWSE (B01A)
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-1">
                        <div>
                          <label className="block text-[9px] font-mono text-[#9CA3AF] mb-0.5">
                            MESSAGE
                          </label>
                          <select
                            value={txType}
                            onChange={(e) =>
                              setTxType(e.target.value as 'NOTE_ON' | 'NOTE_OFF' | 'CC')
                            }
                            className="w-full h-7 rounded bg-[#1E2127] border border-[#383D47] px-1.5 text-[11px] text-[#F3F4F6] font-mono"
                          >
                            <option value="NOTE_ON">Note On (90)</option>
                            <option value="NOTE_OFF">Note Off (80)</option>
                            <option value="CC">CC (B0)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-[#9CA3AF] mb-0.5">
                            CH (1-16)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={16}
                            value={txChannel}
                            onChange={(e) =>
                              setTxChannel(Math.min(16, Math.max(1, Number(e.target.value))))
                            }
                            className="w-full h-7 rounded bg-[#1E2127] border border-[#383D47] px-2 text-[11px] text-[#F3F4F6] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-[#9CA3AF] mb-0.5">
                            DATA 1 (DEC)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={127}
                            value={txData1}
                            onChange={(e) =>
                              setTxData1(Math.min(127, Math.max(0, Number(e.target.value))))
                            }
                            className="w-full h-7 rounded bg-[#1E2127] border border-[#383D47] px-2 text-[11px] text-[#F3F4F6] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-[#9CA3AF] mb-0.5">
                            DATA 2 (DEC)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={127}
                            value={txData2}
                            onChange={(e) =>
                              setTxData2(Math.min(127, Math.max(0, Number(e.target.value))))
                            }
                            className="w-full h-7 rounded bg-[#1E2127] border border-[#383D47] px-2 text-[11px] text-[#F3F4F6] font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => triggerCustomPacket('INCOMING_SIM')}
                          className="flex-1 h-8 rounded bg-[#0099DB] text-[#0B0C0E] text-xs font-semibold hover:opacity-90 transition"
                        >
                          Test MIDI Input (RX)
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerCustomPacket('OUTGOING_TX')}
                          className="flex-1 h-8 rounded bg-[#2B2F37] border border-[#454B56] text-[#F3F4F6] text-xs font-medium hover:border-white transition"
                        >
                          Send MIDI Output (TX)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visualización MIDI (Real-Time MIDI Monitor + CLEAR) */}
                  <div className="col-span-5 bg-[#14161A] border border-[#2C3038] rounded p-3 flex flex-col">
                    <div className="flex items-center justify-between pb-2 border-b border-[#262930]">
                      <div>
                        <span className="text-xs font-semibold text-[#F3F4F6]">
                          MIDI Monitor (Tiempo Real)
                        </span>
                        <div className="text-[10px] font-mono text-[#9CA3AF]">
                          STATUS · DATA 1 · DATA 2 · CODE · TYPE · CH
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onClearMidiPackets}
                        className="px-2.5 py-1 rounded bg-[#23272E] border border-[#383D47] hover:border-white text-[11px] font-mono text-[#F3F4F6]"
                      >
                        CLEAR
                      </button>
                    </div>

                    {/* Featured Latest Packet Inspector (matches Section 5 format) */}
                    {lastPacket && (
                      <div className="mt-2 p-2.5 rounded bg-[#1A1E24] border border-[#0099DB]/60 font-mono text-xs space-y-1">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[#9CA3AF]">STATUS: </span>
                            <strong className="text-[#F3F4F6]">{lastPacket.statusHex}</strong>
                          </div>
                          <div>
                            <span className="text-[#9CA3AF]">DATA 1: </span>
                            <strong className="text-[#F3F4F6]">{lastPacket.data1Hex}</strong>
                          </div>
                          <div>
                            <span className="text-[#9CA3AF]">DATA 2: </span>
                            <strong className="text-[#F3F4F6]">{lastPacket.data2Hex}</strong>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#262A32]">
                          <div>
                            <span className="text-[#9CA3AF]">CODE: </span>
                            <strong className="text-[#0099DB]">{lastPacket.midiCode}</strong>
                          </div>
                          <div className="col-span-2 truncate">
                            <span className="text-[#9CA3AF]">TYPE: </span>
                            <strong className="text-[#F3F4F6]">{lastPacket.typeLabel}</strong>
                          </div>
                        </div>
                        <div>
                          <span className="text-[#9CA3AF]">CHANNEL: </span>
                          <strong className="text-[#F3F4F6]">{lastPacket.channel}</strong>
                        </div>
                      </div>
                    )}

                    {/* Limited Packet History List (Max 50 items) */}
                    <div className="flex-1 overflow-y-auto mt-2 space-y-1 max-h-[210px]">
                      {midiPackets.length === 0 ? (
                        <div className="text-xs text-[#9CA3AF] py-8 text-center font-mono">
                          Esperando mensajes MIDI...
                        </div>
                      ) : (
                        midiPackets.map((pkt) => (
                          <div
                            key={pkt.id}
                            className="grid grid-cols-12 items-center px-2 py-1 rounded bg-[#1D2026] border border-[#2B2F37] font-mono text-[10px] tabular-nums"
                          >
                            <span className="col-span-2 font-bold text-[#0099DB]">
                              {pkt.midiCode}
                            </span>
                            <span className="col-span-4 text-[#F3F4F6] truncate">
                              {pkt.typeLabel}
                            </span>
                            <span className="col-span-2 text-[#D1D5DB]">
                              ST:{pkt.statusHex}
                            </span>
                            <span className="col-span-2 text-[#D1D5DB]">
                              D1:{pkt.data1Hex}
                            </span>
                            <span className="col-span-1 text-[#D1D5DB]">
                              D2:{pkt.data2Hex}
                            </span>
                            <span className="col-span-1 text-right text-[#9CA3AF]">
                              C{pkt.channel}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  TAB 2: MIDI LEARN (Select Function -> [LEARN] -> Detect -> [ASSIGN])
                 ============================================================ */}
              {controllerTab === 'MIDI_LEARN' && (
                <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
                  {/* Left: Function Selector List */}
                  <div className="col-span-7 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        {(['ALL', 'DECK_A', 'DECK_B', 'MIXER', 'LIBRARY'] as const).map(
                          (cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setLearnFilterCategory(cat)}
                              className={`px-2 py-1 rounded text-[10px] font-mono border ${
                                learnFilterCategory === cat
                                  ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB] font-bold'
                                  : 'bg-[#14161A] text-[#9CA3AF] border-[#2C3038]'
                              }`}
                            >
                              {cat}
                            </button>
                          )
                        )}
                      </div>

                      <label className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoAssignOnLearn}
                          onChange={(e) => setAutoAssignOnLearn(e.target.checked)}
                          className="rounded"
                        />
                        <span>Auto-Assign</span>
                      </label>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[290px]">
                      {filteredBindableActions.map((item) => {
                        const existing = activeProfile.mappings.find(
                          (m) => m.actionId === item.actionId
                        );
                        const isLearning = midiLearnActionId === item.actionId;

                        return (
                          <div
                            key={item.actionId}
                            className={`flex items-center justify-between px-3 py-2 rounded border transition ${
                              isLearning
                                ? 'bg-[#252A33] border-[#0099DB]'
                                : 'bg-[#14161A] border-[#262A32]'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-[#F3F4F6] truncate">
                                  {item.label}
                                </span>
                                {existing && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#0099DB]/20 text-[#0099DB] font-mono text-[10px] font-bold">
                                    {existing.midiCode}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-[#9CA3AF] truncate">
                                {existing
                                  ? `STATUS: ${toHexByte(existing.status)} · DATA1: ${toHexByte(
                                      existing.data1
                                    )} · CH ${existing.channel} · ${existing.controlMode}`
                                  : item.vdjReferenceNote || 'Unassigned'}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {existing && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveMapping(item.actionId)}
                                  className="min-h-[28px] px-2 rounded bg-[#22262E] border border-[#383D47] text-[10px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                                >
                                  Clear
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  onStartMidiLearn(isLearning ? null : item.actionId)
                                }
                                className={`min-h-[28px] px-3 rounded text-xs font-mono font-semibold border transition ${
                                  isLearning
                                    ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB]'
                                    : 'bg-[#22262E] text-[#F3F4F6] border-[#454B56] hover:border-white'
                                }`}
                              >
                                {isLearning ? 'LEARNING...' : 'LEARN'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: MIDI LEARN Inspector Box (Section 3 & 4 Spec) */}
                  <div className="col-span-5 flex flex-col justify-between bg-[#14161A] border border-[#2C3038] rounded p-3.5 space-y-3">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#262A32] pb-2">
                        <span className="text-xs font-bold text-[#F3F4F6] tracking-wide">
                          MIDI LEARN INSPECTOR
                        </span>
                        <span className="text-[10px] font-mono text-[#0099DB]">
                          {midiLearnActionId ? 'LISTENING FOR MIDI...' : 'SELECT A FUNCTION'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded bg-[#1B1E24] border border-[#2C3038]">
                        <div className="text-[10px] font-mono text-[#9CA3AF]">
                          Function:
                        </div>
                        <div className="text-sm font-bold text-[#F3F4F6] mt-0.5">
                          {currentLearningMeta
                            ? currentLearningMeta.label
                            : 'Ninguna función seleccionada (Pulsa [LEARN] a la izquierda)'}
                        </div>
                        {currentLearningMeta?.vdjReferenceNote && (
                          <div className="text-[10px] font-mono text-[#0099DB] mt-0.5">
                            Ref: {currentLearningMeta.vdjReferenceNote}
                          </div>
                        )}
                      </div>

                      {/* Detected MIDI Parameters */}
                      <div className="grid grid-cols-2 gap-2 font-mono">
                        <div className="p-2 rounded bg-[#1B1E24] border border-[#262A32]">
                          <div className="text-[10px] text-[#9CA3AF]">STATUS</div>
                          <div className="text-sm font-bold text-[#F3F4F6]">
                            {midiLearnCandidatePacket
                              ? `${midiLearnCandidatePacket.statusHex} (${midiLearnCandidatePacket.typeLabel})`
                              : '--'}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-[#1B1E24] border border-[#262A32]">
                          <div className="text-[10px] text-[#9CA3AF]">CHANNEL</div>
                          <div className="text-sm font-bold text-[#F3F4F6]">
                            {midiLearnCandidatePacket
                              ? `CH ${midiLearnCandidatePacket.channel}`
                              : '--'}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-[#1B1E24] border border-[#262A32]">
                          <div className="text-[10px] text-[#9CA3AF]">DATA 1</div>
                          <div className="text-sm font-bold text-[#F3F4F6]">
                            {midiLearnCandidatePacket
                              ? `${midiLearnCandidatePacket.data1Hex} (${midiLearnCandidatePacket.data1})`
                              : '--'}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-[#1B1E24] border border-[#262A32]">
                          <div className="text-[10px] text-[#9CA3AF]">DATA 2</div>
                          <div className="text-sm font-bold text-[#F3F4F6]">
                            {midiLearnCandidatePacket
                              ? `${midiLearnCandidatePacket.data2Hex} (${midiLearnCandidatePacket.data2})`
                              : '--'}
                          </div>
                        </div>
                      </div>

                      {/* Highlighted MIDI CODE Box */}
                      <div className="p-3 rounded bg-[#101216] border border-[#0099DB] flex items-center justify-between font-mono">
                        <span className="text-xs text-[#9CA3AF]">MIDI CODE:</span>
                        <span className="text-lg font-bold tracking-wider text-[#0099DB]">
                          {midiLearnCandidatePacket
                            ? midiLearnCandidatePacket.midiCode
                            : '----'}
                        </span>
                      </div>

                      {/* Continuous vs Button Control Mode Selector */}
                      <div>
                        <label className="block text-[10px] font-mono text-[#9CA3AF] mb-1">
                          CONTROL MODE (Absolute / Relative / Hold 200ms)
                        </label>
                        <select
                          value={selectedLearnMode}
                          onChange={(e) =>
                            setSelectedLearnMode(e.target.value as MidiControlMode)
                          }
                          className="w-full h-8 rounded bg-[#1B1E24] border border-[#383D47] px-2 text-xs text-[#F3F4F6] font-mono"
                        >
                          <option value="BUTTON_TOGGLE">BUTTON (Toggle / Trigger)</option>
                          <option value="BUTTON_MOMENTARY">BUTTON (Momentary / Cue)</option>
                          <option value="BUTTON_HOLD_200MS">
                            BUTTON HOLD 200ms (Tap=Load / Hold=Vinyl)
                          </option>
                          <option value="ABSOLUTE">
                            CONTINUOUS ABSOLUTE (0..127 Fader/Knob)
                          </option>
                          <option value="RELATIVE_2C">
                            CONTINUOUS RELATIVE 2&apos;s Comp (Jog / Encoder)
                          </option>
                          <option value="RELATIVE_OFFSET">
                            CONTINUOUS RELATIVE Offset (64 Center)
                          </option>
                          <option value="PITCH_BEND_14BIT">
                            PITCH BEND 14-Bit
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* [ASSIGN] Button */}
                    <div className="space-y-2 pt-2 border-t border-[#262A32]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!midiLearnActionId || !midiLearnCandidatePacket}
                          onClick={() => {
                            if (midiLearnActionId && midiLearnCandidatePacket) {
                              onAssignLearnedMapping(
                                midiLearnActionId,
                                midiLearnCandidatePacket,
                                selectedLearnMode
                              );
                            }
                          }}
                          className={`flex-1 h-9 rounded font-mono text-xs font-bold transition ${
                            midiLearnActionId && midiLearnCandidatePacket
                              ? 'bg-[#0099DB] text-[#0B0C0E] hover:bg-[#19B2F5]'
                              : 'bg-[#252830] text-[#6B7280] cursor-not-allowed'
                          }`}
                        >
                          [ASSIGN]
                        </button>
                        {midiLearnActionId && (
                          <button
                            type="button"
                            onClick={() => onStartMidiLearn(null)}
                            className="h-9 px-3 rounded bg-[#252830] border border-[#383D47] text-xs font-mono text-[#D1D5DB]"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  TAB 3: MAPPING EDITOR (FUNCTION | MIDI CODE | TYPE | STATUS)
                 ============================================================ */}
              {controllerTab === 'MAPPING_EDITOR' && (
                <div className="flex flex-col flex-1 space-y-3 overflow-hidden">
                  {/* Add or Quick-Edit Mapping Row */}
                  <div className="p-2.5 rounded bg-[#14161A] border border-[#2C3038] flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                      <select
                        value={newMappingActionId}
                        onChange={(e) =>
                          setNewMappingActionId(
                            e.target.value as DjbBindableActionId
                          )
                        }
                        className="h-8 rounded bg-[#1E2127] border border-[#383D47] px-2 text-xs text-[#F3F4F6] flex-1"
                      >
                        {DJB_BINDABLE_ACTIONS.map((a) => (
                          <option key={a.actionId} value={a.actionId}>
                            {a.shortKey} — {a.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        maxLength={4}
                        value={newMappingHexCode}
                        onChange={(e) =>
                          setNewMappingHexCode(e.target.value.toUpperCase())
                        }
                        placeholder="803B"
                        className="w-20 h-8 rounded bg-[#1E2127] border border-[#383D47] px-2 font-mono text-xs text-[#0099DB] uppercase text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const meta = DJB_BINDABLE_ACTIONS.find(
                            (a) => a.actionId === newMappingActionId
                          );
                          onUpdateMappingEntry(
                            newMappingActionId,
                            newMappingHexCode,
                            meta?.defaultMode || 'BUTTON_TOGGLE'
                          );
                        }}
                        className="h-8 px-3 rounded bg-[#0099DB] text-[#0B0C0E] font-mono text-xs font-bold"
                      >
                        + Assign / Update Code
                      </button>
                    </div>
                  </div>

                  {/* Mapping Table: FUNCTION | MIDI CODE | TYPE | STATUS | MODE | ACTIONS */}
                  <div className="flex-1 overflow-y-auto rounded bg-[#14161A] border border-[#2C3038] max-h-[260px]">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="bg-[#101216] border-b border-[#2C3038] text-[10px] text-[#9CA3AF]">
                          <th className="py-2 px-3">FUNCTION</th>
                          <th className="py-2 px-3">MIDI CODE</th>
                          <th className="py-2 px-3">TYPE</th>
                          <th className="py-2 px-3">STATUS</th>
                          <th className="py-2 px-3">CH</th>
                          <th className="py-2 px-3">MODE</th>
                          <th className="py-2 px-3 text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#22262E]">
                        {activeProfile.mappings.map((m) => {
                          const isEditing = editingActionId === m.actionId;
                          return (
                            <tr
                              key={m.actionId}
                              className="hover:bg-[#1B1F26] transition"
                            >
                              <td className="py-2 px-3">
                                <div className="font-bold text-[#F3F4F6]">
                                  {m.shortKey}
                                </div>
                                <div className="text-[10px] text-[#9CA3AF] font-sans">
                                  {m.actionLabel}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    maxLength={4}
                                    value={editingHexCode}
                                    onChange={(e) =>
                                      setEditingHexCode(
                                        e.target.value.toUpperCase()
                                      )
                                    }
                                    className="w-16 h-7 rounded bg-[#1E2127] border border-[#0099DB] px-1.5 text-xs text-[#0099DB] font-bold text-center"
                                  />
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-[#0099DB]/15 text-[#0099DB] font-bold">
                                    {m.midiCode}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[#F3F4F6]">
                                {getShortCommandType(m.command)}
                              </td>
                              <td className="py-2 px-3 text-[#D1D5DB]">
                                {toHexByte(m.status)}
                              </td>
                              <td className="py-2 px-3 text-[#9CA3AF]">
                                {m.channel}
                              </td>
                              <td className="py-2 px-3">
                                {isEditing ? (
                                  <select
                                    value={editingMode}
                                    onChange={(e) =>
                                      setEditingMode(
                                        e.target.value as MidiControlMode
                                      )
                                    }
                                    className="h-7 rounded bg-[#1E2127] border border-[#0099DB] px-1 text-[10px] text-[#F3F4F6]"
                                  >
                                    <option value="BUTTON_TOGGLE">BUTTON_TOGGLE</option>
                                    <option value="BUTTON_MOMENTARY">BUTTON_MOMENTARY</option>
                                    <option value="BUTTON_HOLD_200MS">HOLD_200MS</option>
                                    <option value="ABSOLUTE">ABSOLUTE</option>
                                    <option value="RELATIVE_2C">RELATIVE_2C</option>
                                    <option value="RELATIVE_OFFSET">RELATIVE_OFFSET</option>
                                  </select>
                                ) : (
                                  <span className="text-[10px] text-[#9CA3AF]">
                                    {m.controlMode}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right space-x-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onUpdateMappingEntry(
                                          m.actionId,
                                          editingHexCode,
                                          editingMode
                                        );
                                        setEditingActionId(null);
                                      }}
                                      className="px-2 py-1 rounded bg-[#0099DB] text-[#0B0C0E] font-bold text-[10px]"
                                    >
                                      SAVE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingActionId(null)}
                                      className="px-2 py-1 rounded bg-[#252830] text-[#9CA3AF] text-[10px]"
                                    >
                                      CANCEL
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingActionId(m.actionId);
                                        setEditingHexCode(m.midiCode);
                                        setEditingMode(m.controlMode);
                                      }}
                                      className="px-2 py-1 rounded bg-[#22262E] border border-[#383D47] hover:border-white text-[#F3F4F6] text-[10px]"
                                    >
                                      EDIT
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onStartMidiLearn(m.actionId);
                                        setControllerTab('MIDI_LEARN');
                                      }}
                                      className="px-2 py-1 rounded bg-[#22262E] border border-[#0099DB]/60 text-[#0099DB] text-[10px]"
                                    >
                                      LEARN
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveMapping(m.actionId)}
                                      className="px-2 py-1 rounded bg-[#22262E] hover:bg-[#991B1B] text-[#9CA3AF] hover:text-white text-[10px]"
                                    >
                                      ×
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ============================================================
                  TAB 4: LED FEEDBACK & HERRAMIENTA "LEARN LED" (Sections 6 & 7)
                 ============================================================ */}
              {controllerTab === 'LED_LEARN' && (
                <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
                  {/* Left: Experimental LEARN LED Tester */}
                  <div className="col-span-6 bg-[#14161A] border border-[#2C3038] rounded p-3.5 flex flex-col justify-between space-y-3">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#262A32] pb-2">
                        <div>
                          <h3 className="text-xs font-bold text-[#F3F4F6] uppercase">
                            LEARN LED — Experimental LED Output Explorer
                          </h3>
                          <p className="text-[10px] text-[#9CA3AF]">
                            APP STATE ↓ MIDI FEEDBACK ↓ CONTROLLER LED
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#0099DB]/20 text-[#0099DB] font-mono text-xs font-bold">
                          CODE: {computedLedCodeHex}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-[#9CA3AF] mb-1">
                          SELECT TARGET LED FUNCTION
                        </label>
                        <select
                          value={selectedLedId}
                          onChange={(e) => {
                            setSelectedLedId(e.target.value as DjbLedId);
                            setLedSavedMsg(null);
                          }}
                          className="w-full h-8 rounded bg-[#1E2127] border border-[#383D47] px-2.5 text-xs text-[#F3F4F6] font-mono"
                        >
                          {DJB_LED_DEFINITIONS.map((def) => (
                            <option key={def.ledId} value={def.ledId}>
                              {def.label} ({def.ledId})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* STATUS, DATA 1, DATA 2 */}
                      <div className="grid grid-cols-4 gap-2 font-mono">
                        <div>
                          <label className="block text-[9px] text-[#9CA3AF] mb-1">
                            STATUS
                          </label>
                          <select
                            value={ledStatusNibble}
                            onChange={(e) =>
                              setLedStatusNibble(Number(e.target.value))
                            }
                            className="w-full h-8 rounded bg-[#1E2127] border border-[#383D47] px-1.5 text-xs text-[#F3F4F6]"
                          >
                            <option value={0x90}>90 (NoteOn)</option>
                            <option value={0x80}>80 (NoteOff)</option>
                            <option value={0xb0}>B0 (CC)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#9CA3AF] mb-1">
                            CH (1-16)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={16}
                            value={ledChannel}
                            onChange={(e) =>
                              setLedChannel(
                                Math.min(16, Math.max(1, Number(e.target.value)))
                              )
                            }
                            className="w-full h-8 rounded bg-[#1E2127] border border-[#383D47] px-2 text-xs text-[#F3F4F6]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#9CA3AF] mb-1">
                            DATA 1 ({toHexByte(ledData1)})
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={127}
                              value={ledData1}
                              onChange={(e) =>
                                setLedData1(
                                  Math.min(127, Math.max(0, Number(e.target.value)))
                                )
                              }
                              className="w-full h-8 rounded bg-[#1E2127] border border-[#383D47] px-1.5 text-xs text-[#F3F4F6]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#9CA3AF] mb-1">
                            DATA 2 ({toHexByte(ledData2)})
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={127}
                            value={ledData2}
                            onChange={(e) =>
                              setLedData2(
                                Math.min(127, Math.max(0, Number(e.target.value)))
                              )
                            }
                            className="w-full h-8 rounded bg-[#1E2127] border border-[#383D47] px-2 text-xs text-[#F3F4F6]"
                          />
                        </div>
                      </div>

                      {/* Quick Step Data 1 to probe DJ2GO LEDs */}
                      <div className="flex items-center justify-between bg-[#1B1E24] border border-[#262A32] rounded px-2.5 py-1.5 text-xs font-mono">
                        <span className="text-[10px] text-[#9CA3AF]">
                          Explorar notas LED (Data 1):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const prev = Math.max(0, ledData1 - 1);
                              setLedData1(prev);
                              onSendRawMidiOut(computedLedStatusByte, prev, ledOnVel);
                            }}
                            className="px-2 py-0.5 rounded bg-[#252830] hover:bg-[#32363F] text-[#F3F4F6]"
                          >
                            -1 &amp; SEND ON
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(127, ledData1 + 1);
                              setLedData1(next);
                              onSendRawMidiOut(computedLedStatusByte, next, ledOnVel);
                            }}
                            className="px-2 py-0.5 rounded bg-[#252830] hover:bg-[#32363F] text-[#F3F4F6]"
                          >
                            +1 &amp; SEND ON
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Required Buttons: SEND | SEND ON | SEND OFF + SAVE */}
                    <div className="space-y-2 pt-2 border-t border-[#262A32]">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            onSendRawMidiOut(
                              computedLedStatusByte,
                              ledData1,
                              ledData2
                            )
                          }
                          className="h-9 rounded bg-[#2B2F37] border border-[#454B56] hover:border-white text-[#F3F4F6] font-semibold"
                        >
                          SEND
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLedData2(ledOnVel);
                            onSendRawMidiOut(
                              computedLedStatusByte,
                              ledData1,
                              ledOnVel
                            );
                          }}
                          className="h-9 rounded bg-[#0099DB] text-[#0B0C0E] font-bold hover:bg-[#19B2F5]"
                        >
                          SEND ON (7F)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLedData2(ledOffVel);
                            onSendRawMidiOut(
                              computedLedStatusByte,
                              ledData1,
                              ledOffVel
                            );
                          }}
                          className="h-9 rounded bg-[#22262E] border border-[#383D47] hover:border-white text-[#D1D5DB] font-semibold"
                        >
                          SEND OFF (00)
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateLedMappingEntry(
                              selectedLedId,
                              computedLedStatusByte,
                              ledChannel,
                              ledData1,
                              ledOnVel,
                              ledOffVel
                            );
                            setLedSavedMsg(
                              `Guardado: ${selectedLedId} → ${computedLedCodeHex}`
                            );
                          }}
                          className="w-full h-9 rounded bg-[#1F2937] border border-[#0099DB] hover:bg-[#0099DB] hover:text-[#0B0C0E] text-[#0099DB] font-mono text-xs font-bold transition"
                        >
                          SAVE LED MAPPING ({selectedLedId} = {computedLedCodeHex})
                        </button>
                      </div>
                      {ledSavedMsg && (
                        <div className="text-[11px] font-mono text-[#0099DB] text-center">
                          {ledSavedMsg}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Live App State -> LED Feedback Table */}
                  <div className="col-span-6 bg-[#14161A] border border-[#2C3038] rounded p-3.5 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b border-[#262A32]">
                      <span className="text-xs font-bold text-[#F3F4F6]">
                        Editable LED Mappings &amp; Live App State
                      </span>
                      <span className="text-[10px] font-mono text-[#0099DB]">
                        CLICK ROW TO EDIT IN LED LEARN
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto mt-2 space-y-1.5 max-h-[250px] pr-1">
                      {ledStates.map((led) => {
                        const isSelected = selectedLedId === led.ledId;
                        return (
                          <div
                            key={led.ledId}
                            onClick={() => setSelectedLedId(led.ledId)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded border cursor-pointer font-mono text-xs transition ${
                              isSelected
                                ? 'bg-[#252A33] border-[#0099DB]'
                                : 'bg-[#1A1D23] border-[#262A32] hover:border-[#3E434F]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  led.active
                                    ? 'bg-[#0099DB] shadow-[0_0_8px_#0099DB]'
                                    : 'bg-[#383D47]'
                                }`}
                              />
                              <div>
                                <div className="font-bold text-[#F3F4F6] text-[11px]">
                                  {led.label}
                                </div>
                                <div className="text-[10px] text-[#9CA3AF]">
                                  {led.ledId}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {led.visualMode === 'LED_ALTERNATING' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59F00]/20 border border-[#F59F00]/60 text-[#FBBF24] font-bold">
                                  ALT BLINK
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-[#121417] border border-[#2C3038] text-[#0099DB] font-bold">
                                {led.midiCode}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  led.active
                                    ? 'bg-[#0099DB] text-[#0B0C0E]'
                                    : 'bg-[#252830] text-[#9CA3AF]'
                                }`}
                              >
                                {led.active ? 'LED ON' : 'LED OFF'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  TAB 5: CONTROLLER PROFILES & SAVEABLE JSON MAPPING (Section 8)
                 ============================================================ */}
              {controllerTab === 'CONTROLLER_PROFILES' && (
                <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
                  {/* Left: Preset & Custom Profiles + Restore Defaults */}
                  <div className="col-span-6 flex flex-col justify-between space-y-3 overflow-y-auto pr-1 max-h-[310px]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#F3F4F6] uppercase">
                          Controller Profiles (DJ2GO, DDJ-400, FLX4, NS4FX)
                        </h3>
                        <button
                          type="button"
                          onClick={onRestoreDefaultProfiles}
                          className="px-2.5 py-1 rounded bg-[#252830] border border-[#3E434F] hover:border-white text-[10px] font-mono text-[#F3F4F6]"
                        >
                          Restore Defaults
                        </button>
                      </div>

                      {profiles.map((prof) => {
                        const isSelected = prof.id === activeProfile.id;
                        return (
                          <div
                            key={prof.id}
                            className={`flex items-center justify-between p-2.5 rounded border ${
                              isSelected
                                ? 'bg-[#252A33] border-[#0099DB]'
                                : 'bg-[#14161A] border-[#2C3038]'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-semibold text-[#F3F4F6] truncate">
                                {prof.name}
                              </div>
                              <div className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">
                                {prof.controllerModel} · {prof.mappings.length} inputs ·{' '}
                                {prof.ledMappings?.length || 0} LEDs
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectProfile(prof.id)}
                              className={`min-h-[30px] px-3 rounded text-xs font-mono font-semibold shrink-0 ${
                                isSelected
                                  ? 'bg-[#0099DB] text-[#0B0C0E]'
                                  : 'bg-[#22262E] text-[#F3F4F6] border border-[#383D47]'
                              }`}
                            >
                              {isSelected ? 'ACTIVE' : 'LOAD'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Create New Profile */}
                    <div className="bg-[#14161A] border border-[#2C3038] rounded p-3 space-y-2">
                      <div className="text-xs font-semibold text-[#F3F4F6]">
                        Create New Controller Profile
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Profile Name (e.g. My DJ2GO)"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          className="h-8 rounded bg-[#1E2127] border border-[#383D47] px-2 text-xs text-[#F3F4F6]"
                        />
                        <input
                          type="text"
                          placeholder="Controller Model"
                          value={newProfileModel}
                          onChange={(e) => setNewProfileModel(e.target.value)}
                          className="h-8 rounded bg-[#1E2127] border border-[#383D47] px-2 text-xs text-[#F3F4F6]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newProfileName.trim()) return;
                          onCreateNewProfile(
                            newProfileName.trim(),
                            newProfileModel.trim()
                          );
                          setNewProfileName('');
                        }}
                        className="w-full h-8 rounded bg-[#0099DB] text-[#0B0C0E] text-xs font-semibold"
                      >
                        + Create &amp; Save Profile
                      </button>
                    </div>
                  </div>

                  {/* Right: Portable JSON Mapping Save / Load */}
                  <div className="col-span-6 bg-[#14161A] border border-[#2C3038] rounded p-3 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F3F4F6]">
                        JSON Mapping ({activeProfile.controllerModel})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleExportCopy}
                          className="px-2.5 py-1 rounded bg-[#252830] border border-[#383D47] text-[10px] font-mono text-[#F3F4F6]"
                        >
                          {copiedExport ? 'COPIED!' : 'COPY JSON'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadJsonFile}
                          className="px-2.5 py-1 rounded bg-[#0099DB] text-[#0B0C0E] font-bold text-[10px] font-mono"
                        >
                          SAVE .JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => jsonFileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded bg-[#252830] border border-[#0099DB] text-[#0099DB] font-bold text-[10px] font-mono"
                        >
                          LOAD .JSON
                        </button>
                        <input
                          ref={jsonFileInputRef}
                          type="file"
                          accept=".json,application/json"
                          onChange={handleUploadJsonFile}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <textarea
                      rows={8}
                      value={importJsonText || portableJsonString}
                      onChange={(e) => setImportJsonText(e.target.value)}
                      className="w-full flex-1 rounded bg-[#101216] border border-[#262A32] p-2.5 font-mono text-[11px] text-[#D1D5DB] resize-none"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ok = onImportProfileJson(
                            importJsonText || portableJsonString
                          );
                          setImportStatusMsg(
                            ok
                              ? 'Mapping JSON aplicado y guardado correctamente.'
                              : 'Error: formato JSON inválido.'
                          );
                        }}
                        className="h-8 px-3 rounded bg-[#0099DB] text-[#0B0C0E] font-mono text-xs font-bold"
                      >
                        APPLY EDITED JSON MAPPING
                      </button>
                      {importStatusMsg && (
                        <span className="text-[11px] font-mono text-[#0099DB] truncate">
                          {importStatusMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUDIO CATEGORY */}
          {category === 'AUDIO' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-[#F3F4F6]">
                  Audio Device
                </h3>
                <select
                  value={audioConfig.selectedDeviceId}
                  onChange={(e) =>
                    onUpdateAudioConfig({ selectedDeviceId: e.target.value })
                  }
                  className="w-full h-9 rounded bg-[#1E2127] border border-[#383D47] px-3 text-xs text-[#F3F4F6]"
                >
                  {AVAILABLE_AUDIO_DEVICES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.sampleRateHz} Hz · {d.channels}ch)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-[#F3F4F6]">
                  Latency
                </h3>
                <div className="flex items-center gap-2">
                  {([64, 128, 256, 512] as const).map((frames) => (
                    <button
                      key={frames}
                      type="button"
                      onClick={() =>
                        onUpdateAudioConfig({
                          bufferSizeFrames: frames,
                          latencyMs: Number(((frames / 48000) * 2000).toFixed(1)),
                        })
                      }
                      className={`flex-1 min-h-[34px] rounded font-mono text-xs font-medium border ${
                        audioConfig.bufferSizeFrames === frames
                          ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB] font-semibold'
                          : 'bg-[#1E2127] text-[#F3F4F6] border-[#383D47]'
                      }`}
                    >
                      {frames} smp
                    </button>
                  ))}
                </div>
                <div className="text-xs font-mono text-[#9CA3AF]">
                  Buffer Latency: {audioConfig.latencyMs} ms @ {audioConfig.sampleRateHz} Hz
                </div>
              </div>

              <div className="bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#F3F4F6]">Master</h3>
                  <span className="text-xs font-mono text-[#F3F4F6]">
                    {mixer.masterLevel}%
                  </span>
                </div>
                <select
                  value={audioConfig.masterRouting}
                  onChange={(e) =>
                    onUpdateAudioConfig({
                      masterRouting: e.target.value as AudioEngineConfig['masterRouting'],
                    })
                  }
                  className="w-full h-9 rounded bg-[#1E2127] border border-[#383D47] px-3 text-xs text-[#F3F4F6]"
                >
                  <option value="STEREO_CH_1_2">Stereo Out (Ch 1 &amp; 2)</option>
                  <option value="MONO_SPLIT_LEFT">Split Cable Mono (Left)</option>
                </select>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mixer.masterLevel}
                  onChange={(e) =>
                    onUpdateMixer({ masterLevel: Number(e.target.value) })
                  }
                  className="w-full djb-fader"
                />
              </div>

              <div className="bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#F3F4F6]">
                    Headphones
                  </h3>
                  <span className="text-xs font-mono text-[#F3F4F6]">
                    {mixer.headphoneLevel}%
                  </span>
                </div>
                <select
                  value={audioConfig.headphonesRouting}
                  onChange={(e) =>
                    onUpdateAudioConfig({
                      headphonesRouting: e.target.value as AudioEngineConfig['headphonesRouting'],
                    })
                  }
                  className="w-full h-9 rounded bg-[#1E2127] border border-[#383D47] px-3 text-xs text-[#F3F4F6]"
                >
                  <option value="STEREO_CH_3_4">USB Stereo Cue (Ch 3 &amp; 4)</option>
                  <option value="MONO_SPLIT_RIGHT">Split Cable Cue (Right)</option>
                  <option value="INTERNAL_DAC">Internal DAC</option>
                </select>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mixer.headphoneLevel}
                  onChange={(e) =>
                    onUpdateMixer({ headphoneLevel: Number(e.target.value) })
                  }
                  className="w-full djb-fader"
                />
              </div>
            </div>
          )}

          {/* LIBRARY CATEGORY */}
          {category === 'LIBRARY' && (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-7 bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-[#F3F4F6]">
                  Music Folders &amp; Storage
                </h3>
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-2.5 rounded bg-[#1E2127] border border-[#2C3038]"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[#F3F4F6] truncate">
                          {folder.path}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF]">
                          {folder.storageType} · {folder.trackCount} tracks
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleFolderAutoScan(folder.id)}
                        className={`min-h-[30px] px-2.5 rounded text-[11px] font-mono border ${
                          folder.autoScanOnLaunch
                            ? 'bg-[#252A33] text-[#0099DB] border-[#0099DB]'
                            : 'bg-[#15171C] text-[#9CA3AF] border-[#383D47]'
                        }`}
                      >
                        {folder.autoScanOnLaunch ? 'Auto-Scan ON' : 'Manual'}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newFolderPath}
                    onChange={(e) => setNewFolderPath(e.target.value)}
                    className="flex-1 h-9 rounded bg-[#1E2127] border border-[#383D47] px-2.5 font-mono text-xs text-[#F3F4F6]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newFolderPath.trim()) return;
                      onAddMusicFolder(newFolderPath.trim(), 'INTERNAL_STORAGE');
                    }}
                    className="min-h-[36px] px-3 rounded bg-[#0099DB] text-[#0B0C0E] text-xs font-semibold whitespace-nowrap"
                  >
                    + Add Folder
                  </button>
                </div>
              </div>

              <div className="col-span-5 bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-[#F3F4F6]">Analysis</h3>
                <div>
                  <label className="block text-[11px] text-[#9CA3AF] mb-1">
                    BPM Detection Range
                  </label>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="bg-[#1E2127] border border-[#2C3038] rounded p-2">
                      MIN: {analysisConfig.bpmRangeMin} BPM
                    </div>
                    <div className="bg-[#1E2127] border border-[#2C3038] rounded p-2">
                      MAX: {analysisConfig.bpmRangeMax} BPM
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[#9CA3AF] mb-1">
                    Harmonic Key Format
                  </label>
                  <select
                    value={analysisConfig.keyNotation}
                    onChange={(e) =>
                      onUpdateAnalysisConfig({
                        keyNotation: e.target.value as AnalysisConfig['keyNotation'],
                      })
                    }
                    className="w-full h-9 rounded bg-[#1E2127] border border-[#383D47] px-2.5 text-xs text-[#F3F4F6]"
                  >
                    <option value="CAMELOT">Camelot (8A, 8B...)</option>
                    <option value="OPEN_KEY">Open Key</option>
                    <option value="STANDARD_MUSICAL">Musical (Am, C...)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM CATEGORY */}
          {category === 'SYSTEM' && (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6 bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[#F3F4F6]">
                  System Operating Mode
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onChangeOperatingMode(OperatingMode.STANDALONE)}
                    className={`min-h-[52px] rounded p-3 text-left border transition ${
                      operatingMode === OperatingMode.STANDALONE
                        ? 'bg-[#252A33] border-[#0099DB] text-[#F3F4F6]'
                        : 'bg-[#1E2127] border-[#2C3038] text-[#9CA3AF]'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#F3F4F6]">
                      STANDALONE MODE
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                      Dual-Deck Independent App
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeOperatingMode(OperatingMode.VIRTUALDJ)}
                    className={`min-h-[52px] rounded p-3 text-left border transition ${
                      operatingMode === OperatingMode.VIRTUALDJ
                        ? 'bg-[#252A33] border-[#0099DB] text-[#F3F4F6]'
                        : 'bg-[#1E2127] border-[#2C3038] text-[#9CA3AF]'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#F3F4F6]">
                      VIRTUALDJ MODE
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                      USB Touch Display Bridge
                    </div>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#262A32] space-y-2">
                  <div className="text-xs font-semibold text-[#F3F4F6]">
                    VirtualDJ Bridge Endpoint
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={vdjConfig.windowsBridgeHost}
                      onChange={(e) =>
                        onUpdateVdjConfig({ windowsBridgeHost: e.target.value })
                      }
                      className="h-9 rounded bg-[#1E2127] border border-[#383D47] px-2.5 font-mono text-xs text-[#F3F4F6]"
                    />
                    <input
                      type="number"
                      value={vdjConfig.windowsBridgePort}
                      onChange={(e) =>
                        onUpdateVdjConfig({
                          windowsBridgePort: Number(e.target.value),
                        })
                      }
                      className="h-9 rounded bg-[#1E2127] border border-[#383D47] px-2.5 font-mono text-xs text-[#F3F4F6]"
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-6 bg-[#14161A] border border-[#2C3038] rounded p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#F3F4F6]">
                    ABOUT · DJB TOUCH DISPLAY
                  </h3>
                  <span className="text-xs font-mono text-[#0099DB]">
                    Created by DJ Brayan
                  </span>
                </div>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Base modular profesional <strong className="text-[#F3F4F6]">DJB Core</strong> con soporte Android USB MIDI, Numark DJ2GO, MIDI Learn, Mapping Editor y LED Learn.
                </p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] pt-1">
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    01. MIDI Device Manager
                  </div>
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    02. MIDI Input &amp; Output
                  </div>
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    03. MIDI Mapping &amp; Editor
                  </div>
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    04. MIDI Learn &amp; LED Learn
                  </div>
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    05. Standalone Audio DSP
                  </div>
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    06. HD Waveform Engine
                  </div>
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    07. Multi-Stage Analyzer
                  </div>
                  <div className="p-2 rounded bg-[#1E2127] border border-[#2C3038] text-[#F3F4F6]">
                    08. VirtualDJ Bridge
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
