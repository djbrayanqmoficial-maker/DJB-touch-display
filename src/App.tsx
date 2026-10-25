/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyHotCues,
  DeckState,
  formatTimeCode,
  FxSlotState,
  INITIAL_DECK_A,
  INITIAL_DECK_B,
  INITIAL_FX_SLOTS,
  INITIAL_MIXER_STATE,
  MainSection,
  MixerState,
  OperatingMode,
} from './core/dj/DjEngine';
import {
  ControllerProfile,
  DjbBindableActionId,
  DjbLedId,
  MidiCommandType,
  MidiControlMode,
  MidiDeviceDescriptor,
  MidiMappingEntry,
  MidiPacket,
} from './core/midi/MidiTypes';
import {
  buildDeviceDescriptorsFromAccess,
  buildMidiCodeHex,
  computeCanonicalLedFeedbackStates,
  createLearnedMappingEntry,
  decodeContinuousControl,
  DJB_BINDABLE_ACTIONS,
  formatMidiStatusHex,
  INITIAL_CONTROLLER_PROFILES,
  isWebMidiApiAvailable,
  loadSavedProfilesFromStorage,
  MidiHoldTracker,
  midiOutputManager,
  parseMidiCodeHex,
  parsePortableJsonToProfile,
  parseRawMidiBytes,
  resetAllControllerLeds,
  saveProfilesToStorage,
  sendHardwareLedState,
} from './core/midi/MidiEngine';
import {
  AudioEngineConfig,
  INITIAL_AUDIO_CONFIG,
} from './core/audio/AudioEngine';
import { MasterVuMeterState } from './core/mixer/MixerEngine';
import { realAudioEngine } from './core/audio/RealAudioEngine';
import {
  INITIAL_MUSIC_FOLDERS,
  MusicFolderConfig,
} from './core/library/LibraryEngine';
import {
  AnalysisConfig,
  INITIAL_ANALYSIS_CONFIG,
} from './core/analyzer/AnalyzerEngine';
import {
  INITIAL_VDJ_BRIDGE_CONFIG,
  VirtualDjBridgeConfig,
} from './core/virtualdj/VirtualDjBridge';
import {
  CachedWaveformRecord,
  PlaylistRecord,
  RegisteredFolderRecord,
  StorageVolumeType,
  StoredTrackRecord,
  trackDatabase,
} from './core/database/TrackDatabase';
import {
  fetchGoogleDriveAudioBlob,
  GoogleDriveAudioFileItem,
} from './core/drive/GoogleDriveService';
import {
  importManager,
  ImportQueueStatus,
} from './core/import/ImportManager';
import {
  stemPreparationQueue,
  StemQueueStatus,
} from './core/stems/StemPreparationQueue';
import {
  applyStemPadAction,
  BEAT_JUMP_PRESETS,
  BeatJumpPresetId,
  computeBeatJumpTargetSec,
  DeckStemPadState,
  INITIAL_DECK_STEM_STATE,
  INITIAL_SAMPLER_PADS_DECK_A,
  INITIAL_SAMPLER_PADS_DECK_B,
  PerformancePadPageId,
  SamplerPadSlotState,
  VirtualDjPadOverridesMap,
} from './core/performance/PerformancePadsEngine';
const FX_OPTIONS: { value: FxSlotState['name']; label: string }[] = [
  { value: 'FILTER', label: 'Filter' },
  { value: 'ECHO', label: 'Echo' },
  { value: 'DELAY', label: 'Delay' },
  { value: 'REVERB', label: 'Reverb' },
  { value: 'CUT', label: 'Beat Cut (1/4)' },
  { value: 'PING_PONG', label: 'Ping Pong' },
  { value: 'FLANGER', label: 'Flanger' },
  { value: 'PHASER', label: 'Phaser' },
  { value: 'TRANS', label: 'Trans Gate' },
  { value: 'FILTER_LFO', label: 'Filter LFO' },
];
import { TopDeckHeaderBar } from './components/TopDeckHeaderBar';
import { BottomTransportBar } from './components/BottomTransportBar';
import { CenterRackColumn } from './components/CenterRackColumn';
import { TurntablePlatter } from './components/TurntablePlatter';
import { VerticalFader } from './components/VerticalFader';
import { TouchKnob } from './components/TouchKnob';
import { WaveformCanvas } from './components/WaveformCanvas';
import {
  DEFAULT_LIBRARY_NAVIGATION_STATE,
  LibraryNavigableItem,
  LibraryNavigationState,
  LibraryView,
} from './components/LibraryView';
import { PerformancePadsView } from './components/PerformancePadsView';
import { SettingsView } from './components/SettingsView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { requestLandscapeFullscreen } from './core/pwa/usePWAInstall';

const NAVIGATION_SECTIONS: Array<{ id: MainSection; label: string }> = [
  { id: MainSection.DECKS, label: 'DECKS' },
  { id: MainSection.WAVEFORMS, label: 'WAVEFORMS' },
  { id: MainSection.MIXER_EQ, label: 'MIXER / EQ' },
  { id: MainSection.LOOPS_HOTCUES, label: 'LOOPS / CUES' },
  { id: MainSection.FX, label: 'FX' },
  { id: MainSection.PERFORMANCE, label: 'PADS' },
  { id: MainSection.LIBRARY, label: 'LIBRARY' },
  { id: MainSection.SETTINGS, label: 'SETTINGS' },
];

const LOOP_BEAT_STEPS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

const PAD_BANKS_A = [
  '909 Kick',
  '909 Snare',
  '909 Closed Hat',
  '909 Open Hat',
  '909 Clap',
  '909 Ride',
];

const PAD_BANKS_B = [
  'Horn',
  'Gong',
  'Punch',
  'Gunshot',
  'Police Siren',
  'Siren',
];

export default function App() {
  const [operatingMode, setOperatingMode] = useState<OperatingMode>(
    OperatingMode.UNSELECTED
  );
  const [activeSection, setActiveSection] = useState<MainSection>(
    MainSection.DECKS
  );
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Dual Deck State
  const [deckA, setDeckA] = useState<DeckState>(INITIAL_DECK_A);
  const [deckB, setDeckB] = useState<DeckState>(INITIAL_DECK_B);
  const [cuePointA, setCuePointA] = useState<number>(0);
  const [cuePointB, setCuePointB] = useState<number>(0);
  const [firstBeatOffsetA, setFirstBeatOffsetA] = useState<number>(0);
  const [firstBeatOffsetB, setFirstBeatOffsetB] = useState<number>(0);
  const [autoFirstBeatOffsetA, setAutoFirstBeatOffsetA] = useState<number>(0);
  const [autoFirstBeatOffsetB, setAutoFirstBeatOffsetB] = useState<number>(0);
  const [autoBaseBpmA, setAutoBaseBpmA] = useState<number>(126.0);
  const [autoBaseBpmB, setAutoBaseBpmB] = useState<number>(128.0);
  const [gridResolutionA, setGridResolutionA] = useState<number>(1);
  const [gridResolutionB, setGridResolutionB] = useState<number>(1);
  const [beatGridEditorOpen, setBeatGridEditorOpen] = useState<boolean>(false);
  const [beatGridEditDeck, setBeatGridEditDeck] = useState<'A' | 'B'>('A');
  const [cachedWaveformA, setCachedWaveformA] =
    useState<CachedWaveformRecord | null>(null);
  const [cachedWaveformB, setCachedWaveformB] =
    useState<CachedWaveformRecord | null>(null);
  const [meterLevelA, setMeterLevelA] = useState<number>(0);
  const [meterLevelB, setMeterLevelB] = useState<number>(0);
  const [masterVu, setMasterVu] = useState<MasterVuMeterState>({
    left: 0,
    right: 0,
    master: 0,
    peakLeft: 0,
    peakRight: 0,
    peakMaster: 0,
  });

  const [mixer, setMixer] = useState<MixerState>(INITIAL_MIXER_STATE);
  const [fxSlots, setFxSlots] = useState<FxSlotState[]>(INITIAL_FX_SLOTS);

  // Loops / Hot Cues Specific UI States (SLIP & Clear 'X' toggle per deck)
  const [slipModeA, setSlipModeA] = useState<boolean>(false);
  const [slipModeB, setSlipModeB] = useState<boolean>(false);
  const [clearCueModeA, setClearCueModeA] = useState<boolean>(false);
  const [clearCueModeB, setClearCueModeB] = useState<boolean>(false);

  // FX X/Y Pad Coordinates, Active Drag Pointers & Lock State per Deck
  const [fxLockA, setFxLockA] = useState<boolean>(false);
  const [fxLockB, setFxLockB] = useState<boolean>(false);
  const [fxDropdownOpenA, setFxDropdownOpenA] = useState<boolean>(false);
  const [fxDropdownOpenB, setFxDropdownOpenB] = useState<boolean>(false);
  const [fxCoordA, setFxCoordA] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.35,
  });
  const [fxCoordB, setFxCoordB] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.25,
  });
  const fxPadARef = useRef<HTMLDivElement | null>(null);
  const fxPadBRef = useRef<HTMLDivElement | null>(null);
  const fxPointerIdARef = useRef<number | null>(null);
  const fxPointerIdBRef = useRef<number | null>(null);

  // Performance Pads (8 Pads per Deck · 4 Pages: HOT_CUES | BEAT_JUMP | STEMS | SAMPLER)
  const [padPageA, setPadPageA] = useState<PerformancePadPageId>('HOT_CUES');
  const [padPageB, setPadPageB] = useState<PerformancePadPageId>('HOT_CUES');
  const [beatJumpPresetA, setBeatJumpPresetA] =
    useState<BeatJumpPresetId>('STANDARD_32');
  const [beatJumpPresetB, setBeatJumpPresetB] =
    useState<BeatJumpPresetId>('STANDARD_32');
  const [stemsA, setStemsA] = useState<DeckStemPadState>(
    INITIAL_DECK_STEM_STATE
  );
  const [stemsB, setStemsB] = useState<DeckStemPadState>(
    INITIAL_DECK_STEM_STATE
  );
  const [samplerPadsA, setSamplerPadsA] = useState<SamplerPadSlotState[]>(
    INITIAL_SAMPLER_PADS_DECK_A
  );
  const [samplerPadsB, setSamplerPadsB] = useState<SamplerPadSlotState[]>(
    INITIAL_SAMPLER_PADS_DECK_B
  );
  const [vdjPadOverrides] = useState<VirtualDjPadOverridesMap>({});
  const [samplerGain, setSamplerGain] = useState<number>(80);
  const [samplerEditMode, setSamplerEditMode] = useState<boolean>(false);

  const padPageARef = useRef<PerformancePadPageId>(padPageA);
  padPageARef.current = padPageA;
  const padPageBRef = useRef<PerformancePadPageId>(padPageB);
  padPageBRef.current = padPageB;
  const beatJumpPresetARef = useRef<BeatJumpPresetId>(beatJumpPresetA);
  beatJumpPresetARef.current = beatJumpPresetA;
  const beatJumpPresetBRef = useRef<BeatJumpPresetId>(beatJumpPresetB);
  beatJumpPresetBRef.current = beatJumpPresetB;
  const samplerPadsARef = useRef<SamplerPadSlotState[]>(samplerPadsA);
  samplerPadsARef.current = samplerPadsA;
  const samplerPadsBRef = useRef<SamplerPadSlotState[]>(samplerPadsB);
  samplerPadsBRef.current = samplerPadsB;
  const stemsARef = useRef<DeckStemPadState>(stemsA);
  stemsARef.current = stemsA;
  const stemsBRef = useRef<DeckStemPadState>(stemsB);
  stemsBRef.current = stemsB;
  const samplerGainRef = useRef<number>(samplerGain);
  samplerGainRef.current = samplerGain;

  // Waveforms View State
  const [waveformZoom, setWaveformZoom] = useState<number>(2);
  const [showBeatgrid, setShowBeatgrid] = useState<boolean>(true);
  const [jogTouchMode, setJogTouchMode] = useState<'BEND' | 'SCRATCH'>('BEND');

  // Persistent Library & Import Queue State
  const [storedTracks, setStoredTracks] = useState<StoredTrackRecord[]>([]);
  const [registeredFolders, setRegisteredFolders] = useState<
    RegisteredFolderRecord[]
  >([]);
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [queueStatus, setQueueStatus] = useState<ImportQueueStatus>({
    isProcessing: false,
    pendingCount: 0,
    completedCount: 0,
    totalCount: 0,
    currentTrackId: null,
    currentTrackTitle: '',
    currentStage: 'IDLE',
    progressPercent: 0,
  });
  const [libraryTargetDeck, setLibraryTargetDeck] = useState<'A' | 'B'>('A');

  const [folders, setFolders] = useState<MusicFolderConfig[]>(
    INITIAL_MUSIC_FOLDERS
  );
  const [audioConfig, setAudioConfig] =
    useState<AudioEngineConfig>(INITIAL_AUDIO_CONFIG);
  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig>(
    INITIAL_ANALYSIS_CONFIG
  );
  const [vdjConfig, setVdjConfig] = useState<VirtualDjBridgeConfig>(
    INITIAL_VDJ_BRIDGE_CONFIG
  );

  // MIDI Engine State (Persistent Profiles + Device Manager + Learn + Hold Tracker)
  const initialMidiStorage = useMemo(() => loadSavedProfilesFromStorage(), []);
  const [webMidiSupported, setWebMidiSupported] = useState<boolean>(() =>
    isWebMidiApiAvailable()
  );
  const [webMidiErrorMessage, setWebMidiErrorMessage] = useState<string | null>(
    null
  );
  const [disabledMidiDeviceIds, setDisabledMidiDeviceIds] = useState<string[]>(
    []
  );
  const [midiDevices, setMidiDevices] = useState<MidiDeviceDescriptor[]>([
    {
      id: 'usb-virtual-bus-0',
      name: 'Android USB MIDI Host Bus (OTG Ready)',
      manufacturer: 'DJB Core MIDI',
      product: 'USB MIDI Port 1',
      type: 'VIRTUAL_BUS',
      connected: true,
      connectionStatus: 'OPEN',
      inputPortCount: 1,
      outputPortCount: 1,
      inputPorts: [
        {
          id: 'virtual-in-1',
          name: 'DJB Virtual MIDI In',
          manufacturer: 'DJB Core MIDI',
          state: 'connected',
          connection: 'open',
          direction: 'INPUT',
        },
      ],
      outputPorts: [
        {
          id: 'virtual-out-1',
          name: 'DJB Virtual MIDI Out',
          manufacturer: 'DJB Core MIDI',
          state: 'connected',
          connection: 'open',
          direction: 'OUTPUT',
        },
      ],
    },
  ]);
  const [midiPackets, setMidiPackets] = useState<MidiPacket[]>([]);
  const [profiles, setProfiles] = useState<ControllerProfile[]>(
    initialMidiStorage.profiles
  );
  const [activeProfileId, setActiveProfileId] = useState<string>(
    initialMidiStorage.activeProfileId
  );
  const [midiLearnActionId, setMidiLearnActionId] =
    useState<DjbBindableActionId | null>(null);
  const [midiLearnCandidatePacket, setMidiLearnCandidatePacket] =
    useState<MidiPacket | null>(null);

  // Vinyl Mode per deck (toggled by holding LOAD for 200ms on DJ2GO) & Selected Library Track
  const [vinylModeA, setVinylModeA] = useState<boolean>(false);
  const [vinylModeB, setVinylModeB] = useState<boolean>(false);
  const [selectedLibraryTrackId, setSelectedLibraryTrackId] = useState<
    string | null
  >(null);
  const [stemQueueStatus, setStemQueueStatus] = useState<StemQueueStatus>(() =>
    stemPreparationQueue.getStatus()
  );
  const [stemNoticeA, setStemNoticeA] = useState<string | null>(null);
  const [stemNoticeB, setStemNoticeB] = useState<string | null>(null);
  const stemNoticeTimerARef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const stemNoticeTimerBRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Persistent Library Navigation State (remembers section LOCAL/IMPORTADAS, folder, subfolder, selected item, and scroll position)
  const [libraryNavState, setLibraryNavState] =
    useState<LibraryNavigationState>(() => {
      try {
        const raw = localStorage.getItem('djb_library_nav_state_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            ...DEFAULT_LIBRARY_NAVIGATION_STATE,
            ...parsed,
            scrollPositions:
              parsed && typeof parsed.scrollPositions === 'object'
                ? parsed.scrollPositions
                : {},
          };
        }
      } catch {
        // Ignore storage read errors
      }
      return DEFAULT_LIBRARY_NAVIGATION_STATE;
    });
  const libraryNavStateRef = useRef<LibraryNavigationState>(libraryNavState);
  libraryNavStateRef.current = libraryNavState;

  useEffect(() => {
    try {
      localStorage.setItem(
        'djb_library_nav_state_v1',
        JSON.stringify(libraryNavState)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [libraryNavState]);

  const libraryTargetDeckRef = useRef<'A' | 'B'>(libraryTargetDeck);
  libraryTargetDeckRef.current = libraryTargetDeck;

  // Progressive Phase-Drift Pause Blink (PLAY/PAUSE: 700ms ON / 700ms OFF, CUE: 600ms ON / 600ms OFF)
  const [pauseBlinkElapsedMs, setPauseBlinkElapsedMs] = useState<number>(0);

  // Beat-Grid-locked SYNC LED pulse per deck (changes immediately on every beat of the Beat Grid)
  const [syncBeatPulseA, setSyncBeatPulseA] = useState<boolean>(false);
  const [syncBeatPulseB, setSyncBeatPulseB] = useState<boolean>(false);
  const syncBeatPulseARef = useRef<boolean>(false);
  const syncBeatPulseBRef = useRef<boolean>(false);

  // Remember which screen opened the Browser/Library so closing returns to that exact screen
  const previousSectionBeforeLibraryRef = useRef<MainSection>(
    MainSection.WAVEFORMS
  );
  const activeSectionRef = useRef<MainSection>(activeSection);
  activeSectionRef.current = activeSection;
  const operatingModeRef = useRef<OperatingMode>(operatingMode);
  operatingModeRef.current = operatingMode;
  const vinylModeARef = useRef<boolean>(vinylModeA);
  vinylModeARef.current = vinylModeA;
  const vinylModeBRef = useRef<boolean>(vinylModeB);
  vinylModeBRef.current = vinylModeB;
  const firstBeatOffsetARef = useRef<number>(firstBeatOffsetA);
  firstBeatOffsetARef.current = firstBeatOffsetA;
  const firstBeatOffsetBRef = useRef<number>(firstBeatOffsetB);
  firstBeatOffsetBRef.current = firstBeatOffsetB;
  const gridResolutionARef = useRef<number>(gridResolutionA);
  gridResolutionARef.current = gridResolutionA;
  const gridResolutionBRef = useRef<number>(gridResolutionB);
  gridResolutionBRef.current = gridResolutionB;

  const navigateToSection = useCallback((nextSection: MainSection) => {
    if (
      nextSection === MainSection.LIBRARY &&
      activeSectionRef.current !== MainSection.LIBRARY &&
      activeSectionRef.current !== MainSection.SETTINGS
    ) {
      previousSectionBeforeLibraryRef.current = activeSectionRef.current;
    }
    setActiveSection(nextSection);
  }, []);

  const closeLibraryAndReturn = useCallback(() => {
    const target =
      previousSectionBeforeLibraryRef.current ||
      (operatingModeRef.current === OperatingMode.MOBILE_ONLY
        ? MainSection.DECKS
        : MainSection.WAVEFORMS);
    setActiveSection(target);
  }, []);

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const midiHoldTrackerRef = useRef<MidiHoldTracker>(new MidiHoldTracker());
  const midiPressedButtonsRef = useRef<Set<string>>(new Set());
  const midiLastPressTimeRef = useRef<Map<string, number>>(new Map());
  const prevAbsoluteJogRef = useRef<{ A: number | null; B: number | null }>({
    A: null,
    B: null,
  });
  const prevSentLedMapRef = useRef<
    Record<string, { active: boolean; midiCode: string }>
  >({});
  const storedTracksRef = useRef<StoredTrackRecord[]>(storedTracks);
  storedTracksRef.current = storedTracks;
  const visibleLibraryTracksRef = useRef<StoredTrackRecord[]>([]);
  const navigableLibraryItemsRef = useRef<LibraryNavigableItem[]>([]);
  const selectedLibraryTrackIdRef = useRef<string | null>(
    selectedLibraryTrackId
  );
  selectedLibraryTrackIdRef.current = selectedLibraryTrackId;

  // Hardware Browser Button State for simultaneous BACK + ENTER detection on Numark DJ2GO
  const backButtonHeldRef = useRef<boolean>(false);
  const enterButtonHeldRef = useRef<boolean>(false);
  const browserComboTriggeredRef = useRef<boolean>(false);
  const pendingBrowserActionTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingBrowserActionFnRef = useRef<(() => void) | null>(null);
  const preBrowserButtonNavSnapshotRef =
    useRef<LibraryNavigationState | null>(null);

  // Compute current level's navigable items (folders + songs) so MIDI encoder works immediately even before LibraryView mounts
  const computedNavigableLibraryItems = useMemo<LibraryNavigableItem[]>(() => {
    const {
      activeSource,
      categoryTab,
      localCurrentFolder,
      importedCurrentFolder,
      searchQuery,
      selectedPlaylistId,
      selectedGroupFilter,
    } = libraryNavState;
    const currentFolderPath =
      activeSource === 'LOCAL' ? localCurrentFolder : importedCurrentFolder;

    const sourceTracks =
      activeSource === 'LOCAL'
        ? storedTracks.filter((t) => t.sourceType === 'LOCAL')
        : activeSource === 'IMPORTADAS'
        ? storedTracks.filter((t) => t.sourceType === 'IMPORTED')
        : activeSource === 'ALL_MUSIC'
        ? storedTracks.filter((t) => t.fileAvailable !== false)
        : storedTracks;

    const q = searchQuery.trim().toLowerCase();
    const items: LibraryNavigableItem[] = [];

    if (
      categoryTab === 'SONGS' &&
      (activeSource === 'LOCAL' || activeSource === 'IMPORTADAS')
    ) {
      const dbSourceType: 'LOCAL' | 'IMPORTED' =
        activeSource === 'LOCAL' ? 'LOCAL' : 'IMPORTED';
      const prefix = currentFolderPath ? `${currentFolderPath}/` : '';
      const folderMap = new Map<string, { name: string; fullPath: string }>();

      const ensureChild = (childName: string) => {
        if (!childName) return;
        const fullPath = currentFolderPath
          ? `${currentFolderPath}/${childName}`
          : childName;
        if (!folderMap.has(fullPath)) {
          folderMap.set(fullPath, { name: childName, fullPath });
        }
      };

      for (const reg of registeredFolders) {
        if (reg.sourceType !== dbSourceType) continue;
        const norm = (reg.folderPath || '').replace(/^\/+|\/+$/g, '');
        if (!norm) continue;
        if (!currentFolderPath) {
          ensureChild(norm.split('/')[0]);
        } else if (norm.startsWith(prefix)) {
          const segs = norm.slice(prefix.length).split('/').filter(Boolean);
          if (segs.length >= 1) ensureChild(segs[0]);
        }
      }

      for (const trk of sourceTracks) {
        const norm = (trk.folderPath || '').replace(/^\/+|\/+$/g, '');
        if (!norm) continue;
        if (!currentFolderPath) {
          ensureChild(norm.split('/')[0]);
        } else if (norm.startsWith(prefix)) {
          const segs = norm.slice(prefix.length).split('/').filter(Boolean);
          if (segs.length >= 1) ensureChild(segs[0]);
        }
      }

      let folders = Array.from(folderMap.values());
      if (q) {
        folders = folders.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.fullPath.toLowerCase().includes(q)
        );
      }
      folders.sort((a, b) => a.name.localeCompare(b.name, 'es'));

      for (const f of folders) {
        items.push({
          kind: 'FOLDER',
          id: `folder:${f.fullPath}`,
          folderPath: f.fullPath,
          folderName: f.name,
        });
      }
    }

    const filteredTracks = sourceTracks.filter((t) => {
      if (categoryTab === 'PLAYLISTS') {
        if (selectedPlaylistId) {
          const pl = playlists.find((p) => p.id === selectedPlaylistId);
          if (pl && !pl.trackIds.includes(t.id)) return false;
        }
      } else if (
        categoryTab === 'ALBUMS' ||
        categoryTab === 'ARTISTS' ||
        categoryTab === 'GENRES'
      ) {
        if (selectedGroupFilter) {
          if (categoryTab === 'ALBUMS' && t.album !== selectedGroupFilter)
            return false;
          if (categoryTab === 'ARTISTS' && t.artist !== selectedGroupFilter)
            return false;
          if (categoryTab === 'GENRES' && t.genre !== selectedGroupFilter)
            return false;
        }
      } else if (
        categoryTab === 'SONGS' &&
        (activeSource === 'LOCAL' || activeSource === 'IMPORTADAS')
      ) {
        const trackFolder = (t.folderPath || '').replace(/^\/+|\/+$/g, '');
        if (!q) {
          if (trackFolder !== currentFolderPath) return false;
        } else if (
          currentFolderPath &&
          trackFolder !== currentFolderPath &&
          !trackFolder.startsWith(`${currentFolderPath}/`)
        ) {
          return false;
        }
      }

      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        (t.fileName || '').toLowerCase().includes(q) ||
        (t.folderPath || '').toLowerCase().includes(q) ||
        (t.key || '').toLowerCase().includes(q) ||
        (t.bpm ? t.bpm.toFixed(1).includes(q) : false)
      );
    });

    for (const trk of filteredTracks) {
      items.push({
        kind: 'TRACK',
        id: `track:${trk.id}`,
        track: trk,
      });
    }

    return items;
  }, [libraryNavState, storedTracks, registeredFolders, playlists]);

  navigableLibraryItemsRef.current = computedNavigableLibraryItems;

  const initialDecksLoadedRef = useRef<boolean>(false);
  const deckARef = useRef<DeckState>(deckA);
  const deckBRef = useRef<DeckState>(deckB);
  deckARef.current = deckA;
  deckBRef.current = deckB;

  // Persist profiles & activeProfileId to localStorage whenever modified
  useEffect(() => {
    saveProfilesToStorage(profiles, activeProfileId);
  }, [profiles, activeProfileId]);

  // Keep selectedLibraryTrackId valid when tracks load
  useEffect(() => {
    if (
      storedTracks.length > 0 &&
      (!selectedLibraryTrackId ||
        !storedTracks.some((t) => t.id === selectedLibraryTrackId))
    ) {
      setSelectedLibraryTrackId(storedTracks[0].id);
    }
  }, [storedTracks, selectedLibraryTrackId]);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || profiles[0],
    [profiles, activeProfileId]
  );
  const activeProfileRef = useRef<ControllerProfile>(activeProfile);
  activeProfileRef.current = activeProfile;

  // Subtle, Professional Progressive Phase-Drift Timer (100ms resolution):
  // PLAY/PAUSE: 700ms ON / 700ms OFF (1400ms period)
  // CUE:        600ms ON / 600ms OFF (1200ms period)
  // Coincides occasionally and progressively separates over an 8400ms (8.4s) cycle
  const deckAPausedWithTrack =
    Boolean(deckA.trackId && deckA.durationSec > 0) &&
    !deckA.isPlaying &&
    !deckA.isCueing;
  const deckBPausedWithTrack =
    Boolean(deckB.trackId && deckB.durationSec > 0) &&
    !deckB.isPlaying &&
    !deckB.isCueing;
  const shouldRunPauseBlink = deckAPausedWithTrack || deckBPausedWithTrack;

  useEffect(() => {
    if (!shouldRunPauseBlink) {
      setPauseBlinkElapsedMs(0);
      return;
    }
    let localElapsed = 0;
    const timer = setInterval(() => {
      localElapsed = (localElapsed + 100) % 8400;
      const nextPlayOn = localElapsed % 1400 < 700;
      const nextCueOn = localElapsed % 1200 < 600;
      setPauseBlinkElapsedMs((prev) => {
        const prevPlayOn = prev % 1400 < 700;
        const prevCueOn = prev % 1200 < 600;
        return nextPlayOn !== prevPlayOn || nextCueOn !== prevCueOn
          ? localElapsed
          : prev;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [shouldRunPauseBlink]);

  const playPauseBlinkOn = (pauseBlinkElapsedMs % 1400) < 700;
  const cuePauseBlinkOn = (pauseBlinkElapsedMs % 1200) < 600;

  // Compute canonical LED feedback states ONLY when LED-relevant properties change (ignores 35fps positionSec / jogAngleDeg)
  const ledStates = useMemo(
    () =>
      computeCanonicalLedFeedbackStates(activeProfile, {
        deckA: deckARef.current,
        deckB: deckBRef.current,
        vinylModeA,
        vinylModeB,
        fxActiveA: fxLockA || Boolean(fxSlots[0]?.active),
        fxActiveB: fxLockB || Boolean(fxSlots[1]?.active),
        playPauseBlinkOn,
        cuePauseBlinkOn,
        syncBeatPulseA,
        syncBeatPulseB,
      }),
    [
      activeProfile,
      deckA.trackId,
      deckA.durationSec > 0,
      deckA.isPlaying,
      deckA.isCueing,
      deckA.pflHeadphoneCue,
      deckA.isSyncActive,
      deckA.keyLock,
      deckA.loop.active,
      deckA.hotCues,
      deckB.trackId,
      deckB.durationSec > 0,
      deckB.isPlaying,
      deckB.isCueing,
      deckB.pflHeadphoneCue,
      deckB.isSyncActive,
      deckB.keyLock,
      deckB.loop.active,
      deckB.hotCues,
      vinylModeA,
      vinylModeB,
      fxLockA,
      fxLockB,
      fxSlots,
      playPauseBlinkOn,
      cuePauseBlinkOn,
      syncBeatPulseA,
      syncBeatPulseB,
    ]
  );

  const cueLedActiveA = useMemo(
    () => ledStates.find((l) => l.ledId === 'CUE_A_LED')?.active ?? false,
    [ledStates]
  );
  const playLedActiveA = useMemo(
    () => ledStates.find((l) => l.ledId === 'PLAY_A_LED')?.active ?? false,
    [ledStates]
  );
  const syncLedActiveA = useMemo(
    () => ledStates.find((l) => l.ledId === 'SYNC_A_LED')?.active ?? false,
    [ledStates]
  );
  const cueLedActiveB = useMemo(
    () => ledStates.find((l) => l.ledId === 'CUE_B_LED')?.active ?? false,
    [ledStates]
  );
  const playLedActiveB = useMemo(
    () => ledStates.find((l) => l.ledId === 'PLAY_B_LED')?.active ?? false,
    [ledStates]
  );
  const syncLedActiveB = useMemo(
    () => ledStates.find((l) => l.ledId === 'SYNC_B_LED')?.active ?? false,
    [ledStates]
  );

  const sendRawMidiOut = useCallback(
    (status: number, data1: number, data2: number) => {
      midiOutputManager.sendRawMessage(
        midiAccessRef.current,
        status,
        data1,
        data2
      );
      const txPacket = parseRawMidiBytes(
        status,
        data1,
        data2,
        'djb-tx-out',
        'LED Feedback TX'
      );
      setMidiPackets((prev) => [txPacket, ...prev.slice(0, 49)]);
    },
    []
  );

  // Automatic APP STATE -> LED ENGINE -> HARDWARE MIDI OUTPUT Synchronization (Diff-based, zero-flood)
  useEffect(() => {
    // In MOBILE_ONLY ("MEZCLAR SOLO CON CELULAR") mode, hardware MIDI output is disabled
    if (operatingMode === OperatingMode.MOBILE_ONLY) return;
    for (const led of ledStates) {
      const prev = prevSentLedMapRef.current[led.ledId];
      if (
        !prev ||
        prev.active !== led.active ||
        prev.midiCode !== led.midiCode
      ) {
        prevSentLedMapRef.current[led.ledId] = {
          active: led.active,
          midiCode: led.midiCode,
        };
        sendHardwareLedState(midiAccessRef.current, led);
      }
    }
  }, [ledStates, operatingMode]);

  // Clean up all controller LEDs & pending timers on window unload / pagehide / unmount
  useEffect(() => {
    const handleCleanShutdown = () => {
      midiHoldTrackerRef.current.clearAll();
      resetAllControllerLeds(midiAccessRef.current, activeProfileRef.current);
      prevSentLedMapRef.current = {};
    };
    window.addEventListener('beforeunload', handleCleanShutdown);
    window.addEventListener('pagehide', handleCleanShutdown);
    return () => {
      window.removeEventListener('beforeunload', handleCleanShutdown);
      window.removeEventListener('pagehide', handleCleanShutdown);
      handleCleanShutdown();
    };
  }, []);

  // Load a StoredTrackRecord into Deck A or Deck B directly from its original reference (zero audio duplication)
  const loadStoredTrackToDeck = useCallback(
    async (
      track: StoredTrackRecord,
      targetDeck: 'A' | 'B',
      switchToDecksView = true
    ) => {
      let resolved = await trackDatabase.resolveTrackAudioFile(track);
      if (
        (resolved.isMissing || !resolved.blob) &&
        track.sourceType === 'GOOGLE_DRIVE' &&
        track.driveFileId
      ) {
        try {
          const driveBlob = await fetchGoogleDriveAudioBlob(
            track.driveFileId,
            track.mimeType || 'audio/mpeg'
          );
          if (driveBlob) {
            resolved = { blob: driveBlob, isMissing: false };
          }
        } catch {
          // Ignore drive fetch error when offline/unauthenticated
        }
      }

      if (resolved.isMissing || !resolved.blob) {
        const missingRecord: StoredTrackRecord = {
          ...track,
          fileAvailable: false,
          analysisStatus: 'MISSING_FILE',
        };
        await trackDatabase.saveTrack(missingRecord);
        setStoredTracks(await trackDatabase.getAllTracks());
        return;
      }

      if (track.fileAvailable === false) {
        await trackDatabase.saveTrack({
          ...track,
          fileAvailable: true,
          analysisStatus: 'READY',
        });
        setStoredTracks(await trackDatabase.getAllTracks());
      }

      const { deckA: engA, deckB: engB } = realAudioEngine.ensureInitialized();
      const targetEngine = targetDeck === 'A' ? engA : engB;
      const blob = resolved.blob;
      const waveform = await trackDatabase.getWaveform(track.id);

      let realDur = track.durationSec || 32;
      if (blob) {
        const loadedDur = await targetEngine.loadAudioBlob(blob, track.id);
        if (loadedDur > 0) realDur = loadedDur;
      }

      if (targetDeck === 'A') {
        setStemNoticeA(null);
      } else {
        setStemNoticeB(null);
      }

      const baseBpm = track.bpm && track.bpm > 0 ? track.bpm : 124.0;
      const currentDeck =
        targetDeck === 'A' ? deckARef.current : deckBRef.current;
      targetEngine.setKeyLock(currentDeck.keyLock);
      targetEngine.setPitchPercent(currentDeck.pitchPercent);
      targetEngine.setInputGain(currentDeck.eq.gain);
      targetEngine.setChannelVolume(currentDeck.volumeFader);
      targetEngine.setEq(
        currentDeck.eq.low,
        currentDeck.eq.mid,
        currentDeck.eq.high
      );
      targetEngine.setBipolarFilter(currentDeck.eq.filter);
      targetEngine.setStemState(
        targetDeck === 'A' ? stemsARef.current : stemsBRef.current,
        baseBpm * (1 + currentDeck.pitchPercent / 100)
      );

      const updater = targetDeck === 'A' ? setDeckA : setDeckB;
      const initialOffset = track.firstBeatOffsetSec || 0;
      const initialGridRes = track.beatGridResolution || 1;
      if (targetDeck === 'A') {
        setCuePointA(0);
        setFirstBeatOffsetA(initialOffset);
        setAutoFirstBeatOffsetA(initialOffset);
        setAutoBaseBpmA(baseBpm);
        setGridResolutionA(initialGridRes);
        setCachedWaveformA(waveform);
      } else {
        setCuePointB(0);
        setFirstBeatOffsetB(initialOffset);
        setAutoFirstBeatOffsetB(initialOffset);
        setAutoBaseBpmB(baseBpm);
        setGridResolutionB(initialGridRes);
        setCachedWaveformB(waveform);
      }

      // Reset cached LED states for this deck when changing tracks so hardware LEDs re-sync cleanly
      const deckLedSuffix = `_${targetDeck}_LED`;
      Object.keys(prevSentLedMapRef.current).forEach((key) => {
        if (key.endsWith(deckLedSuffix)) {
          delete prevSentLedMapRef.current[key];
        }
      });

      updater((d) => ({
        ...d,
        trackId: track.id,
        title: `${baseBpm.toFixed(1)} - ${track.artist} - ${track.title}`,
        artist: `<${track.genre || 'Unknown'}>`,
        key: track.key || 'Unknown',
        baseBpm,
        currentBpm: Number((baseBpm * (1 + d.pitchPercent / 100)).toFixed(1)),
        durationSec: Number(realDur.toFixed(2)),
        positionSec: 0,
        isPlaying: false,
        isCueing: false,
        hotCues:
          d.trackId === track.id && d.hotCues?.length === 8
            ? d.hotCues
            : createEmptyHotCues(),
        loop: {
          ...d.loop,
          active: false,
          inPointSec: null,
          outPointSec: null,
        },
      }));

      if (switchToDecksView) {
        closeLibraryAndReturn();
      }
    },
    [closeLibraryAndReturn]
  );

  // Load & analyze a Google Drive audio file on demand into Deck A or Deck B
  const handleLoadGoogleDriveFile = useCallback(
    async (
      driveItem: GoogleDriveAudioFileItem,
      targetDeck: 'A' | 'B',
      closeLibraryAfterLoad = true
    ) => {
      const savedTrack =
        await importManager.loadAndAnalyzeGoogleDriveFile(driveItem);
      if (savedTrack) {
        await loadStoredTrackToDeck(
          savedTrack,
          targetDeck,
          closeLibraryAfterLoad
        );
      }
    },
    [loadStoredTrackToDeck]
  );

  // Initialize persistent local database & subscribe to sequential import/analysis queue
  useEffect(() => {
    const unsubscribe = importManager.subscribe(
      async (tracks, status, regFolders) => {
        setStoredTracks(tracks);
        setQueueStatus(status);
        setRegisteredFolders(regFolders);

        const curA = deckARef.current.trackId;
        const curB = deckBRef.current.trackId;
        if (curA) {
          const wfA = await trackDatabase.getWaveform(curA);
          if (wfA) setCachedWaveformA(wfA);
          const recA = tracks.find((t) => t.id === curA);
          if (recA && recA.analysisStatus === 'READY' && recA.bpm) {
            setFirstBeatOffsetA(recA.firstBeatOffsetSec || 0);
            setAutoFirstBeatOffsetA(recA.firstBeatOffsetSec || 0);
            setAutoBaseBpmA(recA.bpm);
            setDeckA((d) => ({
              ...d,
              key: recA.key || d.key,
              baseBpm: recA.bpm || d.baseBpm,
              currentBpm: Number(
                ((recA.bpm || d.baseBpm) * (1 + d.pitchPercent / 100)).toFixed(
                  1
                )
              ),
              durationSec: recA.durationSec || d.durationSec,
            }));
          }
        }
        if (curB) {
          const wfB = await trackDatabase.getWaveform(curB);
          if (wfB) setCachedWaveformB(wfB);
          const recB = tracks.find((t) => t.id === curB);
          if (recB && recB.analysisStatus === 'READY' && recB.bpm) {
            setFirstBeatOffsetB(recB.firstBeatOffsetSec || 0);
            setAutoFirstBeatOffsetB(recB.firstBeatOffsetSec || 0);
            setAutoBaseBpmB(recB.bpm);
            setDeckB((d) => ({
              ...d,
              key: recB.key || d.key,
              baseBpm: recB.bpm || d.baseBpm,
              currentBpm: Number(
                ((recB.bpm || d.baseBpm) * (1 + d.pitchPercent / 100)).toFixed(
                  1
                )
              ),
              durationSec: recB.durationSec || d.durationSec,
            }));
          }
        }
      }
    );

    (async () => {
      const initialTracks = await importManager.initializeLocalLibrary();
      await stemPreparationQueue.recoverInterruptedJobsOnStartup();
      const [savedPlaylists, savedFolders] = await Promise.all([
        trackDatabase.getAllPlaylists(),
        trackDatabase.getAllRegisteredFolders(),
      ]);
      setPlaylists(savedPlaylists);
      setRegisteredFolders(savedFolders);

      if (!initialDecksLoadedRef.current && initialTracks.length > 0) {
        initialDecksLoadedRef.current = true;
        const first = initialTracks[0];
        const second = initialTracks[1] || initialTracks[0];
        await loadStoredTrackToDeck(first, 'A', false);
        await loadStoredTrackToDeck(second, 'B', false);
      }
    })();

    return () => {
      unsubscribe();
    };
  }, [loadStoredTrackToDeck]);

  // Subscribe to Offline Per-Song Stem Preparation Queue
  useEffect(() => {
    const unsubQueue = stemPreparationQueue.subscribe((status, updatedTrack) => {
      setStemQueueStatus(status);
      if (updatedTrack) {
        setStoredTracks((prev) => {
          const idx = prev.findIndex((t) => t.id === updatedTrack.id);
          if (idx < 0) return prev;
          const cur = prev[idx];
          if (
            cur.stemPreparationStatus === updatedTrack.stemPreparationStatus &&
            cur.stemPreparationProgress === updatedTrack.stemPreparationProgress &&
            cur.stemPreparedAt === updatedTrack.stemPreparedAt
          ) {
            return prev;
          }
          const next = [...prev];
          next[idx] = updatedTrack;
          return next;
        });
      }
    });

    const unsubReady = stemPreparationQueue.onTrackStemsReady((trackId) => {
      // Fundamental Rule: Preparation completion must NEVER change or switch the active audio pipeline automatically.
      // Stems remain stored and cached until the user explicitly toggles a stem performance pad.
      if (deckARef.current.trackId === trackId) {
        setStemNoticeA(null);
      }
      if (deckBRef.current.trackId === trackId) {
        setStemNoticeB(null);
      }
    });

    return () => {
      unsubQueue();
      unsubReady();
    };
  }, []);

  // Synchronize Deck A DSP nodes when Deck A EQ/Volume/Gain/Pitch/KeyLock changes
  useEffect(() => {
    if (!realAudioEngine.deckA) return;
    realAudioEngine.deckA.setInputGain(deckA.eq.gain);
    realAudioEngine.deckA.setChannelVolume(deckA.volumeFader);
    realAudioEngine.deckA.setEq(deckA.eq.low, deckA.eq.mid, deckA.eq.high);
    realAudioEngine.deckA.setBipolarFilter(deckA.eq.filter);
    realAudioEngine.deckA.setPitchPercent(deckA.pitchPercent);
    realAudioEngine.deckA.setKeyLock(deckA.keyLock);
  }, [
    deckA.eq.gain,
    deckA.eq.low,
    deckA.eq.mid,
    deckA.eq.high,
    deckA.eq.filter,
    deckA.volumeFader,
    deckA.pitchPercent,
    deckA.keyLock,
  ]);

  // Synchronize Deck B DSP nodes when Deck B EQ/Volume/Gain/Pitch/KeyLock changes
  useEffect(() => {
    if (!realAudioEngine.deckB) return;
    realAudioEngine.deckB.setInputGain(deckB.eq.gain);
    realAudioEngine.deckB.setChannelVolume(deckB.volumeFader);
    realAudioEngine.deckB.setEq(deckB.eq.low, deckB.eq.mid, deckB.eq.high);
    realAudioEngine.deckB.setBipolarFilter(deckB.eq.filter);
    realAudioEngine.deckB.setPitchPercent(deckB.pitchPercent);
    realAudioEngine.deckB.setKeyLock(deckB.keyLock);
  }, [
    deckB.eq.gain,
    deckB.eq.low,
    deckB.eq.mid,
    deckB.eq.high,
    deckB.eq.filter,
    deckB.volumeFader,
    deckB.pitchPercent,
    deckB.keyLock,
  ]);

  // Synchronize Mixer Crossfader, Master Output & Headphone Cue Level
  useEffect(() => {
    if (!realAudioEngine.mixerEngine) return;
    realAudioEngine.mixerEngine.setCrossfader(mixer.crossfader);
    realAudioEngine.mixerEngine.setMasterLevel(mixer.masterLevel);
    realAudioEngine.mixerEngine.setHeadphoneLevel(mixer.headphoneLevel);
  }, [mixer.crossfader, mixer.masterLevel, mixer.headphoneLevel]);

  // Synchronize Real Per-Deck Beat-Synced FX Chains
  useEffect(() => {
    if (realAudioEngine.deckA && fxSlots[0]) {
      realAudioEngine.deckA.setFx(
        fxSlots[0].name,
        fxSlots[0].active,
        fxSlots[0].wetDry,
        fxCoordA.x,
        deckA.currentBpm
      );
    }
    if (realAudioEngine.deckB && fxSlots[1]) {
      realAudioEngine.deckB.setFx(
        fxSlots[1].name,
        fxSlots[1].active,
        fxSlots[1].wetDry,
        fxCoordB.x,
        deckB.currentBpm
      );
    }
  }, [
    fxSlots,
    fxCoordA.x,
    fxCoordB.x,
    deckA.currentBpm,
    deckB.currentBpm,
  ]);

  // Synchronize Real-Time 4-Stem Separation & Stem FX (Pads 1-8) independently per Deck
  useEffect(() => {
    if (realAudioEngine.deckA) {
      realAudioEngine.deckA.setStemState(stemsA, deckA.currentBpm);
    }
  }, [stemsA, deckA.currentBpm]);

  useEffect(() => {
    if (realAudioEngine.deckB) {
      realAudioEngine.deckB.setStemState(stemsB, deckB.currentBpm);
    }
  }, [stemsB, deckB.currentBpm]);

  // High-Precision requestAnimationFrame Loop for Audio Playhead, Loop Enforcer, Platter & VU Meter
  useEffect(() => {
    let rafId = 0;
    let lastUiCommitTime = performance.now();

    const tick = (now: number) => {
      const elapsedUiMs = now - lastUiCommitTime;
      const engA = realAudioEngine.deckA;
      const engB = realAudioEngine.deckB;
      const playingA = engA?.isPlaying() || false;
      const playingB = engB?.isPlaying() || false;
      const scratchA = engA?.getIsScratchActive() || false;
      const scratchB = engB?.getIsScratchActive() || false;

      // When completely paused and no scratch active, throttle loop checks to save CPU/battery
      if (!playingA && !playingB && !scratchA && !scratchB) {
        if (elapsedUiMs < 100) {
          rafId = requestAnimationFrame(tick);
          return;
        }
      } else if (elapsedUiMs < 33) {
        // 30 FPS cap during active playback provides silky smooth UI while cutting React render load in half
        rafId = requestAnimationFrame(tick);
        return;
      }

      const dtSec = Math.min(0.1, Math.max(0.001, elapsedUiMs / 1000));
      lastUiCommitTime = now;

      if (engA) {
        let posA = engA.getCurrentTime();
        const curA = deckARef.current;

        if (
          playingA &&
          curA.loop.active &&
          curA.loop.inPointSec !== null &&
          curA.loop.outPointSec !== null &&
          posA >= curA.loop.outPointSec
        ) {
          engA.seek(curA.loop.inPointSec);
          posA = curA.loop.inPointSec;
        }

        if (playingA || scratchA || playingA !== curA.isPlaying) {
          const nextPosFixed = Number(posA.toFixed(2));
          if (
            playingA !== curA.isPlaying ||
            scratchA ||
            Math.abs(curA.positionSec - nextPosFixed) >= 0.08
          ) {
            setDeckA((d) => ({
              ...d,
              isPlaying: playingA,
              positionSec: nextPosFixed,
            }));
          }
        }

        // Beat-Grid-locked SYNC LED for Deck A
        if (playingA && curA.trackId && curA.durationSec > 0) {
          const baseBpmA = Math.max(
            30,
            curA.baseBpm || curA.currentBpm || 120
          );
          const gridResA = Math.max(0.25, gridResolutionARef.current);
          const trackBeatDurA = 60 / (baseBpmA * gridResA);
          const beatIndexA = Math.floor(
            (posA - firstBeatOffsetARef.current) / trackBeatDurA
          );
          const nextPulseA = ((beatIndexA % 2) + 2) % 2 === 0;
          if (nextPulseA !== syncBeatPulseARef.current) {
            syncBeatPulseARef.current = nextPulseA;
            setSyncBeatPulseA(nextPulseA);
          }
        } else if (syncBeatPulseARef.current) {
          syncBeatPulseARef.current = false;
          setSyncBeatPulseA(false);
        }
      }

      if (engB) {
        let posB = engB.getCurrentTime();
        const curB = deckBRef.current;

        if (
          playingB &&
          curB.loop.active &&
          curB.loop.inPointSec !== null &&
          curB.loop.outPointSec !== null &&
          posB >= curB.loop.outPointSec
        ) {
          engB.seek(curB.loop.inPointSec);
          posB = curB.loop.inPointSec;
        }

        if (playingB || scratchB || playingB !== curB.isPlaying) {
          const nextPosFixed = Number(posB.toFixed(2));
          if (
            playingB !== curB.isPlaying ||
            scratchB ||
            Math.abs(curB.positionSec - nextPosFixed) >= 0.08
          ) {
            setDeckB((d) => ({
              ...d,
              isPlaying: playingB,
              positionSec: nextPosFixed,
            }));
          }
        }

        // Beat-Grid-locked SYNC LED for Deck B
        if (playingB && curB.trackId && curB.durationSec > 0) {
          const baseBpmB = Math.max(
            30,
            curB.baseBpm || curB.currentBpm || 120
          );
          const gridResB = Math.max(0.25, gridResolutionBRef.current);
          const trackBeatDurB = 60 / (baseBpmB * gridResB);
          const beatIndexB = Math.floor(
            (posB - firstBeatOffsetBRef.current) / trackBeatDurB
          );
          const nextPulseB = ((beatIndexB % 2) + 2) % 2 === 0;
          if (nextPulseB !== syncBeatPulseBRef.current) {
            syncBeatPulseBRef.current = nextPulseB;
            setSyncBeatPulseB(nextPulseB);
          }
        } else if (syncBeatPulseBRef.current) {
          syncBeatPulseBRef.current = false;
          setSyncBeatPulseB(false);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Helper to update X/Y FX Pad coordinates smoothly on touch/drag
  const updateFxPadFromClientPoint = (
    deck: 'A' | 'B',
    clientX: number,
    clientY: number,
    forceEngage = false
  ) => {
    const padEl = deck === 'A' ? fxPadARef.current : fxPadBRef.current;
    if (!padEl) return;
    const rect = padEl.getBoundingClientRect();
    const x = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))
    );
    const y = Math.min(
      1,
      Math.max(0, 1 - (clientY - rect.top) / Math.max(1, rect.height))
    );

    if (deck === 'A') {
      setFxCoordA({ x, y });
      setFxSlots((prev) =>
        prev.map((s, idx) =>
          idx === 0
            ? {
                ...s,
                active: forceEngage ? true : s.active,
                wetDry: Math.round(y * 100),
              }
            : s
        )
      );
    } else {
      setFxCoordB({ x, y });
      setFxSlots((prev) =>
        prev.map((s, idx) =>
          idx === 1
            ? {
                ...s,
                active: forceEngage ? true : s.active,
                wetDry: Math.round(y * 100),
              }
            : s
        )
      );
    }
  };

  // Shared Real Deck Transport & Performance Handlers
  const createDeckHandlers = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<DeckState>>,
      deckId: 'A' | 'B'
    ) => {
      const getDeckEngine = () => {
        const { deckA: engA, deckB: engB } = realAudioEngine.ensureInitialized();
        return deckId === 'A' ? engA : engB;
      };

      return {
        onTogglePlay: () => {
          const eng = getDeckEngine();
          const currentlyPlaying = eng.isPlaying();
          if (currentlyPlaying) {
            eng.pause();
          } else {
            eng.play();
          }
          const nextPlay = !currentlyPlaying;
          setter((d) => ({
            ...d,
            isPlaying: nextPlay,
            isCueing: false,
            positionSec: Number(eng.getCurrentTime().toFixed(2)),
          }));
        },

        onTogglePfl: () => {
          setter((d) => ({
            ...d,
            pflHeadphoneCue: !d.pflHeadphoneCue,
          }));
        },

        onCueDown: () => {
          const eng = getDeckEngine();
          const res = eng.handleCueDown();
          if (deckId === 'A') setCuePointA(res.cuePointSec);
          else setCuePointB(res.cuePointSec);
          setter((d) => ({
            ...d,
            isPlaying: res.isPlaying,
            isCueing: true,
            positionSec: Number(res.positionSec.toFixed(2)),
          }));
        },

        onCueUp: () => {
          const eng = getDeckEngine();
          const res = eng.handleCueUp();
          setter((d) => ({
            ...d,
            isPlaying: res ? res.isPlaying : d.isPlaying,
            isCueing: false,
            positionSec: res
              ? Number(res.positionSec.toFixed(2))
              : d.positionSec,
          }));
        },

        onToggleSync: () => {
          const { deckA: engA, deckB: engB } =
            realAudioEngine.ensureInitialized();
          const eng = deckId === 'A' ? engA : engB;
          const otherEng = deckId === 'A' ? engB : engA;
          const otherDeck =
            deckId === 'A' ? deckBRef.current : deckARef.current;
          const myOffset =
            deckId === 'A'
              ? firstBeatOffsetARef.current
              : firstBeatOffsetBRef.current;
          const otherOffset =
            deckId === 'A'
              ? firstBeatOffsetBRef.current
              : firstBeatOffsetARef.current;

          setter((d) => {
            const nextSync = !d.isSyncActive;
            if (!nextSync) {
              return {
                ...d,
                isSyncActive: false,
              };
            }

            // 1. Match BPM & Tempo to the other deck
            const targetBpm =
              otherDeck.currentBpm > 0 ? otherDeck.currentBpm : d.currentBpm;
            const rawPitch =
              ((targetBpm - d.baseBpm) / Math.max(1, d.baseBpm)) * 100;
            const nextPitch = Number(rawPitch.toFixed(2));
            const absPitch = Math.abs(nextPitch);
            const nextRange: 8 | 16 | 50 =
              absPitch > 16 ? 50 : absPitch > 8 ? 16 : d.pitchRange;

            eng.setPitchPercent(nextPitch);

            // 2. Beat Grid Phase Alignment using each deck's true track-time Beat Grid
            const myGridRes = Math.max(
              0.25,
              deckId === 'A'
                ? gridResolutionARef.current
                : gridResolutionBRef.current
            );
            const otherGridRes = Math.max(
              0.25,
              deckId === 'A'
                ? gridResolutionBRef.current
                : gridResolutionARef.current
            );
            const myTrackBeatDur =
              60 / (Math.max(30, d.baseBpm || targetBpm) * myGridRes);
            const otherTrackBeatDur =
              60 /
              (Math.max(30, otherDeck.baseBpm || otherDeck.currentBpm || targetBpm) *
                otherGridRes);

            const myPos = eng.getCurrentTime();
            const dur = eng.getDuration() || d.durationSec;
            let alignedPos = myPos;

            if (eng.isPlaying()) {
              // Deck is playing: lock beat phase to the other deck's corrected Beat Grid
              const otherPos = otherEng.isPlaying()
                ? otherEng.getCurrentTime()
                : otherDeck.positionSec;
              const otherBeatPhase =
                ((((otherPos - otherOffset) / otherTrackBeatDur) % 1) + 1) % 1;
              const myBeatPhase =
                ((((myPos - myOffset) / myTrackBeatDur) % 1) + 1) % 1;

              let phaseDiff = otherBeatPhase - myBeatPhase;
              if (phaseDiff > 0.5) phaseDiff -= 1;
              if (phaseDiff < -0.5) phaseDiff += 1;

              alignedPos = Math.max(
                0,
                dur > 0
                  ? Math.min(dur, myPos + phaseDiff * myTrackBeatDur)
                  : myPos + phaseDiff * myTrackBeatDur
              );
              eng.seek(alignedPos);
            } else {
              // Deck is paused: keep Beat Grid aligned and snap playhead if slightly off a beat
              const nearestBeatIdx = Math.round(
                (myPos - myOffset) / myTrackBeatDur
              );
              const nearestBeatSec =
                myOffset + nearestBeatIdx * myTrackBeatDur;
              if (
                nearestBeatSec >= 0 &&
                nearestBeatSec <= dur &&
                Math.abs(myPos - nearestBeatSec) < myTrackBeatDur * 0.25
              ) {
                alignedPos = nearestBeatSec;
                eng.seek(alignedPos);
              }
            }

            return {
              ...d,
              isSyncActive: true,
              currentBpm: Number(targetBpm.toFixed(1)),
              pitchPercent: nextPitch,
              pitchRange: nextRange,
              positionSec: Number(alignedPos.toFixed(3)),
            };
          });
        },

        onChangePitch: (pitchPercent: number) => {
          const eng = getDeckEngine();
          eng.setPitchPercent(pitchPercent);
          setter((d) => ({
            ...d,
            pitchPercent,
            currentBpm: Number(
              (d.baseBpm * (1 + pitchPercent / 100)).toFixed(1)
            ),
          }));
        },

        onTriggerHotCue: (index: number, clearMode = false) => {
          const eng = getDeckEngine();
          const realNowPos = Number(eng.getCurrentTime().toFixed(2));
          setter((d) => {
            const target = d.hotCues.find((c) => c.index === index);
            if (!target) return d;
            if (clearMode) {
              return {
                ...d,
                hotCues: d.hotCues.map((c) =>
                  c.index === index
                    ? { ...c, active: false, positionSec: null, label: 'EMPTY' }
                    : c
                ),
              };
            }
            if (target.active && target.positionSec !== null) {
              eng.seek(target.positionSec);
              return { ...d, positionSec: target.positionSec };
            }
            return {
              ...d,
              hotCues: d.hotCues.map((c) =>
                c.index === index
                  ? {
                      ...c,
                      active: true,
                      positionSec: realNowPos,
                      label: `CUE ${index}`,
                    }
                  : c
              ),
            };
          });
        },

        onToggleLoop: () => {
          const eng = getDeckEngine();
          const realNowPos = Number(eng.getCurrentTime().toFixed(2));
          setter((d) => {
            const nextActive = !d.loop.active;
            const beatDuration = 60 / Math.max(60, d.currentBpm);
            const loopSpan = beatDuration * d.loop.lengthBeats;
            return {
              ...d,
              loop: {
                ...d.loop,
                active: nextActive,
                inPointSec: realNowPos,
                outPointSec: Number((realNowPos + loopSpan).toFixed(2)),
              },
            };
          });
        },

        onStepLoopLength: (direction: -1 | 1) => {
          const eng = getDeckEngine();
          const realNowPos = Number(eng.getCurrentTime().toFixed(2));
          setter((d) => {
            const currentIdx = LOOP_BEAT_STEPS.indexOf(d.loop.lengthBeats);
            const nextIdx = Math.min(
              LOOP_BEAT_STEPS.length - 1,
              Math.max(0, (currentIdx === -1 ? 4 : currentIdx) + direction)
            );
            const nextBeats = LOOP_BEAT_STEPS[nextIdx];
            const beatDuration = 60 / Math.max(60, d.currentBpm);
            const inPt = d.loop.inPointSec ?? realNowPos;
            return {
              ...d,
              loop: {
                ...d.loop,
                lengthBeats: nextBeats,
                inPointSec: Number(inPt.toFixed(2)),
                outPointSec: Number(
                  (inPt + beatDuration * nextBeats).toFixed(2)
                ),
              },
            };
          });
        },

        onSeek: (seconds: number) => {
          const eng = getDeckEngine();
          eng.seek(seconds);
          setter((d) => ({ ...d, positionSec: seconds }));
        },

        onNudgeJog: (deltaDeg: number) => {
          const eng = getDeckEngine();
          const isVinylActive =
            deckId === 'A' ? vinylModeARef.current : vinylModeBRef.current;

          if (isVinylActive) {
            // Scratch/Vinyl Mode Active -> Real Audible Varispeed Vinyl Scratch
            const nextSec = eng.performVinylScratch(deltaDeg);
            setter((d) => ({
              ...d,
              jogAngleDeg: (d.jogAngleDeg + deltaDeg * 1.15 + 360) % 360,
              positionSec: Number(nextSec.toFixed(3)),
            }));
          } else {
            // Normal Mode (Vinyl OFF) -> Smooth VirtualDJ-style Pitch Bend / Micro-Nudge (few ms)
            const nextSec = eng.nudgePitchBend(deltaDeg);
            setter((d) => ({
              ...d,
              jogAngleDeg: (d.jogAngleDeg + deltaDeg * 0.45 + 360) % 360,
              positionSec: Number(nextSec.toFixed(3)),
            }));
          }
        },

        onReleaseJog: () => {
          const eng = getDeckEngine();
          eng.endScratch(true);
        },

        onPitchBendStep: (deltaDeg: number) => {
          const eng = getDeckEngine();
          const nextSec = eng.nudgePitchBend(deltaDeg);
          setter((d) => ({
            ...d,
            jogAngleDeg: (d.jogAngleDeg + deltaDeg * 0.45 + 360) % 360,
            positionSec: Number(nextSec.toFixed(3)),
          }));
        },
      };
    },
    []
  );

  // Beat Grid Calibration & Editing Actions (Independent per Deck A / Deck B)
  const persistDeckBeatGridToDb = useCallback(
    async (
      deckId: 'A' | 'B',
      nextOffsetSec: number,
      nextBaseBpm?: number,
      nextGridRes?: number
    ) => {
      const trackId =
        deckId === 'A' ? deckARef.current.trackId : deckBRef.current.trackId;
      if (!trackId) return;
      const existing = storedTracksRef.current.find((t) => t.id === trackId);
      if (!existing) return;
      const updated: StoredTrackRecord = {
        ...existing,
        firstBeatOffsetSec: Number(Math.max(0, nextOffsetSec).toFixed(3)),
        bpm: nextBaseBpm && nextBaseBpm > 0 ? nextBaseBpm : existing.bpm,
        beatGridResolution:
          nextGridRes !== undefined
            ? nextGridRes
            : existing.beatGridResolution ?? 1,
      };
      await trackDatabase.saveTrack(updated);
      setStoredTracks((prev) =>
        prev.map((t) => (t.id === trackId ? updated : t))
      );
    },
    []
  );

  const shiftBeatGrid = useCallback(
    (deckId: 'A' | 'B', deltaSec: number) => {
      if (deckId === 'A') {
        setFirstBeatOffsetA((prev) => {
          const next = Number(Math.max(0, prev + deltaSec).toFixed(3));
          persistDeckBeatGridToDb('A', next);
          return next;
        });
      } else {
        setFirstBeatOffsetB((prev) => {
          const next = Number(Math.max(0, prev + deltaSec).toFixed(3));
          persistDeckBeatGridToDb('B', next);
          return next;
        });
      }
    },
    [persistDeckBeatGridToDb]
  );

  const scaleBeatGridBpm = useCallback(
    (deckId: 'A' | 'B', factor: 0.5 | 2) => {
      const setter = deckId === 'A' ? setDeckA : setDeckB;
      setter((d) => {
        const candidateBase = Number((d.baseBpm * factor).toFixed(2));
        if (candidateBase < 35 || candidateBase > 260) return d;
        const nextCurrent = Number(
          (candidateBase * (1 + d.pitchPercent / 100)).toFixed(1)
        );
        const offset =
          deckId === 'A'
            ? firstBeatOffsetARef.current
            : firstBeatOffsetBRef.current;
        persistDeckBeatGridToDb(deckId, offset, candidateBase);
        return {
          ...d,
          baseBpm: candidateBase,
          currentBpm: nextCurrent,
        };
      });
    },
    [persistDeckBeatGridToDb]
  );

  const cycleBeatGridResolution = useCallback(
    (deckId: 'A' | 'B') => {
      const stepRes = (cur: number) => (cur === 1 ? 2 : cur === 2 ? 0.5 : 1);
      if (deckId === 'A') {
        setGridResolutionA((cur) => {
          const next = stepRes(cur);
          persistDeckBeatGridToDb(
            'A',
            firstBeatOffsetARef.current,
            undefined,
            next
          );
          return next;
        });
      } else {
        setGridResolutionB((cur) => {
          const next = stepRes(cur);
          persistDeckBeatGridToDb(
            'B',
            firstBeatOffsetBRef.current,
            undefined,
            next
          );
          return next;
        });
      }
    },
    [persistDeckBeatGridToDb]
  );

  const setManualFirstBeatAtPlayhead = useCallback(
    (deckId: 'A' | 'B') => {
      const { deckA: engA, deckB: engB } = realAudioEngine.ensureInitialized();
      const pos =
        deckId === 'A' ? engA.getCurrentTime() : engB.getCurrentTime();
      const clamped = Number(Math.max(0, pos).toFixed(3));
      if (deckId === 'A') {
        setFirstBeatOffsetA(clamped);
      } else {
        setFirstBeatOffsetB(clamped);
      }
      persistDeckBeatGridToDb(deckId, clamped);
    },
    [persistDeckBeatGridToDb]
  );

  const recalibrateDeckBeatGrid = useCallback((deckId: 'A' | 'B') => {
    const trackId =
      deckId === 'A' ? deckARef.current.trackId : deckBRef.current.trackId;
    if (trackId) {
      importManager.reanalyzeTrack(trackId);
    }
  }, []);

  const resetDeckBeatGridToAuto = useCallback(
    (deckId: 'A' | 'B') => {
      if (deckId === 'A') {
        setFirstBeatOffsetA(autoFirstBeatOffsetA);
        setGridResolutionA(1);
        setDeckA((d) => ({
          ...d,
          baseBpm: autoBaseBpmA,
          currentBpm: Number(
            (autoBaseBpmA * (1 + d.pitchPercent / 100)).toFixed(1)
          ),
        }));
        persistDeckBeatGridToDb('A', autoFirstBeatOffsetA, autoBaseBpmA);
      } else {
        setFirstBeatOffsetB(autoFirstBeatOffsetB);
        setGridResolutionB(1);
        setDeckB((d) => ({
          ...d,
          baseBpm: autoBaseBpmB,
          currentBpm: Number(
            (autoBaseBpmB * (1 + d.pitchPercent / 100)).toFixed(1)
          ),
        }));
        persistDeckBeatGridToDb('B', autoFirstBeatOffsetB, autoBaseBpmB);
      }
    },
    [
      autoFirstBeatOffsetA,
      autoFirstBeatOffsetB,
      autoBaseBpmA,
      autoBaseBpmB,
      persistDeckBeatGridToDb,
    ]
  );

  const deckAHandlers = useMemo(
    () => createDeckHandlers(setDeckA, 'A'),
    [createDeckHandlers]
  );
  const deckBHandlers = useMemo(
    () => createDeckHandlers(setDeckB, 'B'),
    [createDeckHandlers]
  );

  // ============================================================================
  // PERFORMANCE PADS HANDLERS (8 Pads per Deck · 4 Pages: HOT_CUES, BEAT_JUMP, STEMS, SAMPLER)
  // ============================================================================
  const handleStopSamplerPad = useCallback(
    (deckId: 'A' | 'B', padIndex: number) => {
      const slotKey = `${deckId}:${padIndex}`;
      realAudioEngine.stopSamplerSlot(slotKey);
      const setter = deckId === 'A' ? setSamplerPadsA : setSamplerPadsB;
      setter((prev) =>
        prev.map((s) =>
          s.padIndex === padIndex ? { ...s, isPlaying: false } : s
        )
      );
    },
    []
  );

  const handleToggleSamplerPadLoop = useCallback(
    (deckId: 'A' | 'B', padIndex: number) => {
      const setter = deckId === 'A' ? setSamplerPadsA : setSamplerPadsB;
      setter((prev) =>
        prev.map((s) => {
          if (s.padIndex !== padIndex) return s;
          const nextLoop = !s.loopEnabled;
          if (!nextLoop && s.isPlaying) {
            realAudioEngine.stopSamplerSlot(`${deckId}:${padIndex}`);
            return { ...s, loopEnabled: false, isPlaying: false };
          }
          return { ...s, loopEnabled: nextLoop };
        })
      );
    },
    []
  );

  const handleChangeSamplerPadVolume = useCallback(
    (deckId: 'A' | 'B', padIndex: number, volume: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(volume)));
      realAudioEngine.setSamplerSlotVolume(
        `${deckId}:${padIndex}`,
        clamped,
        samplerGainRef.current
      );
      const setter = deckId === 'A' ? setSamplerPadsA : setSamplerPadsB;
      setter((prev) =>
        prev.map((s) =>
          s.padIndex === padIndex ? { ...s, volume: clamped } : s
        )
      );
    },
    []
  );

  const handleTriggerPerformancePad = useCallback(
    (deckId: 'A' | 'B', padIndex: number) => {
      if (padIndex < 1 || padIndex > 8) return;
      const activePage =
        deckId === 'A' ? padPageARef.current : padPageBRef.current;
      const handlers = deckId === 'A' ? deckAHandlers : deckBHandlers;
      const clearMode = deckId === 'A' ? clearCueModeA : clearCueModeB;

      if (activePage === 'HOT_CUES') {
        handlers.onTriggerHotCue(padIndex, clearMode);
        return;
      }

      if (activePage === 'BEAT_JUMP') {
        const presetId =
          deckId === 'A'
            ? beatJumpPresetARef.current
            : beatJumpPresetBRef.current;
        const jumpBeats =
          BEAT_JUMP_PRESETS[presetId].steps[padIndex - 1] ?? 4;
        const { deckA: engA, deckB: engB } =
          realAudioEngine.ensureInitialized();
        const eng = deckId === 'A' ? engA : engB;
        const deck = deckId === 'A' ? deckARef.current : deckBRef.current;
        const firstBeatOffsetSec =
          deckId === 'A'
            ? firstBeatOffsetARef.current
            : firstBeatOffsetBRef.current;
        const gridResolutionMultiplier =
          deckId === 'A'
            ? gridResolutionARef.current
            : gridResolutionBRef.current;
        const currentPos = eng.getCurrentTime();
        const dur = eng.getDuration() || deck.durationSec;

        const targetSec = computeBeatJumpTargetSec({
          positionSec: currentPos,
          durationSec: dur,
          baseBpm: deck.baseBpm,
          currentBpm: deck.currentBpm,
          firstBeatOffsetSec,
          gridResolutionMultiplier,
          jumpBeats,
        });
        handlers.onSeek(targetSec);
        return;
      }

      if (activePage === 'STEMS') {
        const { deckA: engA, deckB: engB } =
          realAudioEngine.ensureInitialized();
        const eng = deckId === 'A' ? engA : engB;
        const deck = deckId === 'A' ? deckARef.current : deckBRef.current;
        const trackRec = storedTracksRef.current.find(
          (t) => t.id === deck.trackId
        );
        const isTrackPrepared =
          eng.areStemsPrepared() ||
          trackRec?.stemPreparationStatus === 'READY';

        // If the loaded song does NOT have prepared stems, NEVER run real-time separation
        // and NEVER cut/mute the audio. Keep full mix playing cleanly and show a notice.
        if (!isTrackPrepared) {
          const msg =
            trackRec?.stemPreparationStatus === 'PREPARING'
              ? `Preparando pistas (${trackRec.stemPreparationProgress || 0}%)... El audio continúa en mezcla completa.`
              : 'Esta canción aún no tiene separación de pistas preparada (Menú ⋮ → Preparar separación de pistas).';
          if (deckId === 'A') {
            setStemNoticeA(msg);
            if (stemNoticeTimerARef.current) {
              clearTimeout(stemNoticeTimerARef.current);
            }
            stemNoticeTimerARef.current = setTimeout(
              () => setStemNoticeA(null),
              5000
            );
          } else {
            setStemNoticeB(msg);
            if (stemNoticeTimerBRef.current) {
              clearTimeout(stemNoticeTimerBRef.current);
            }
            stemNoticeTimerBRef.current = setTimeout(
              () => setStemNoticeB(null),
              5000
            );
          }
          return;
        }

        if (deckId === 'A') setStemNoticeA(null);
        else setStemNoticeB(null);

        const curStems =
          deckId === 'A' ? stemsARef.current : stemsBRef.current;
        const nextStems = applyStemPadAction(curStems, padIndex);
        if (deckId === 'A') {
          stemsARef.current = nextStems;
          setStemsA(nextStems);
        } else {
          stemsBRef.current = nextStems;
          setStemsB(nextStems);
        }
        if (!eng.areStemsPrepared() && deck.trackId) {
          void eng.tryActivatePreparedStems(deck.trackId).then(() => {
            eng.setStemState(nextStems, deck.currentBpm);
          });
        }
        eng.setStemState(nextStems, deck.currentBpm);
        return;
      }

      if (activePage === 'SAMPLER') {
        const pads =
          deckId === 'A' ? samplerPadsARef.current : samplerPadsBRef.current;
        const slot = pads.find((s) => s.padIndex === padIndex);
        if (!slot) return;
        const slotKey = `${deckId}:${padIndex}`;
        const setter = deckId === 'A' ? setSamplerPadsA : setSamplerPadsB;

        // If slot is already looping and playing, pressing again stops it
        if (slot.loopEnabled && slot.isPlaying) {
          realAudioEngine.stopSamplerSlot(slotKey);
          setter((prev) =>
            prev.map((s) =>
              s.padIndex === padIndex ? { ...s, isPlaying: false } : s
            )
          );
          return;
        }

        setter((prev) =>
          prev.map((s) =>
            s.padIndex === padIndex ? { ...s, isPlaying: true } : s
          )
        );

        realAudioEngine.triggerSamplerPad(slot.name, samplerGainRef.current, {
          slotKey,
          padVolumePercent: slot.volume,
          loop: slot.loopEnabled,
          onEnded: () => {
            setter((prev) =>
              prev.map((s) =>
                s.padIndex === padIndex ? { ...s, isPlaying: false } : s
              )
            );
          },
        });
      }
    },
    [deckAHandlers, deckBHandlers, clearCueModeA, clearCueModeB]
  );

  const executeMappedAction = useCallback(
    (mapping: MidiMappingEntry, packet: MidiPacket) => {
      const actionId = mapping.actionId;
      const isNoteMsg =
        packet.command === MidiCommandType.NOTE_ON ||
        packet.command === MidiCommandType.NOTE_OFF;
      const isButtonPress = isNoteMsg
        ? packet.command === MidiCommandType.NOTE_ON && packet.data2 > 0
        : packet.data2 >= 64;
      const isButtonRelease = isNoteMsg
        ? packet.command === MidiCommandType.NOTE_OFF || packet.data2 === 0
        : packet.data2 === 0;

      const decoded = decodeContinuousControl(packet, mapping.controlMode);
      const normalizedVal =
        decoded.kind === 'ABSOLUTE' ? decoded.normalized : packet.data2 / 127;

      const getSelectedNavigableItem = (): LibraryNavigableItem | null => {
        const items = navigableLibraryItemsRef.current;
        if (items.length === 0) return null;
        const selId = libraryNavStateRef.current.selectedItemId;
        if (selId) {
          const found = items.find((it) => it.id === selId);
          if (found) return found;
        }
        if (selectedLibraryTrackIdRef.current) {
          const byTrack = items.find(
            (it) =>
              it.kind === 'TRACK' &&
              it.track?.id === selectedLibraryTrackIdRef.current
          );
          if (byTrack) return byTrack;
        }
        return items[0];
      };

      const loadSelectedTrackIntoDeck = (deck: 'A' | 'B') => {
        const selectedItem = getSelectedNavigableItem();
        // IMPORTANT: Never confuse a folder with a song.
        // If the user is in the Library and currently has a FOLDER or DRIVE_FOLDER selected, do not load it as a track.
        if (
          activeSectionRef.current === MainSection.LIBRARY &&
          selectedItem &&
          (selectedItem.kind === 'FOLDER' ||
            selectedItem.kind === 'DRIVE_FOLDER')
        ) {
          return;
        }

        if (
          selectedItem &&
          selectedItem.kind === 'DRIVE_TRACK' &&
          selectedItem.driveFile
        ) {
          const shouldCloseLibrary =
            activeSectionRef.current === MainSection.LIBRARY;
          void handleLoadGoogleDriveFile(
            selectedItem.driveFile,
            deck,
            shouldCloseLibrary
          );
          return;
        }

        if (selectedItem && selectedItem.kind === 'TRACK' && selectedItem.track) {
          const shouldCloseLibrary =
            activeSectionRef.current === MainSection.LIBRARY;
          loadStoredTrackToDeck(selectedItem.track, deck, shouldCloseLibrary);
          return;
        }

        const pool =
          visibleLibraryTracksRef.current.length > 0
            ? visibleLibraryTracksRef.current
            : storedTracksRef.current;
        if (pool.length === 0) return;
        const target =
          pool.find((t) => t.id === selectedLibraryTrackIdRef.current) ||
          storedTracksRef.current.find(
            (t) => t.id === selectedLibraryTrackIdRef.current
          ) ||
          pool[0];
        const shouldCloseLibrary =
          activeSectionRef.current === MainSection.LIBRARY;
        loadStoredTrackToDeck(target, deck, shouldCloseLibrary);
      };

      const stepLibrarySelection = (delta: number) => {
        const items = navigableLibraryItemsRef.current;
        if (items.length === 0 || delta === 0) return;

        const currentSelectedId = libraryNavStateRef.current.selectedItemId;
        let curIdx = items.findIndex((it) => it.id === currentSelectedId);
        if (curIdx === -1 && selectedLibraryTrackIdRef.current) {
          curIdx = items.findIndex(
            (it) =>
              it.kind === 'TRACK' &&
              it.track?.id === selectedLibraryTrackIdRef.current
          );
        }

        const step = delta > 0 ? 1 : -1;
        const nextIdx =
          curIdx === -1
            ? step > 0
              ? 0
              : items.length - 1
            : (curIdx + step + items.length) % items.length;
        const nextItem = items[nextIdx];
        if (!nextItem) return;

        setLibraryNavState((prev) => ({
          ...prev,
          selectedItemId: nextItem.id,
        }));
        if (nextItem.kind === 'TRACK' && nextItem.track) {
          setSelectedLibraryTrackId(nextItem.track.id);
        }
      };

      const executeSingleBackPress = () => {
        if (activeSectionRef.current !== MainSection.LIBRARY) {
          navigateToSection(MainSection.LIBRARY);
          return;
        }

        const nav = libraryNavStateRef.current;

        // If inside a Google Drive folder hierarchy -> step back to parent Drive folder
        if (
          nav.activeSource === 'GOOGLE_DRIVE' &&
          (nav.driveBreadcrumbs?.length || 0) > 0
        ) {
          const crumbs = [...(nav.driveBreadcrumbs || [])];
          const popped = crumbs.pop();
          setLibraryNavState((prev) => ({
            ...prev,
            driveBreadcrumbs: crumbs,
            selectedItemId: popped ? `gdrive-folder:${popped.id}` : null,
          }));
          return;
        }

        const currentFolder =
          nav.activeSource === 'LOCAL'
            ? nav.localCurrentFolder
            : nav.importedCurrentFolder;

        // If inside a folder or subfolder -> return to parent folder and highlight the exited folder
        if (
          nav.categoryTab === 'SONGS' &&
          (nav.activeSource === 'LOCAL' || nav.activeSource === 'IMPORTADAS') &&
          currentFolder
        ) {
          const exitedFolderPath = currentFolder;
          const segs = currentFolder.split('/').filter(Boolean);
          segs.pop();
          const parentFolder = segs.join('/');
          setLibraryNavState((prev) => ({
            ...prev,
            localCurrentFolder:
              prev.activeSource === 'LOCAL'
                ? parentFolder
                : prev.localCurrentFolder,
            importedCurrentFolder:
              prev.activeSource === 'IMPORTADAS'
                ? parentFolder
                : prev.importedCurrentFolder,
            selectedItemId: `folder:${exitedFolderPath}`,
          }));
          return;
        }

        // If inside an Album / Artist / Genre group filter -> return to group list
        if (
          (nav.categoryTab === 'ALBUMS' ||
            nav.categoryTab === 'ARTISTS' ||
            nav.categoryTab === 'GENRES') &&
          nav.selectedGroupFilter !== null
        ) {
          setLibraryNavState((prev) => ({
            ...prev,
            selectedGroupFilter: null,
          }));
          return;
        }

        // At root of current section -> exit Library while preserving navigation state
        closeLibraryAndReturn();
      };

      const executeSingleEnterPress = () => {
        if (activeSectionRef.current !== MainSection.LIBRARY) {
          navigateToSection(MainSection.LIBRARY);
          return;
        }

        const selectedItem = getSelectedNavigableItem();
        if (!selectedItem) return;

        // If selected element is a Google Drive folder -> enter that Drive folder
        if (
          selectedItem.kind === 'DRIVE_FOLDER' &&
          selectedItem.driveFolder
        ) {
          const df = selectedItem.driveFolder;
          setLibraryNavState((prev) => ({
            ...prev,
            driveBreadcrumbs: [
              ...(prev.driveBreadcrumbs || []),
              {
                id: df.id,
                name: df.name,
                driveId: df.driveId,
              },
            ],
            selectedItemId: null,
          }));
          return;
        }

        // If selected element is a FOLDER -> enter that folder
        if (selectedItem.kind === 'FOLDER' && selectedItem.folderPath) {
          const targetFolderPath = selectedItem.folderPath;
          setLibraryNavState((prev) => ({
            ...prev,
            localCurrentFolder:
              prev.activeSource === 'LOCAL'
                ? targetFolderPath
                : prev.localCurrentFolder,
            importedCurrentFolder:
              prev.activeSource === 'IMPORTADAS'
                ? targetFolderPath
                : prev.importedCurrentFolder,
            selectedItemId: null,
          }));
          return;
        }

        // If selected element is a Google Drive track -> load into target deck
        if (
          selectedItem.kind === 'DRIVE_TRACK' &&
          selectedItem.driveFile
        ) {
          void handleLoadGoogleDriveFile(
            selectedItem.driveFile,
            libraryTargetDeckRef.current,
            true
          );
          return;
        }

        // If selected element is a TRACK -> preserve selection/load behavior into target deck
        if (selectedItem.kind === 'TRACK' && selectedItem.track) {
          loadStoredTrackToDeck(
            selectedItem.track,
            libraryTargetDeckRef.current,
            true
          );
        }
      };

      const triggerSimultaneousBackEnterCombo = () => {
        if (pendingBrowserActionTimerRef.current) {
          clearTimeout(pendingBrowserActionTimerRef.current);
          pendingBrowserActionTimerRef.current = null;
        }
        pendingBrowserActionFnRef.current = null;
        browserComboTriggeredRef.current = true;

        // Restore navigation snapshot if any state had changed milliseconds earlier
        if (preBrowserButtonNavSnapshotRef.current) {
          setLibraryNavState(preBrowserButtonNavSnapshotRef.current);
        }

        // Exit Library without losing navigation state
        if (activeSectionRef.current === MainSection.LIBRARY) {
          closeLibraryAndReturn();
        }
      };

      switch (actionId) {
        // ====================================================================
        // DECK A TRANSPORT & PERFORMANCE
        // ====================================================================
        case 'DECK_A_PLAY_PAUSE': {
          const btnKey = `${mapping.midiCode}:DECK_A_PLAY_PAUSE`;
          const nowMs = performance.now();
          const lastPress = midiLastPressTimeRef.current.get(btnKey) || 0;
          const isPressed = midiPressedButtonsRef.current.has(btnKey);

          if (isButtonPress) {
            if (!isPressed && nowMs - lastPress >= 120) {
              midiPressedButtonsRef.current.add(btnKey);
              midiLastPressTimeRef.current.set(btnKey, nowMs);
              deckAHandlers.onTogglePlay();
            }
          } else if (isButtonRelease) {
            midiPressedButtonsRef.current.delete(btnKey);
          }
          break;
        }
        case 'DECK_A_CUE':
          if (isButtonPress) deckAHandlers.onCueDown();
          else if (isButtonRelease) deckAHandlers.onCueUp();
          break;
        case 'DECK_A_PFL': {
          const btnKey = `${mapping.midiCode}:DECK_A_PFL`;
          const nowMs = performance.now();
          const lastPress = midiLastPressTimeRef.current.get(btnKey) || 0;
          const isPressed = midiPressedButtonsRef.current.has(btnKey);

          if (isButtonPress) {
            if (!isPressed && nowMs - lastPress >= 120) {
              midiPressedButtonsRef.current.add(btnKey);
              midiLastPressTimeRef.current.set(btnKey, nowMs);
              deckAHandlers.onTogglePfl();
            }
          } else if (isButtonRelease) {
            midiPressedButtonsRef.current.delete(btnKey);
          }
          break;
        }
        case 'DECK_A_SYNC':
          if (isButtonPress) deckAHandlers.onToggleSync();
          break;
        case 'DECK_A_LOAD':
          // VirtualDJ Reference: LOAD -> holding 200ms ? vinyl_mode : load
          if (mapping.controlMode === 'BUTTON_HOLD_200MS') {
            midiHoldTrackerRef.current.handleButtonEvent(
              'DECK_A_LOAD',
              isButtonPress,
              200,
              () => loadSelectedTrackIntoDeck('A'),
              () => setVinylModeA((v) => !v)
            );
          } else if (isButtonPress) {
            loadSelectedTrackIntoDeck('A');
          }
          break;
        case 'DECK_A_VINYL_MODE':
          if (isButtonPress) setVinylModeA((v) => !v);
          break;
        case 'DECK_A_JOG_WHEEL': {
          const sens = vinylModeARef.current ? 2.8 : 1.1;
          if (decoded.kind === 'RELATIVE') {
            deckAHandlers.onNudgeJog(decoded.delta * sens);
          } else {
            const prev = prevAbsoluteJogRef.current.A;
            prevAbsoluteJogRef.current.A = packet.data2;
            if (prev !== null) {
              let diff = packet.data2 - prev;
              if (diff > 64) diff -= 128;
              if (diff < -64) diff += 128;
              deckAHandlers.onNudgeJog(diff * sens);
            }
          }
          break;
        }
        case 'DECK_A_PITCH_FADER':
          deckAHandlers.onChangePitch(
            Number(
              ((normalizedVal * 2 - 1) * deckARef.current.pitchRange).toFixed(2)
            )
          );
          break;
        case 'DECK_A_PITCH_BEND_PLUS':
          if (isButtonPress) deckAHandlers.onPitchBendStep(6);
          break;
        case 'DECK_A_PITCH_BEND_MINUS':
          if (isButtonPress) deckAHandlers.onPitchBendStep(-6);
          break;
        case 'DECK_A_VOLUME_INC':
          if (isButtonPress) {
            setDeckA((d) => ({
              ...d,
              volumeFader: Math.min(100, d.volumeFader + 2),
            }));
          }
          break;
        case 'DECK_A_VOLUME_DEC':
          if (isButtonPress) {
            setDeckA((d) => ({
              ...d,
              volumeFader: Math.max(0, d.volumeFader - 2),
            }));
          }
          break;
        case 'DECK_A_VOLUME':
          setDeckA((d) => ({
            ...d,
            volumeFader: Math.round(normalizedVal * 100),
          }));
          break;
        case 'DECK_A_VOLUME_FILTER':
        case 'DECK_A_FILTER':
          setDeckA((d) => ({
            ...d,
            eq: {
              ...d.eq,
              filter: Math.round((normalizedVal * 2 - 1) * 100),
            },
          }));
          break;
        case 'DECK_A_GAIN':
          setDeckA((d) => ({
            ...d,
            eq: {
              ...d.eq,
              gain: Math.round(normalizedVal * 100),
            },
          }));
          break;
        case 'DECK_A_EQ_HIGH':
          setDeckA((d) => ({
            ...d,
            eq: {
              ...d.eq,
              high: Math.round((normalizedVal * 2 - 1) * 12),
            },
          }));
          break;
        case 'DECK_A_EQ_MID':
          setDeckA((d) => ({
            ...d,
            eq: {
              ...d.eq,
              mid: Math.round((normalizedVal * 2 - 1) * 12),
            },
          }));
          break;
        case 'DECK_A_EQ_LOW':
          setDeckA((d) => ({
            ...d,
            eq: {
              ...d.eq,
              low: Math.round((normalizedVal * 2 - 1) * 12),
            },
          }));
          break;
        case 'DECK_A_FX_ON':
          if (isButtonPress) {
            setFxLockA((prev) => {
              const next = !prev;
              setFxSlots((slots) =>
                slots.map((s, idx) =>
                  idx === 0 ? { ...s, active: next } : s
                )
              );
              return next;
            });
          }
          break;
        case 'DECK_A_FX_X':
          setFxCoordA((prev) => ({ ...prev, x: normalizedVal }));
          break;
        case 'DECK_A_FX_Y':
          setFxCoordA((prev) => ({ ...prev, y: normalizedVal }));
          setFxSlots((slots) =>
            slots.map((s, idx) =>
              idx === 0
                ? {
                    ...s,
                    active: normalizedVal > 0.02 || fxLockA,
                    wetDry: Math.round(normalizedVal * 100),
                  }
                : s
            )
          );
          break;
        case 'DECK_A_LOOP_ACTIVE':
          if (isButtonPress) deckAHandlers.onToggleLoop();
          break;
        case 'DECK_A_LOOP_IN':
          if (isButtonPress) deckAHandlers.onStepLoopLength(-1);
          break;
        case 'DECK_A_LOOP_OUT':
          if (isButtonPress) deckAHandlers.onStepLoopLength(1);
          break;
        case 'DECK_A_HOTCUE_1':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(1, clearCueModeA);
          break;
        case 'DECK_A_HOTCUE_2':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(2, clearCueModeA);
          break;
        case 'DECK_A_HOTCUE_3':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(3, clearCueModeA);
          break;
        case 'DECK_A_HOTCUE_4':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(4, clearCueModeA);
          break;
        case 'DECK_A_HOTCUE_5':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(5, clearCueModeA);
          break;
        case 'DECK_A_HOTCUE_6':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(6, clearCueModeA);
          break;
        case 'DECK_A_HOTCUE_7':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(7, clearCueModeA);
          break;
        case 'DECK_A_HOTCUE_8':
          if (isButtonPress) deckAHandlers.onTriggerHotCue(8, clearCueModeA);
          break;
        case 'DECK_A_PAD_1':
          if (isButtonPress) handleTriggerPerformancePad('A', 1);
          break;
        case 'DECK_A_PAD_2':
          if (isButtonPress) handleTriggerPerformancePad('A', 2);
          break;
        case 'DECK_A_PAD_3':
          if (isButtonPress) handleTriggerPerformancePad('A', 3);
          break;
        case 'DECK_A_PAD_4':
          if (isButtonPress) handleTriggerPerformancePad('A', 4);
          break;
        case 'DECK_A_PAD_5':
          if (isButtonPress) handleTriggerPerformancePad('A', 5);
          break;
        case 'DECK_A_PAD_6':
          if (isButtonPress) handleTriggerPerformancePad('A', 6);
          break;
        case 'DECK_A_PAD_7':
          if (isButtonPress) handleTriggerPerformancePad('A', 7);
          break;
        case 'DECK_A_PAD_8':
          if (isButtonPress) handleTriggerPerformancePad('A', 8);
          break;
        case 'DECK_A_PAD_PAGE_1':
          if (isButtonPress) setPadPageA('HOT_CUES');
          break;
        case 'DECK_A_PAD_PAGE_2':
          if (isButtonPress) setPadPageA('BEAT_JUMP');
          break;
        case 'DECK_A_PAD_PAGE_3':
          if (isButtonPress) setPadPageA('STEMS');
          break;
        case 'DECK_A_PAD_PAGE_4':
          if (isButtonPress) setPadPageA('SAMPLER');
          break;

        // ====================================================================
        // DECK B TRANSPORT & PERFORMANCE
        // ====================================================================
        case 'DECK_B_PLAY_PAUSE': {
          const btnKey = `${mapping.midiCode}:DECK_B_PLAY_PAUSE`;
          const nowMs = performance.now();
          const lastPress = midiLastPressTimeRef.current.get(btnKey) || 0;
          const isPressed = midiPressedButtonsRef.current.has(btnKey);

          if (isButtonPress) {
            if (!isPressed && nowMs - lastPress >= 120) {
              midiPressedButtonsRef.current.add(btnKey);
              midiLastPressTimeRef.current.set(btnKey, nowMs);
              deckBHandlers.onTogglePlay();
            }
          } else if (isButtonRelease) {
            midiPressedButtonsRef.current.delete(btnKey);
          }
          break;
        }
        case 'DECK_B_CUE':
          if (isButtonPress) deckBHandlers.onCueDown();
          else if (isButtonRelease) deckBHandlers.onCueUp();
          break;
        case 'DECK_B_PFL': {
          const btnKey = `${mapping.midiCode}:DECK_B_PFL`;
          const nowMs = performance.now();
          const lastPress = midiLastPressTimeRef.current.get(btnKey) || 0;
          const isPressed = midiPressedButtonsRef.current.has(btnKey);

          if (isButtonPress) {
            if (!isPressed && nowMs - lastPress >= 120) {
              midiPressedButtonsRef.current.add(btnKey);
              midiLastPressTimeRef.current.set(btnKey, nowMs);
              deckBHandlers.onTogglePfl();
            }
          } else if (isButtonRelease) {
            midiPressedButtonsRef.current.delete(btnKey);
          }
          break;
        }
        case 'DECK_B_SYNC':
          if (isButtonPress) deckBHandlers.onToggleSync();
          break;
        case 'DECK_B_LOAD':
          if (mapping.controlMode === 'BUTTON_HOLD_200MS') {
            midiHoldTrackerRef.current.handleButtonEvent(
              'DECK_B_LOAD',
              isButtonPress,
              200,
              () => loadSelectedTrackIntoDeck('B'),
              () => setVinylModeB((v) => !v)
            );
          } else if (isButtonPress) {
            loadSelectedTrackIntoDeck('B');
          }
          break;
        case 'DECK_B_VINYL_MODE':
          if (isButtonPress) setVinylModeB((v) => !v);
          break;
        case 'DECK_B_JOG_WHEEL': {
          const sens = vinylModeBRef.current ? 2.8 : 1.1;
          if (decoded.kind === 'RELATIVE') {
            deckBHandlers.onNudgeJog(decoded.delta * sens);
          } else {
            const prev = prevAbsoluteJogRef.current.B;
            prevAbsoluteJogRef.current.B = packet.data2;
            if (prev !== null) {
              let diff = packet.data2 - prev;
              if (diff > 64) diff -= 128;
              if (diff < -64) diff += 128;
              deckBHandlers.onNudgeJog(diff * sens);
            }
          }
          break;
        }
        case 'DECK_B_PITCH_FADER':
          deckBHandlers.onChangePitch(
            Number(
              ((normalizedVal * 2 - 1) * deckBRef.current.pitchRange).toFixed(2)
            )
          );
          break;
        case 'DECK_B_PITCH_BEND_PLUS':
          if (isButtonPress) deckBHandlers.onPitchBendStep(6);
          break;
        case 'DECK_B_PITCH_BEND_MINUS':
          if (isButtonPress) deckBHandlers.onPitchBendStep(-6);
          break;
        case 'DECK_B_VOLUME_INC':
          if (isButtonPress) {
            setDeckB((d) => ({
              ...d,
              volumeFader: Math.min(100, d.volumeFader + 2),
            }));
          }
          break;
        case 'DECK_B_VOLUME_DEC':
          if (isButtonPress) {
            setDeckB((d) => ({
              ...d,
              volumeFader: Math.max(0, d.volumeFader - 2),
            }));
          }
          break;
        case 'DECK_B_VOLUME':
          setDeckB((d) => ({
            ...d,
            volumeFader: Math.round(normalizedVal * 100),
          }));
          break;
        case 'DECK_B_VOLUME_FILTER':
        case 'DECK_B_FILTER':
          setDeckB((d) => ({
            ...d,
            eq: {
              ...d.eq,
              filter: Math.round((normalizedVal * 2 - 1) * 100),
            },
          }));
          break;
        case 'DECK_B_GAIN':
          setDeckB((d) => ({
            ...d,
            eq: {
              ...d.eq,
              gain: Math.round(normalizedVal * 100),
            },
          }));
          break;
        case 'DECK_B_EQ_HIGH':
          setDeckB((d) => ({
            ...d,
            eq: {
              ...d.eq,
              high: Math.round((normalizedVal * 2 - 1) * 12),
            },
          }));
          break;
        case 'DECK_B_EQ_MID':
          setDeckB((d) => ({
            ...d,
            eq: {
              ...d.eq,
              mid: Math.round((normalizedVal * 2 - 1) * 12),
            },
          }));
          break;
        case 'DECK_B_EQ_LOW':
          setDeckB((d) => ({
            ...d,
            eq: {
              ...d.eq,
              low: Math.round((normalizedVal * 2 - 1) * 12),
            },
          }));
          break;
        case 'DECK_B_FX_ON':
          if (isButtonPress) {
            setFxLockB((prev) => {
              const next = !prev;
              setFxSlots((slots) =>
                slots.map((s, idx) =>
                  idx === 1 ? { ...s, active: next } : s
                )
              );
              return next;
            });
          }
          break;
        case 'DECK_B_FX_X':
          setFxCoordB((prev) => ({ ...prev, x: normalizedVal }));
          break;
        case 'DECK_B_FX_Y':
          setFxCoordB((prev) => ({ ...prev, y: normalizedVal }));
          setFxSlots((slots) =>
            slots.map((s, idx) =>
              idx === 1
                ? {
                    ...s,
                    active: normalizedVal > 0.02 || fxLockB,
                    wetDry: Math.round(normalizedVal * 100),
                  }
                : s
            )
          );
          break;
        case 'DECK_B_LOOP_ACTIVE':
          if (isButtonPress) deckBHandlers.onToggleLoop();
          break;
        case 'DECK_B_LOOP_IN':
          if (isButtonPress) deckBHandlers.onStepLoopLength(-1);
          break;
        case 'DECK_B_LOOP_OUT':
          if (isButtonPress) deckBHandlers.onStepLoopLength(1);
          break;
        case 'DECK_B_HOTCUE_1':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(1, clearCueModeB);
          break;
        case 'DECK_B_HOTCUE_2':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(2, clearCueModeB);
          break;
        case 'DECK_B_HOTCUE_3':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(3, clearCueModeB);
          break;
        case 'DECK_B_HOTCUE_4':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(4, clearCueModeB);
          break;
        case 'DECK_B_HOTCUE_5':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(5, clearCueModeB);
          break;
        case 'DECK_B_HOTCUE_6':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(6, clearCueModeB);
          break;
        case 'DECK_B_HOTCUE_7':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(7, clearCueModeB);
          break;
        case 'DECK_B_HOTCUE_8':
          if (isButtonPress) deckBHandlers.onTriggerHotCue(8, clearCueModeB);
          break;
        case 'DECK_B_PAD_1':
          if (isButtonPress) handleTriggerPerformancePad('B', 1);
          break;
        case 'DECK_B_PAD_2':
          if (isButtonPress) handleTriggerPerformancePad('B', 2);
          break;
        case 'DECK_B_PAD_3':
          if (isButtonPress) handleTriggerPerformancePad('B', 3);
          break;
        case 'DECK_B_PAD_4':
          if (isButtonPress) handleTriggerPerformancePad('B', 4);
          break;
        case 'DECK_B_PAD_5':
          if (isButtonPress) handleTriggerPerformancePad('B', 5);
          break;
        case 'DECK_B_PAD_6':
          if (isButtonPress) handleTriggerPerformancePad('B', 6);
          break;
        case 'DECK_B_PAD_7':
          if (isButtonPress) handleTriggerPerformancePad('B', 7);
          break;
        case 'DECK_B_PAD_8':
          if (isButtonPress) handleTriggerPerformancePad('B', 8);
          break;
        case 'DECK_B_PAD_PAGE_1':
          if (isButtonPress) setPadPageB('HOT_CUES');
          break;
        case 'DECK_B_PAD_PAGE_2':
          if (isButtonPress) setPadPageB('BEAT_JUMP');
          break;
        case 'DECK_B_PAD_PAGE_3':
          if (isButtonPress) setPadPageB('STEMS');
          break;
        case 'DECK_B_PAD_PAGE_4':
          if (isButtonPress) setPadPageB('SAMPLER');
          break;

        // ====================================================================
        // MIXER & BROWSER
        // ====================================================================
        case 'MIXER_CROSSFADER':
          setMixer((m) => ({
            ...m,
            crossfader: Math.round((normalizedVal * 2 - 1) * 100),
          }));
          break;
        case 'MIXER_MASTER_GAIN':
          setMixer((m) => ({
            ...m,
            masterLevel: Math.round(normalizedVal * 100),
          }));
          break;
        case 'MIXER_HEADPHONE_LEVEL':
        case 'MIXER_HEADPHONE_MIX':
          setMixer((m) => ({
            ...m,
            headphoneLevel: Math.round(normalizedVal * 100),
          }));
          break;
        case 'LIBRARY_SCROLL':
          // Automatically open the Browser/Library at the exact saved folder & selection when turning the physical encoder
          if (activeSectionRef.current !== MainSection.LIBRARY) {
            if (activeSectionRef.current !== MainSection.SETTINGS) {
              previousSectionBeforeLibraryRef.current =
                activeSectionRef.current;
            }
            setActiveSection(MainSection.LIBRARY);
          }
          if (decoded.kind === 'RELATIVE') {
            stepLibrarySelection(decoded.delta);
          } else {
            const items = navigableLibraryItemsRef.current;
            if (items.length > 0) {
              const idx = Math.min(
                items.length - 1,
                Math.floor(normalizedVal * items.length)
              );
              const nextItem = items[idx];
              if (nextItem) {
                setLibraryNavState((prev) => ({
                  ...prev,
                  selectedItemId: nextItem.id,
                }));
                if (nextItem.kind === 'TRACK' && nextItem.track) {
                  setSelectedLibraryTrackId(nextItem.track.id);
                }
              }
            }
          }
          break;
        case 'LIBRARY_BACK':
          if (isButtonPress) {
            backButtonHeldRef.current = true;
            if (
              enterButtonHeldRef.current ||
              pendingBrowserActionTimerRef.current !== null
            ) {
              triggerSimultaneousBackEnterCombo();
              break;
            }
            browserComboTriggeredRef.current = false;
            preBrowserButtonNavSnapshotRef.current = libraryNavStateRef.current;
            pendingBrowserActionFnRef.current = executeSingleBackPress;
            pendingBrowserActionTimerRef.current = setTimeout(() => {
              pendingBrowserActionTimerRef.current = null;
              const fn = pendingBrowserActionFnRef.current;
              pendingBrowserActionFnRef.current = null;
              if (!browserComboTriggeredRef.current && fn) {
                fn();
              }
            }, 90);
          } else if (isButtonRelease) {
            backButtonHeldRef.current = false;
            if (
              !browserComboTriggeredRef.current &&
              pendingBrowserActionTimerRef.current !== null &&
              pendingBrowserActionFnRef.current
            ) {
              clearTimeout(pendingBrowserActionTimerRef.current);
              pendingBrowserActionTimerRef.current = null;
              const fn = pendingBrowserActionFnRef.current;
              pendingBrowserActionFnRef.current = null;
              fn();
            }
            if (!enterButtonHeldRef.current) {
              browserComboTriggeredRef.current = false;
            }
          }
          break;
        case 'LIBRARY_ENTER':
          if (isButtonPress) {
            enterButtonHeldRef.current = true;
            if (
              backButtonHeldRef.current ||
              pendingBrowserActionTimerRef.current !== null
            ) {
              triggerSimultaneousBackEnterCombo();
              break;
            }
            browserComboTriggeredRef.current = false;
            preBrowserButtonNavSnapshotRef.current = libraryNavStateRef.current;
            pendingBrowserActionFnRef.current = executeSingleEnterPress;
            pendingBrowserActionTimerRef.current = setTimeout(() => {
              pendingBrowserActionTimerRef.current = null;
              const fn = pendingBrowserActionFnRef.current;
              pendingBrowserActionFnRef.current = null;
              if (!browserComboTriggeredRef.current && fn) {
                fn();
              }
            }, 90);
          } else if (isButtonRelease) {
            enterButtonHeldRef.current = false;
            if (
              !browserComboTriggeredRef.current &&
              pendingBrowserActionTimerRef.current !== null &&
              pendingBrowserActionFnRef.current
            ) {
              clearTimeout(pendingBrowserActionTimerRef.current);
              pendingBrowserActionTimerRef.current = null;
              const fn = pendingBrowserActionFnRef.current;
              pendingBrowserActionFnRef.current = null;
              fn();
            }
            if (!backButtonHeldRef.current) {
              browserComboTriggeredRef.current = false;
            }
          }
          break;
        case 'LIBRARY_LOAD_DECK_A':
          if (isButtonPress) loadSelectedTrackIntoDeck('A');
          break;
        case 'LIBRARY_LOAD_DECK_B':
          if (isButtonPress) loadSelectedTrackIntoDeck('B');
          break;
        default:
          break;
      }
    },
    [
      deckAHandlers,
      deckBHandlers,
      loadStoredTrackToDeck,
      handleLoadGoogleDriveFile,
      handleTriggerPerformancePad,
      fxLockA,
      fxLockB,
      clearCueModeA,
      clearCueModeB,
      closeLibraryAndReturn,
      navigateToSection,
    ]
  );

  const handleIncomingMidiBytes = useCallback(
    (
      status: number,
      data1: number,
      data2: number,
      deviceId = 'usb-midi-0',
      deviceName = 'USB MIDI Controller'
    ) => {
      // In MOBILE_ONLY ("MEZCLAR SOLO CON CELULAR") mode, ignore external MIDI controller input
      if (operatingModeRef.current === OperatingMode.MOBILE_ONLY) return;

      const packet = parseRawMidiBytes(
        status,
        data1,
        data2,
        deviceId,
        deviceName
      );
      // Maintain limited history (max 50 items) to avoid memory growth
      setMidiPackets((prev) => [packet, ...prev.slice(0, 49)]);

      // If MIDI Learn is active, capture the candidate packet for inspection & [ASSIGN]
      if (
        midiLearnActionId &&
        (packet.command === MidiCommandType.NOTE_ON ||
          packet.command === MidiCommandType.NOTE_OFF ||
          packet.command === MidiCommandType.CONTROL_CHANGE ||
          packet.command === MidiCommandType.PITCH_BEND)
      ) {
        // Ignore Note Off (velocity 0) when a Note On was just captured so the user sees the press packet
        if (
          packet.command === MidiCommandType.NOTE_OFF &&
          midiLearnCandidatePacket &&
          midiLearnCandidatePacket.data1 === packet.data1
        ) {
          return;
        }
        setMidiLearnCandidatePacket(packet);
        return;
      }

      // Match against active profile mappings
      const matchedMapping = activeProfile.mappings.find((m) => {
        if (m.channel !== packet.channel) return false;
        if (
          m.command === MidiCommandType.PITCH_BEND &&
          packet.command === MidiCommandType.PITCH_BEND
        ) {
          return true;
        }
        if (m.data1 !== packet.data1) return false;
        const mappingIsNote =
          m.command === MidiCommandType.NOTE_ON ||
          m.command === MidiCommandType.NOTE_OFF;
        const packetIsNote =
          packet.command === MidiCommandType.NOTE_ON ||
          packet.command === MidiCommandType.NOTE_OFF;
        if (mappingIsNote && packetIsNote) return true;
        return m.command === packet.command;
      });

      if (matchedMapping) {
        executeMappedAction(matchedMapping, packet);
      }
    },
    [
      midiLearnActionId,
      midiLearnCandidatePacket,
      activeProfile,
      executeMappedAction,
    ]
  );

  const handleIncomingMidiBytesRef = useRef(handleIncomingMidiBytes);
  handleIncomingMidiBytesRef.current = handleIncomingMidiBytes;

  const scanMidiDevices = useCallback(async () => {
    if (!isWebMidiApiAvailable()) {
      setWebMidiSupported(false);
      setWebMidiErrorMessage(
        'Web MIDI API no está soportado por este navegador.'
      );
      return;
    }

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      setWebMidiSupported(true);
      setWebMidiErrorMessage(null);

      const refreshPorts = () => {
        const disabledSet = new Set(disabledMidiDeviceIds);
        const discovered = buildDeviceDescriptorsFromAccess(access, disabledSet);

        access.inputs.forEach((input) => {
          input.onmidimessage = null;
          input.onmidimessage = (event: MIDIMessageEvent) => {
            if (disabledSet.has(input.id)) return;
            if (event.data && event.data.length >= 3) {
              handleIncomingMidiBytesRef.current(
                event.data[0],
                event.data[1],
                event.data[2],
                input.id,
                input.name || 'USB MIDI'
              );
            }
          };
        });

        setMidiDevices([
          ...discovered,
          {
            id: 'usb-virtual-bus-0',
            name: 'Android USB MIDI Host Bus (OTG Ready)',
            manufacturer: 'DJB Core MIDI',
            product: 'USB MIDI Port 1',
            type: 'VIRTUAL_BUS',
            connected: !disabledSet.has('usb-virtual-bus-0'),
            connectionStatus: disabledSet.has('usb-virtual-bus-0')
              ? 'CLOSED'
              : 'OPEN',
            inputPortCount: 1,
            outputPortCount: 1,
            inputPorts: [
              {
                id: 'virtual-in-1',
                name: 'DJB Virtual MIDI In',
                manufacturer: 'DJB Core MIDI',
                state: 'connected',
                connection: 'open',
                direction: 'INPUT',
              },
            ],
            outputPorts: [
              {
                id: 'virtual-out-1',
                name: 'DJB Virtual MIDI Out',
                manufacturer: 'DJB Core MIDI',
                state: 'connected',
                connection: 'open',
                direction: 'OUTPUT',
              },
            ],
          },
        ]);
      };

      refreshPorts();
      // Force full hardware LED sync when MIDI access opens or device reconnects (ensures PFL A LED is ON by default)
      prevSentLedMapRef.current = {};
      access.onstatechange = () => {
        prevSentLedMapRef.current = {};
        refreshPorts();
      };
    } catch {
      setWebMidiSupported(false);
      setWebMidiErrorMessage(
        'Permiso Web MIDI denegado o bloqueado en este entorno.'
      );
    }
  }, [disabledMidiDeviceIds]);

  useEffect(() => {
    scanMidiDevices();
  }, [scanMidiDevices]);

  const formatLoopBeatsLabel = (beats: number) => {
    if (beats === 0.25) return '1/4';
    if (beats === 0.5) return '1/2';
    return String(beats);
  };

  const lastMidiPacket = midiPackets[0] || null;

  // ============================================================================
  // 9. SELECCIÓN DE STANDALONE MODE / VIRTUALDJ MODE (Sober Studio Launcher)
  // ============================================================================
  if (operatingMode === OperatingMode.UNSELECTED) {
    return (
      <div className="min-h-screen w-full bg-[#121417] text-[#F3F4F6] flex flex-col justify-between p-6 select-none">
        <header className="flex items-center justify-between pb-4 border-b border-[#262930]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-7 rounded-xs bg-[#0099DB]" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#F3F4F6]">
                DJB TOUCH DISPLAY
              </h1>
              <p className="text-xs text-[#9CA3AF]">
                Created by DJ Brayan · Professional Modular Android DJ System
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-[#9CA3AF]">
            <span>
              TRACK DB:{' '}
              <strong className="text-[#F3F4F6]">
                {storedTracks.length} TRACKS
              </strong>
            </span>
            <span>·</span>
            <span>
              PROFILE:{' '}
              <strong className="text-[#0099DB]">{activeProfile.name}</strong>
            </span>
            <PWAInstallButton />
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-5 my-auto py-6 max-w-6xl mx-auto w-full">
          {/* 1. STANDALONE MODE -> Opens directly in WAVEFORMS */}
          <button
            type="button"
            onClick={() => {
              realAudioEngine.ensureInitialized();
              requestLandscapeFullscreen();
              void scanMidiDevices();
              setOperatingMode(OperatingMode.STANDALONE);
              previousSectionBeforeLibraryRef.current = MainSection.WAVEFORMS;
              setActiveSection(MainSection.WAVEFORMS);
            }}
            className="group text-left bg-[#1C1F24] hover:bg-[#23272E] border border-[#32363F] hover:border-[#0099DB] rounded-lg p-6 flex flex-col justify-between min-h-[270px] transition"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9CA3AF]">
                  01 · STANDALONE + USB MIDI
                </span>
                <span className="w-2 h-2 rounded-full bg-[#0099DB]" />
              </div>
              <h2 className="text-xl font-bold text-[#F3F4F6] tracking-tight">
                STANDALONE MODE
              </h2>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">
                Motor de audio real de dos decks con soporte completo para controlador USB MIDI (Numark DJ2GO), vista principal de Waveforms paralelos con Beat Grid editable, Sync musical, Scratch real y biblioteca persistente.
              </p>
            </div>

            <div className="pt-4 border-t border-[#2A2E37] flex items-center justify-between">
              <span className="text-xs font-mono text-[#9CA3AF]">
                Waveforms · USB MIDI · Real Audio
              </span>
              <span className="px-3.5 py-2 rounded bg-[#0099DB] text-[#0B0C0E] font-semibold text-xs">
                OPEN STANDALONE →
              </span>
            </div>
          </button>

          {/* 2. VIRTUALDJ MODE -> Opens directly in WAVEFORMS */}
          <button
            type="button"
            onClick={() => {
              realAudioEngine.ensureInitialized();
              requestLandscapeFullscreen();
              void scanMidiDevices();
              setOperatingMode(OperatingMode.VIRTUALDJ);
              previousSectionBeforeLibraryRef.current = MainSection.WAVEFORMS;
              setActiveSection(MainSection.WAVEFORMS);
            }}
            className="group text-left bg-[#1C1F24] hover:bg-[#23272E] border border-[#32363F] hover:border-[#0099DB] rounded-lg p-6 flex flex-col justify-between min-h-[270px] transition"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9CA3AF]">
                  02 · EXTERNAL USB DISPLAY &amp; BRIDGE
                </span>
                <span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
              </div>
              <h2 className="text-xl font-bold text-[#F3F4F6] tracking-tight">
                VIRTUALDJ MODE
              </h2>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">
                Pantalla y superficie de control táctil con vista principal en Waveforms preparada para conexión por USB y Bridge con VirtualDJ, con retorno de estado y retroalimentación LED MIDI al ritmo del Beat Grid.
              </p>
            </div>

            <div className="pt-4 border-t border-[#2A2E37] flex items-center justify-between">
              <span className="text-xs font-mono text-[#9CA3AF]">
                Bridge: {vdjConfig.windowsBridgeHost}:
                {vdjConfig.windowsBridgePort}
              </span>
              <span className="px-3.5 py-2 rounded bg-[#383D47] group-hover:bg-[#0099DB] group-hover:text-[#0B0C0E] text-[#F3F4F6] font-semibold text-xs transition">
                OPEN VIRTUALDJ →
              </span>
            </div>
          </button>

          {/* 3. MEZCLAR SOLO CON CELULAR -> Opens directly in JOG WHEELS (DECKS), pure Touch without MIDI/PC */}
          <button
            type="button"
            onClick={() => {
              realAudioEngine.ensureInitialized();
              requestLandscapeFullscreen();
              resetAllControllerLeds(midiAccessRef.current, activeProfile);
              setOperatingMode(OperatingMode.MOBILE_ONLY);
              previousSectionBeforeLibraryRef.current = MainSection.DECKS;
              setActiveSection(MainSection.DECKS);
            }}
            className="group text-left bg-[#1C1F24] hover:bg-[#23272E] border border-[#32363F] hover:border-[#0099DB] rounded-lg p-6 flex flex-col justify-between min-h-[270px] transition"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9CA3AF]">
                  03 · 100% TOUCH · SIN MIDI NI PC
                </span>
                <span className="w-2 h-2 rounded-full bg-[#0099DB]" />
              </div>
              <h2 className="text-xl font-bold text-[#F3F4F6] tracking-tight">
                MEZCLAR SOLO CON CELULAR
              </h2>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">
                Modo DJ standalone diseñado exclusivamente para mezclar usando la pantalla táctil del celular (sin controlador MIDI, sin VirtualDJ y sin PC), entrando directamente a los Jog Wheels con Scratch real y Pitch Bend.
              </p>
            </div>

            <div className="pt-4 border-t border-[#2A2E37] flex items-center justify-between">
              <span className="text-xs font-mono text-[#9CA3AF]">
                Jog Wheels · Pure Touch · Offline
              </span>
              <span className="px-3.5 py-2 rounded bg-[#383D47] group-hover:bg-[#0099DB] group-hover:text-[#0B0C0E] text-[#F3F4F6] font-semibold text-xs transition">
                SOLO CELULAR →
              </span>
            </div>
          </button>
        </main>

        <footer className="pt-4 border-t border-[#262930] flex flex-wrap items-center justify-between gap-2 text-xs text-[#9CA3AF] font-mono">
          <div>
            DJ Core: AudioEngine · DeckEngine · MixerEngine · EffectsEngine · WaveformEngine · AnalyzerEngine · LibraryEngine · ImportManager · TrackDatabase · MidiEngine
          </div>
          <div>DJB Touch Display · DJ Brayan · PWA Offline Ready</div>
        </footer>
        <OfflineIndicator />
      </div>
    );
  }

  // ============================================================================
  // 3. MUSIC LIBRARY VIEW (Real Import, Persistent DB, Search, Categories)
  // ============================================================================
  if (activeSection === MainSection.LIBRARY) {
    return (
      <LibraryView
        tracks={storedTracks}
        registeredFolders={registeredFolders}
        playlists={playlists}
        queueStatus={queueStatus}
        targetDeck={libraryTargetDeck}
        onChangeTargetDeck={setLibraryTargetDeck}
        onImportIndividualFiles={(files, sourceType, targetFolderPath) => {
          importManager.importFiles(files, {
            sourceType,
            baseFolderPath: targetFolderPath || '',
            preserveRelativePaths: false,
          });
        }}
        onImportFolderFiles={(
          files,
          sourceType,
          parentFolderPath,
          storageVolume: StorageVolumeType = 'INTERNAL'
        ) => {
          importManager.importFiles(files, {
            sourceType,
            baseFolderPath: parentFolderPath || '',
            preserveRelativePaths: true,
            storageVolume,
          });
        }}
        onPickNativeDirectory={(
          sourceType,
          parentFolderPath,
          preferredVolumeKind
        ) =>
          importManager.pickAndScanNativeDirectory(
            sourceType,
            parentFolderPath || '',
            preferredVolumeKind
          )
        }
        onVerifyTracksAvailability={() =>
          importManager.verifyAllTracksAvailability()
        }
        onLoadGoogleDriveFile={handleLoadGoogleDriveFile}
        onRelinkTrackFile={(trackId, file) => {
          importManager.relinkTrackFile(trackId, file);
        }}
        onReanalyzeTrack={(trackId) => {
          importManager.reanalyzeTrack(trackId);
        }}
        onAnalyzeAllUnanalyzed={() => {
          storedTracks.forEach((t) => {
            if (t.analysisStatus !== 'READY') {
              importManager.reanalyzeTrack(t.id);
            }
          });
        }}
        onDeleteTrack={async (trackId) => {
          await trackDatabase.deleteTrack(trackId);
          const updated = await trackDatabase.getAllTracks();
          setStoredTracks(updated);
        }}
        onLoadTrackToDeck={(trk, deck) => {
          loadStoredTrackToDeck(trk, deck, true);
        }}
        onCreatePlaylist={async (name) => {
          const created: PlaylistRecord = {
            id: `pl-${Date.now()}`,
            name,
            trackIds: [],
            createdAt: Date.now(),
          };
          await trackDatabase.savePlaylist(created);
          setPlaylists(await trackDatabase.getAllPlaylists());
        }}
        onToggleTrackInPlaylist={async (playlistId, trackId) => {
          const all = await trackDatabase.getAllPlaylists();
          const target = all.find((p) => p.id === playlistId);
          if (!target) return;
          const exists = target.trackIds.includes(trackId);
          const updated: PlaylistRecord = {
            ...target,
            trackIds: exists
              ? target.trackIds.filter((id) => id !== trackId)
              : [...target.trackIds, trackId],
          };
          await trackDatabase.savePlaylist(updated);
          setPlaylists(await trackDatabase.getAllPlaylists());
        }}
        onBackToDecks={closeLibraryAndReturn}
        selectedTrackId={selectedLibraryTrackId}
        onSelectTrack={(id) => setSelectedLibraryTrackId(id)}
        onVisibleTracksChange={(vis) => {
          visibleLibraryTracksRef.current = vis;
        }}
        navigationState={libraryNavState}
        onNavigationStateChange={setLibraryNavState}
        onNavigableItemsChange={(items) => {
          navigableLibraryItemsRef.current = items;
        }}
        stemQueueStatus={stemQueueStatus}
        onPrepareTrackStems={(trackId, force) => {
          void stemPreparationQueue.prepareTrack(trackId, force);
        }}
        onPrepareMultipleTrackStems={(trackIds) => {
          void stemPreparationQueue.prepareMultipleTracks(trackIds);
        }}
        onPrepareFolderStems={(folderPath, sourceType) => {
          void stemPreparationQueue.prepareFolder(folderPath, sourceType);
        }}
        onPauseStemPreparation={(trackId) => {
          void stemPreparationQueue.pausePreparation(trackId);
        }}
        onResumeStemPreparation={(trackId) => {
          void stemPreparationQueue.resumePreparation(trackId);
        }}
        onCancelStemPreparation={(trackId) => {
          void stemPreparationQueue.cancelPreparation(trackId);
        }}
        onRetryStemPreparation={(trackId) => {
          void stemPreparationQueue.retryPreparation(trackId);
        }}
      />
    );
  }

  // ============================================================================
  // 8. SETTINGS VIEW
  // ============================================================================
  if (activeSection === MainSection.SETTINGS) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#181A1F]">
        <SettingsView
          operatingMode={operatingMode}
          onChangeOperatingMode={(m) => setOperatingMode(m)}
          onCloseSettings={() => setActiveSection(MainSection.DECKS)}
          midiDevices={midiDevices}
          midiPackets={midiPackets}
          activeProfile={activeProfile}
          profiles={profiles}
          midiLearnActionId={midiLearnActionId}
          midiLearnCandidatePacket={midiLearnCandidatePacket}
          ledStates={ledStates}
          webMidiSupported={webMidiSupported}
          webMidiErrorMessage={webMidiErrorMessage}
          onScanMidiDevices={scanMidiDevices}
          onToggleConnectMidiDevice={(deviceId) => {
            const wasDisabled = disabledMidiDeviceIds.includes(deviceId);
            if (!wasDisabled) {
              resetAllControllerLeds(midiAccessRef.current, activeProfile);
            }
            prevSentLedMapRef.current = {};
            setDisabledMidiDeviceIds((prev) =>
              prev.includes(deviceId)
                ? prev.filter((id) => id !== deviceId)
                : [...prev, deviceId]
            );
            setMidiDevices((prev) =>
              prev.map((d) =>
                d.id === deviceId
                  ? {
                      ...d,
                      connected: !d.connected,
                      connectionStatus: !d.connected ? 'OPEN' : 'CLOSED',
                    }
                  : d
              )
            );
          }}
          onClearMidiPackets={() => setMidiPackets([])}
          onSimulateIncomingMidi={(status, d1, d2) =>
            handleIncomingMidiBytes(
              status,
              d1,
              d2,
              'sim-usb-midi',
              activeProfile.controllerModel || 'Numark DJ2GO'
            )
          }
          onSendRawMidiOut={sendRawMidiOut}
          onStartMidiLearn={(actionId) => {
            setMidiLearnActionId(actionId);
            setMidiLearnCandidatePacket(null);
          }}
          onAssignLearnedMapping={(actionId, packet, controlMode) => {
            const newEntry = createLearnedMappingEntry(
              actionId,
              packet,
              controlMode
            );
            setProfiles((prev) =>
              prev.map((prof) => {
                if (prof.id !== activeProfile.id) return prof;
                const filtered = prof.mappings.filter(
                  (m) => m.actionId !== actionId
                );
                return {
                  ...prof,
                  updatedAt: new Date().toISOString().slice(0, 10),
                  mappings: [...filtered, newEntry],
                };
              })
            );
            setMidiLearnActionId(null);
            setMidiLearnCandidatePacket(null);
          }}
          onUpdateMappingEntry={(actionId, midiCodeHex, controlMode) => {
            const decoded = parseMidiCodeHex(midiCodeHex);
            if (!decoded) return false;
            const meta = DJB_BINDABLE_ACTIONS.find(
              (a) => a.actionId === actionId
            );
            if (!meta) return false;
            const updatedEntry: MidiMappingEntry = {
              actionId,
              shortKey: meta.shortKey,
              actionLabel: meta.label,
              category: meta.category,
              command: decoded.command,
              status: decoded.status,
              channel: decoded.channel,
              data1: decoded.data1,
              midiCode: buildMidiCodeHex(decoded.status, decoded.data1),
              controlMode,
              vdjReferenceNote: meta.vdjReferenceNote,
              ledFeedbackSupported: meta.ledSupported,
              ledOnVelocity: 127,
              ledOffVelocity: 0,
            };
            setProfiles((prev) =>
              prev.map((prof) => {
                if (prof.id !== activeProfile.id) return prof;
                const exists = prof.mappings.some(
                  (m) => m.actionId === actionId
                );
                const nextMappings = exists
                  ? prof.mappings.map((m) =>
                      m.actionId === actionId ? updatedEntry : m
                    )
                  : [...prof.mappings, updatedEntry];
                return {
                  ...prof,
                  updatedAt: new Date().toISOString().slice(0, 10),
                  mappings: nextMappings,
                };
              })
            );
            return true;
          }}
          onRemoveMapping={(actionId) =>
            setProfiles((prev) =>
              prev.map((p) =>
                p.id === activeProfile.id
                  ? {
                      ...p,
                      mappings: p.mappings.filter(
                        (m) => m.actionId !== actionId
                      ),
                    }
                  : p
              )
            )
          }
          onUpdateLedMappingEntry={(
            ledId,
            status,
            channel,
            data1,
            onVelocity,
            offVelocity
          ) => {
            const code = buildMidiCodeHex(status, data1);
            setProfiles((prev) =>
              prev.map((prof) => {
                if (prof.id !== activeProfile.id) return prof;
                const nextLeds = (prof.ledMappings || []).map((led) =>
                  led.ledId === ledId
                    ? {
                        ...led,
                        status,
                        channel,
                        data1,
                        onVelocity,
                        offVelocity,
                        midiCode: code,
                      }
                    : led
                );
                return {
                  ...prof,
                  updatedAt: new Date().toISOString().slice(0, 10),
                  ledMappings: nextLeds,
                };
              })
            );
          }}
          onSelectProfile={(id) => {
            resetAllControllerLeds(midiAccessRef.current, activeProfile);
            prevSentLedMapRef.current = {};
            setActiveProfileId(id);
          }}
          onCreateNewProfile={(name, model) => {
            const newId = `profile-${Date.now()}`;
            const created: ControllerProfile = {
              id: newId,
              name,
              controllerModel: model,
              author: 'DJ Brayan',
              version: '1.0.0',
              updatedAt: new Date().toISOString().slice(0, 10),
              mappings: [],
              ledMappings: activeProfile.ledMappings || [],
            };
            setProfiles((prev) => [...prev, created]);
            setActiveProfileId(newId);
          }}
          onImportProfileJson={(jsonText) => {
            const imported = parsePortableJsonToProfile(jsonText);
            if (!imported) return false;
            setProfiles((prev) => [
              ...prev.filter((p) => p.id !== imported.id),
              imported,
            ]);
            setActiveProfileId(imported.id);
            return true;
          }}
          onRestoreDefaultProfiles={() => {
            resetAllControllerLeds(midiAccessRef.current, activeProfile);
            prevSentLedMapRef.current = {};
            setProfiles(INITIAL_CONTROLLER_PROFILES);
            setActiveProfileId(INITIAL_CONTROLLER_PROFILES[0].id);
          }}
          audioConfig={audioConfig}
          onUpdateAudioConfig={(patch) =>
            setAudioConfig((prev) => ({ ...prev, ...patch }))
          }
          mixer={mixer}
          onUpdateMixer={(patch) =>
            setMixer((prev) => ({ ...prev, ...patch }))
          }
          folders={folders}
          onAddMusicFolder={(path, storageType) =>
            setFolders((prev) => [
              ...prev,
              {
                id: `fld-${Date.now()}`,
                path,
                trackCount: 0,
                storageType,
                autoScanOnLaunch: true,
              },
            ])
          }
          onToggleFolderAutoScan={(id) =>
            setFolders((prev) =>
              prev.map((f) =>
                f.id === id
                  ? { ...f, autoScanOnLaunch: !f.autoScanOnLaunch }
                  : f
              )
            )
          }
          analysisConfig={analysisConfig}
          onUpdateAnalysisConfig={(patch) =>
            setAnalysisConfig((prev) => ({ ...prev, ...patch }))
          }
          vdjConfig={vdjConfig}
          onUpdateVdjConfig={(patch) =>
            setVdjConfig((prev) => ({ ...prev, ...patch }))
          }
        />
      </div>
    );
  }

  // ============================================================================
  // MAIN DJ PERFORMANCE SHELL (Shared Top Header + Workspace + Bottom Transport)
  // ============================================================================
  return (
    <div
      style={{ touchAction: 'none' }}
      className="h-screen w-screen overflow-hidden bg-[#22252A] text-[#F3F4F6] flex flex-col select-none touch-none"
    >
      {/* Persistent Top Deck Overview & Track Load Bar */}
      <TopDeckHeaderBar
        deckA={deckA}
        deckB={deckB}
        cuePointA={cuePointA}
        cuePointB={cuePointB}
        cachedWaveformA={cachedWaveformA}
        cachedWaveformB={cachedWaveformB}
        operatingMode={operatingMode}
        isRecording={isRecording}
        onToggleRecording={() => setIsRecording((r) => !r)}
        onOpenLibraryForDeck={(deckId) => {
          setLibraryTargetDeck(deckId);
          navigateToSection(MainSection.LIBRARY);
        }}
        onSeekDeckA={deckAHandlers.onSeek}
        onSeekDeckB={deckBHandlers.onSeek}
        onOpenModeSelector={() => setOperatingMode(OperatingMode.UNSELECTED)}
        onTogglePflA={deckAHandlers.onTogglePfl}
        onTogglePflB={deckBHandlers.onTogglePfl}
        vinylModeA={vinylModeA}
        vinylModeB={vinylModeB}
        onToggleVinylA={() =>
          setVinylModeA((v) => {
            const next = !v;
            setJogTouchMode(next ? 'SCRATCH' : 'BEND');
            return next;
          })
        }
        onToggleVinylB={() =>
          setVinylModeB((v) => {
            const next = !v;
            setJogTouchMode(next ? 'SCRATCH' : 'BEND');
            return next;
          })
        }
      />

      {/* Discrete Studio View Navigation Bar */}
      <div className="h-7 shrink-0 bg-[#15171B] border-b border-[#2A2E36] px-3 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {NAVIGATION_SECTIONS.map((nav) => {
            const active = activeSection === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => navigateToSection(nav.id)}
                className={`px-2.5 py-0.5 rounded-xs font-medium tracking-wider transition whitespace-nowrap ${
                  active
                    ? 'bg-[#2E333D] text-[#0099DB] font-semibold'
                    : 'text-[#8C939E] hover:text-[#F3F4F6]'
                }`}
              >
                {nav.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-[#8C939E] shrink-0">
          {queueStatus.isProcessing && (
            <span className="text-[#0099DB]">
              [{queueStatus.currentStage} {queueStatus.progressPercent}%]
            </span>
          )}
          {operatingMode !== OperatingMode.MOBILE_ONLY && lastMidiPacket && (
            <span>
              MIDI {formatMidiStatusHex(lastMidiPacket.status)} D1:
              {lastMidiPacket.data1} D2:{lastMidiPacket.data2} CH
              {lastMidiPacket.channel}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOperatingMode(OperatingMode.UNSELECTED)}
            className="hover:text-white"
          >
            {operatingMode === OperatingMode.VIRTUALDJ
              ? 'VIRTUALDJ MODE'
              : operatingMode === OperatingMode.MOBILE_ONLY
              ? 'SOLO CELULAR'
              : 'STANDALONE MODE'}
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CENTER WORKSPACE AREA                                                */}
      {/* ==================================================================== */}
      <main className="relative flex-1 overflow-hidden flex">
        {/* VIEW 1: DECKS / TURNTABLES */}
        {activeSection === MainSection.DECKS && (
          <div className="w-full h-full flex items-center justify-between px-3 py-2 relative">
            {/* Top-Left Circular Waveforms Toggle Button + Circular Beat Grid Editor Button & Expandable Cluster */}
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSection(MainSection.WAVEFORMS)}
                title="Abrir vista de Waveforms paralelos"
                className="w-11 h-11 rounded-full bg-[#25282F] border border-[#525761] hover:border-white flex items-center justify-center text-[#E5E7EB] transition"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 fill-none stroke-current stroke-2"
                >
                  <polyline points="2 12 6 12 8 6 11 18 14 9 16 15 18 12 22 12" />
                </svg>
              </button>

              {/* Circular Beat Grid Editor Trigger Button (Same visual style) */}
              <button
                type="button"
                onClick={() => setBeatGridEditorOpen((o) => !o)}
                title="Abrir / Contraer Editor de Beat Grid (Deck A / Deck B)"
                className={`w-11 h-11 rounded-full border flex items-center justify-center font-mono text-[10px] font-bold transition ${
                  beatGridEditorOpen
                    ? 'bg-[#3A3E46] border-[#0099DB] text-[#0099DB]'
                    : 'bg-[#25282F] border-[#525761] hover:border-white text-[#E5E7EB]'
                }`}
              >
                GRID
              </button>

              {/* Expandable Circular Beat Grid Edit Buttons Cluster */}
              {beatGridEditorOpen && (
                <div className="flex items-center gap-1.5 bg-[#15171B]/95 border border-[#383D47] rounded-full px-2 py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() =>
                      setBeatGridEditDeck((d) => (d === 'A' ? 'B' : 'A'))
                    }
                    title="Cambiar Deck del Editor de Beat Grid (Deck A / Deck B independientes)"
                    className="w-9 h-9 rounded-full bg-[#0099DB] text-[#0B0C0E] border border-white font-mono text-xs font-bold flex items-center justify-center"
                  >
                    {beatGridEditDeck}
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftBeatGrid(beatGridEditDeck, -0.012)}
                    title="Desplazar Beat Grid hacia atrás (-12ms)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-xs flex items-center justify-center"
                  >
                    ◄
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftBeatGrid(beatGridEditDeck, 0.012)}
                    title="Desplazar Beat Grid hacia adelante (+12ms)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-xs flex items-center justify-center"
                  >
                    ►
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleBeatGridBpm(beatGridEditDeck, 0.5)}
                    title="Dividir el Beat Grid entre 2 (/2 BPM)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    ÷2
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleBeatGridBpm(beatGridEditDeck, 2)}
                    title="Multiplicar el Beat Grid por 2 (x2 BPM)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    ×2
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleBeatGridResolution(beatGridEditDeck)}
                    title="Duplicar / Dividir la resolución de subdivisión del Grid (0.5x / 1x / 2x)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#0099DB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    {beatGridEditDeck === 'A'
                      ? `${gridResolutionA}x`
                      : `${gridResolutionB}x`}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setManualFirstBeatAtPlayhead(beatGridEditDeck)
                    }
                    title="Establecer manualmente el Primer Beat en la posición actual"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-[#0099DB] border border-[#525761] text-[#E5E7EB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    1st
                  </button>
                  <button
                    type="button"
                    onClick={() => recalibrateDeckBeatGrid(beatGridEditDeck)}
                    title="Recalibrar / Reanalizar Beat Grid de la canción"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-xs flex items-center justify-center"
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => resetDeckBeatGridToAuto(beatGridEditDeck)}
                    title="Restablecer Beat Grid al análisis automático original"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#9CA3AF] hover:text-white font-mono text-[9px] font-bold flex items-center justify-center"
                  >
                    RST
                  </button>
                </div>
              )}
            </div>

            {/* Top-Right Circular Settings Gear Button */}
            <button
              type="button"
              onClick={() => setActiveSection(MainSection.SETTINGS)}
              title="Abrir Settings (MIDI, Audio, Library, System)"
              className="absolute top-3 right-3 z-20 w-11 h-11 rounded-full bg-[#25282F] border border-[#525761] hover:border-white flex items-center justify-center text-[#E5E7EB] transition"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>

            {/* Left Outer Vertical TEMPO Fader (Deck A) */}
            <div className="h-full pt-14 pb-1 flex items-center">
              <VerticalFader
                label={`${deckA.pitchPercent.toFixed(1)} %`}
                value={deckA.pitchPercent}
                min={-deckA.pitchRange}
                max={deckA.pitchRange}
                defaultValue={0}
                step={0.1}
                capStyle="tempo"
                bottomCaption="TEMPO"
                onChange={deckAHandlers.onChangePitch}
              />
            </div>

            {/* Deck A Circular Vinyl Turntable Platter */}
            <TurntablePlatter
              deckId="A"
              angleDeg={deckA.jogAngleDeg}
              isPlaying={deckA.isPlaying}
              onNudge={deckAHandlers.onNudgeJog}
              onReleasePlatter={deckAHandlers.onReleaseJog}
              onPitchBendStep={deckAHandlers.onPitchBendStep}
            />

            {/* Center Mode Buttons + Real-Time Vertical Level Meter + Pads Trigger */}
            <CenterRackColumn
              activeSection={activeSection}
              onSelectSection={navigateToSection}
              levelA={meterLevelA}
              levelB={meterLevelB}
              masterVu={masterVu}
              musicalKeyLabel={deckB.key}
            />

            {/* Deck B Circular Vinyl Turntable Platter */}
            <TurntablePlatter
              deckId="B"
              angleDeg={deckB.jogAngleDeg}
              isPlaying={deckB.isPlaying}
              showPitchBendArrows
              onNudge={deckBHandlers.onNudgeJog}
              onReleasePlatter={deckBHandlers.onReleaseJog}
              onPitchBendStep={deckBHandlers.onPitchBendStep}
            />

            {/* Right Outer Vertical TEMPO Fader (Deck B) */}
            <div className="h-full pt-14 pb-1 flex items-center">
              <VerticalFader
                label={`${deckB.pitchPercent.toFixed(1)} %`}
                value={deckB.pitchPercent}
                min={-deckB.pitchRange}
                max={deckB.pitchRange}
                defaultValue={0}
                step={0.1}
                capStyle="tempo"
                bottomCaption="TEMPO"
                onChange={deckBHandlers.onChangePitch}
              />
            </div>
          </div>
        )}

        {/* VIEW 6: MIXER / EQ (5 Vertical Faders per Deck + Gain Knobs) */}
        {activeSection === MainSection.MIXER_EQ && (
          <div className="w-full h-full flex items-center justify-between px-4 py-2">
            {/* Left Side: Deck A Gain + 5 Vertical Faders (VOL, LOW, MID, HI, FLT.) */}
            <div className="flex-1 h-full flex flex-col justify-between pr-4">
              <div className="flex items-center justify-start gap-3 pl-2 pt-1">
                <TouchKnob
                  label="GAIN"
                  value={deckA.eq.gain}
                  min={0}
                  max={100}
                  defaultValue={80}
                  onChange={(v) =>
                    setDeckA((d) => ({ ...d, eq: { ...d.eq, gain: v } }))
                  }
                />
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckAHandlers.onTogglePfl();
                  }}
                  title="PFL / Preescucha Auriculares Deck A"
                  className={`h-8 px-2.5 rounded border font-mono text-xs font-bold transition touch-none ${
                    deckA.pflHeadphoneCue
                      ? 'bg-[#0099DB] border-[#28B5F4] text-[#0B0C0E]'
                      : 'bg-[#25282F] border-[#525761] text-[#D1D5DB] hover:border-white'
                  }`}
                >
                  PFL A
                </button>
              </div>

              <div className="flex-1 flex items-center justify-around pt-2 pb-1">
                <VerticalFader
                  label="VOL"
                  value={deckA.volumeFader}
                  min={0}
                  max={100}
                  defaultValue={85}
                  capStyle="light"
                  showDualFillLine
                  onChange={(v) => setDeckA((d) => ({ ...d, volumeFader: v }))}
                />
                <VerticalFader
                  label="LOW"
                  value={deckA.eq.low}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  capStyle="light"
                  onChange={(v) =>
                    setDeckA((d) => ({ ...d, eq: { ...d.eq, low: v } }))
                  }
                />
                <VerticalFader
                  label="MID"
                  value={deckA.eq.mid}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  capStyle="light"
                  onChange={(v) =>
                    setDeckA((d) => ({ ...d, eq: { ...d.eq, mid: v } }))
                  }
                />
                <VerticalFader
                  label="HI"
                  value={deckA.eq.high}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  capStyle="light"
                  onChange={(v) =>
                    setDeckA((d) => ({ ...d, eq: { ...d.eq, high: v } }))
                  }
                />
                <VerticalFader
                  label="FLT."
                  value={deckA.eq.filter}
                  min={-100}
                  max={100}
                  defaultValue={0}
                  capStyle="dark"
                  onChange={(v) =>
                    setDeckA((d) => ({ ...d, eq: { ...d.eq, filter: v } }))
                  }
                />
              </div>
            </div>

            {/* Center Rack Column */}
            <CenterRackColumn
              activeSection={activeSection}
              onSelectSection={setActiveSection}
              levelA={meterLevelA}
              levelB={meterLevelB}
              masterVu={masterVu}
            />

            {/* Right Side: Deck B Gain + 5 Vertical Faders (FLT., LOW, MID, HI, VOL) */}
            <div className="flex-1 h-full flex flex-col justify-between pl-4">
              <div className="flex items-center justify-end gap-3 pr-2 pt-1">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckBHandlers.onTogglePfl();
                  }}
                  title="PFL / Preescucha Auriculares Deck B"
                  className={`h-8 px-2.5 rounded border font-mono text-xs font-bold transition touch-none ${
                    deckB.pflHeadphoneCue
                      ? 'bg-[#0099DB] border-[#28B5F4] text-[#0B0C0E]'
                      : 'bg-[#25282F] border-[#525761] text-[#D1D5DB] hover:border-white'
                  }`}
                >
                  PFL B
                </button>
                <TouchKnob
                  label="GAIN"
                  value={deckB.eq.gain}
                  min={0}
                  max={100}
                  defaultValue={80}
                  onChange={(v) =>
                    setDeckB((d) => ({ ...d, eq: { ...d.eq, gain: v } }))
                  }
                />
              </div>

              <div className="flex-1 flex items-center justify-around pt-2 pb-1">
                <VerticalFader
                  label="FLT."
                  value={deckB.eq.filter}
                  min={-100}
                  max={100}
                  defaultValue={0}
                  capStyle="dark"
                  onChange={(v) =>
                    setDeckB((d) => ({ ...d, eq: { ...d.eq, filter: v } }))
                  }
                />
                <VerticalFader
                  label="LOW"
                  value={deckB.eq.low}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  capStyle="light"
                  onChange={(v) =>
                    setDeckB((d) => ({ ...d, eq: { ...d.eq, low: v } }))
                  }
                />
                <VerticalFader
                  label="MID"
                  value={deckB.eq.mid}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  capStyle="light"
                  onChange={(v) =>
                    setDeckB((d) => ({ ...d, eq: { ...d.eq, mid: v } }))
                  }
                />
                <VerticalFader
                  label="HI"
                  value={deckB.eq.high}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  capStyle="light"
                  onChange={(v) =>
                    setDeckB((d) => ({ ...d, eq: { ...d.eq, high: v } }))
                  }
                />
                <VerticalFader
                  label="VOL"
                  value={deckB.volumeFader}
                  min={0}
                  max={100}
                  defaultValue={85}
                  capStyle="light"
                  showDualFillLine
                  onChange={(v) => setDeckB((d) => ({ ...d, volumeFader: v }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 7: WAVEFORMS (Stacked Parallel HD Waveforms + Center Line + Zoom -/+) */}
        {activeSection === MainSection.WAVEFORMS && (
          <div className="relative w-full h-full bg-[#181A1E] flex flex-col justify-between">
            {/* Top-Left Circular Return-to-Decks, Beatgrid Toggle & Expandable Circular Beat Grid Editor */}
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSection(MainSection.DECKS)}
                title="Cambiar a vista de Jog Wheels / Turntables circulares"
                className="w-11 h-11 rounded-full bg-[#3A3E47] border border-white text-white flex items-center justify-center shadow"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 fill-none stroke-current stroke-2"
                >
                  <polyline points="2 12 6 12 8 6 11 18 14 9 16 15 18 12 22 12" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setShowBeatgrid((b) => !b)}
                title="Mostrar / Ocultar Beatgrid"
                className={`w-11 h-11 rounded-full border flex items-center justify-center transition ${
                  showBeatgrid
                    ? 'bg-[#22262E] border-[#0099DB] text-white'
                    : 'bg-[#1D2026] border-[#4B505A] text-[#9CA3AF]'
                }`}
              >
                <span className="font-mono text-xs font-bold">|ılı|</span>
              </button>

              {/* Circular Beat Grid Editor Trigger Button alongside circular Waveform/Decks button */}
              <button
                type="button"
                onClick={() => setBeatGridEditorOpen((o) => !o)}
                title="Abrir / Contraer Editor de Beat Grid (Deck A / Deck B)"
                className={`w-11 h-11 rounded-full border flex items-center justify-center font-mono text-[10px] font-bold transition ${
                  beatGridEditorOpen
                    ? 'bg-[#3A3E46] border-[#0099DB] text-[#0099DB]'
                    : 'bg-[#25282F] border-[#525761] hover:border-white text-[#E5E7EB]'
                }`}
              >
                GRID
              </button>

              {/* Expandable Circular Beat Grid Edit Buttons Cluster */}
              {beatGridEditorOpen && (
                <div className="flex items-center gap-1.5 bg-[#15171B]/95 border border-[#383D47] rounded-full px-2 py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() =>
                      setBeatGridEditDeck((d) => (d === 'A' ? 'B' : 'A'))
                    }
                    title="Cambiar Deck del Editor de Beat Grid (Deck A / Deck B independientes)"
                    className="w-9 h-9 rounded-full bg-[#0099DB] text-[#0B0C0E] border border-white font-mono text-xs font-bold flex items-center justify-center"
                  >
                    {beatGridEditDeck}
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftBeatGrid(beatGridEditDeck, -0.012)}
                    title="Desplazar Beat Grid hacia atrás (-12ms)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-xs flex items-center justify-center"
                  >
                    ◄
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftBeatGrid(beatGridEditDeck, 0.012)}
                    title="Desplazar Beat Grid hacia adelante (+12ms)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-xs flex items-center justify-center"
                  >
                    ►
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleBeatGridBpm(beatGridEditDeck, 0.5)}
                    title="Dividir el Beat Grid entre 2 (/2 BPM)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    ÷2
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleBeatGridBpm(beatGridEditDeck, 2)}
                    title="Multiplicar el Beat Grid por 2 (x2 BPM)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    ×2
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleBeatGridResolution(beatGridEditDeck)}
                    title="Duplicar / Dividir la resolución de subdivisión del Grid (0.5x / 1x / 2x)"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#0099DB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    {beatGridEditDeck === 'A'
                      ? `${gridResolutionA}x`
                      : `${gridResolutionB}x`}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setManualFirstBeatAtPlayhead(beatGridEditDeck)
                    }
                    title="Establecer manualmente el Primer Beat en la posición actual"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-[#0099DB] border border-[#525761] text-[#E5E7EB] font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    1st
                  </button>
                  <button
                    type="button"
                    onClick={() => recalibrateDeckBeatGrid(beatGridEditDeck)}
                    title="Recalibrar / Reanalizar Beat Grid de la canción"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#E5E7EB] font-mono text-xs flex items-center justify-center"
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => resetDeckBeatGridToAuto(beatGridEditDeck)}
                    title="Restablecer Beat Grid al análisis automático original"
                    className="w-9 h-9 rounded-full bg-[#25282F] hover:border-white border border-[#525761] text-[#9CA3AF] hover:text-white font-mono text-[9px] font-bold flex items-center justify-center"
                  >
                    RST
                  </button>
                </div>
              )}
            </div>

            {/* Top-Right Bend / Scratch Segmented Control (Synchronized with Deck Vinyl/Scratch Mode) */}
            <div className="absolute top-3 right-3 z-20 flex items-center rounded border border-[#6C727F] overflow-hidden bg-[#1D2026]">
              <button
                type="button"
                onClick={() => {
                  setJogTouchMode('BEND');
                  setVinylModeA(false);
                  setVinylModeB(false);
                }}
                className={`px-4 py-1.5 text-xs font-medium transition ${
                  jogTouchMode === 'BEND'
                    ? 'bg-[#5A606B] text-white'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Bend
              </button>
              <button
                type="button"
                onClick={() => {
                  setJogTouchMode('SCRATCH');
                  setVinylModeA(true);
                  setVinylModeB(true);
                }}
                className={`px-4 py-1.5 text-xs font-medium transition ${
                  jogTouchMode === 'SCRATCH'
                    ? 'bg-[#5A606B] text-white'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Scratch
              </button>
            </div>

            {/* Center Zoom (-) and (+) Controls flanking the central playhead line */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="flex items-center gap-6 pointer-events-auto">
                <button
                  type="button"
                  onClick={() =>
                    setWaveformZoom((z) =>
                      Math.max(1, Number((z - 0.5).toFixed(1)))
                    )
                  }
                  title="Alejar Waveform (-)"
                  className="w-9 h-9 rounded bg-black/50 hover:bg-black/80 border border-[#525761] text-[#E5E7EB] text-2xl font-bold flex items-center justify-center leading-none"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWaveformZoom((z) =>
                      Math.min(6, Number((z + 0.5).toFixed(1)))
                    )
                  }
                  title="Acercar Waveform (+)"
                  className="w-9 h-9 rounded bg-black/50 hover:bg-black/80 border border-[#525761] text-[#E5E7EB] text-2xl font-bold flex items-center justify-center leading-none"
                >
                  +
                </button>
              </div>
            </div>

            {/* Upper Half: Deck A Scrolling HD Waveform */}
            <div className="flex-1 flex items-center border-b border-[#262930]">
              <WaveformCanvas
                trackId={deckA.trackId}
                deckId="A"
                positionSec={deckA.positionSec}
                durationSec={deckA.durationSec}
                bpm={deckA.currentBpm}
                baseBpm={deckA.baseBpm}
                firstBeatOffsetSec={firstBeatOffsetA}
                gridResolutionMultiplier={gridResolutionA}
                isPlaying={deckA.isPlaying}
                hotCues={deckA.hotCues}
                loop={deckA.loop}
                cuePointSec={cuePointA}
                cachedWaveform={cachedWaveformA}
                height={155}
                zoom={waveformZoom}
                showBeatgrid={showBeatgrid}
                variant="scrolling"
                onSeek={deckAHandlers.onSeek}
                onScratchOrBend={deckAHandlers.onNudgeJog}
                onReleaseScratch={deckAHandlers.onReleaseJog}
              />
            </div>

            {/* Lower Half: Deck B Scrolling HD Waveform */}
            <div className="flex-1 flex items-center">
              <WaveformCanvas
                trackId={deckB.trackId}
                deckId="B"
                positionSec={deckB.positionSec}
                durationSec={deckB.durationSec}
                bpm={deckB.currentBpm}
                baseBpm={deckB.baseBpm}
                firstBeatOffsetSec={firstBeatOffsetB}
                gridResolutionMultiplier={gridResolutionB}
                isPlaying={deckB.isPlaying}
                hotCues={deckB.hotCues}
                loop={deckB.loop}
                cuePointSec={cuePointB}
                cachedWaveform={cachedWaveformB}
                height={155}
                zoom={waveformZoom}
                showBeatgrid={showBeatgrid}
                variant="scrolling"
                onSeek={deckBHandlers.onSeek}
                onScratchOrBend={deckBHandlers.onNudgeJog}
                onReleaseScratch={deckBHandlers.onReleaseJog}
              />
            </div>
          </div>
        )}

        {/* VIEW 4: LOOPS & HOT CUES (Loop Bar + 8 Hot Cue Pads per Deck) */}
        {activeSection === MainSection.LOOPS_HOTCUES && (
          <div className="w-full h-full flex items-center justify-between px-3 py-2">
            {/* Left Panel: Deck A Loops & 8 Hot Cues */}
            <div className="flex-1 h-full flex flex-col justify-between pr-2">
              <div className="flex items-center gap-2 touch-none">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setSlipModeA((s) => !s);
                  }}
                  className={`w-12 h-10 rounded border text-xs font-medium transition touch-none ${
                    slipModeA
                      ? 'bg-[#3E434D] border-[#0099DB] text-white'
                      : 'bg-[#262930] border-[#454A54] text-[#D1D5DB]'
                  }`}
                >
                  SLIP
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setClearCueModeA((x) => !x);
                  }}
                  title="Modo borrar Hot Cue"
                  className={`w-12 h-10 rounded border text-xs font-medium transition touch-none ${
                    clearCueModeA
                      ? 'bg-[#991B1B] border-white text-white'
                      : 'bg-[#262930] border-[#454A54] text-[#D1D5DB]'
                  }`}
                >
                  X
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 my-1 touch-none">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckAHandlers.onStepLoopLength(-1);
                  }}
                  title="Dividir longitud de Loop (/2)"
                  className="w-20 h-20 rounded bg-[#565B63] hover:bg-[#636972] active:scale-95 border border-[#6E747E] flex items-center justify-center text-white transition touch-none"
                >
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current">
                    <path d="M16 5v14l-11-7z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckAHandlers.onToggleLoop();
                  }}
                  className={`w-44 h-20 rounded border flex items-center justify-center gap-3 text-3xl font-medium transition active:scale-95 touch-none ${
                    deckA.loop.active
                      ? 'bg-[#0099DB] border-white text-[#0B0C0E] font-bold'
                      : 'bg-[#565B63] hover:bg-[#636972] border-[#6E747E] text-white'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-7 h-7 fill-none stroke-current stroke-2"
                  >
                    <path d="M17 2l4 4-4 4" />
                    <path d="M3 11v-1a4 4 0 014-4h14" />
                    <path d="M7 22l-4-4 4-4" />
                    <path d="M21 13v1a4 4 0 01-4 4H3" />
                  </svg>
                  <span>{formatLoopBeatsLabel(deckA.loop.lengthBeats)}</span>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckAHandlers.onStepLoopLength(1);
                  }}
                  title="Duplicar longitud de Loop (x2)"
                  className="w-20 h-20 rounded bg-[#565B63] hover:bg-[#636972] active:scale-95 border border-[#6E747E] flex items-center justify-center text-white transition touch-none"
                >
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 touch-none">
                {deckA.hotCues.map((cue) => (
                  <button
                    key={cue.index}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      deckAHandlers.onTriggerHotCue(cue.index, clearCueModeA);
                    }}
                    className={`h-[68px] rounded border flex flex-col items-center justify-center relative transition active:scale-95 touch-none ${
                      cue.active
                        ? 'bg-[#5E646E] border-[#0099DB] text-white'
                        : 'bg-[#4E535B] hover:bg-[#585E67] border-[#3E4249] text-[#E5E7EB]'
                    }`}
                  >
                    <span className="text-2xl font-normal">{cue.index}</span>
                    {cue.active && cue.positionSec !== null && (
                      <span className="absolute bottom-1 text-[9px] font-mono text-[#0099DB]">
                        {formatTimeCode(cue.positionSec).slice(0, 4)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <CenterRackColumn
              activeSection={activeSection}
              onSelectSection={setActiveSection}
              levelA={meterLevelA}
              levelB={meterLevelB}
              masterVu={masterVu}
            />

            {/* Right Panel: Deck B Loops & 8 Hot Cues */}
            <div className="flex-1 h-full flex flex-col justify-between pl-2">
              <div className="flex items-center justify-end gap-2 touch-none">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setClearCueModeB((x) => !x);
                  }}
                  title="Modo borrar Hot Cue"
                  className={`w-12 h-10 rounded border text-xs font-medium transition touch-none ${
                    clearCueModeB
                      ? 'bg-[#991B1B] border-white text-white'
                      : 'bg-[#262930] border-[#454A54] text-[#D1D5DB]'
                  }`}
                >
                  X
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setSlipModeB((s) => !s);
                  }}
                  className={`w-12 h-10 rounded border text-xs font-medium transition touch-none ${
                    slipModeB
                      ? 'bg-[#3E434D] border-[#0099DB] text-white'
                      : 'bg-[#262930] border-[#454A54] text-[#D1D5DB]'
                  }`}
                >
                  SLIP
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 my-1 touch-none">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckBHandlers.onStepLoopLength(-1);
                  }}
                  title="Dividir longitud de Loop (/2)"
                  className="w-20 h-20 rounded bg-[#565B63] hover:bg-[#636972] active:scale-95 border border-[#6E747E] flex items-center justify-center text-white transition touch-none"
                >
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current">
                    <path d="M16 5v14l-11-7z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckBHandlers.onToggleLoop();
                  }}
                  className={`w-44 h-20 rounded border flex items-center justify-center gap-3 text-3xl font-medium transition active:scale-95 touch-none ${
                    deckB.loop.active
                      ? 'bg-[#0099DB] border-white text-[#0B0C0E] font-bold'
                      : 'bg-[#565B63] hover:bg-[#636972] border-[#6E747E] text-white'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-7 h-7 fill-none stroke-current stroke-2"
                  >
                    <path d="M17 2l4 4-4 4" />
                    <path d="M3 11v-1a4 4 0 014-4h14" />
                    <path d="M7 22l-4-4 4-4" />
                    <path d="M21 13v1a4 4 0 01-4 4H3" />
                  </svg>
                  <span>{formatLoopBeatsLabel(deckB.loop.lengthBeats)}</span>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    deckBHandlers.onStepLoopLength(1);
                  }}
                  title="Duplicar longitud de Loop (x2)"
                  className="w-20 h-20 rounded bg-[#565B63] hover:bg-[#636972] active:scale-95 border border-[#6E747E] flex items-center justify-center text-white transition touch-none"
                >
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 touch-none">
                {deckB.hotCues.map((cue) => (
                  <button
                    key={cue.index}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      deckBHandlers.onTriggerHotCue(cue.index, clearCueModeB);
                    }}
                    className={`h-[68px] rounded border flex flex-col items-center justify-center relative transition active:scale-95 touch-none ${
                      cue.active
                        ? 'bg-[#5E646E] border-[#0099DB] text-white'
                        : 'bg-[#4E535B] hover:bg-[#585E67] border-[#3E4249] text-[#E5E7EB]'
                    }`}
                  >
                    <span className="text-2xl font-normal">{cue.index}</span>
                    {cue.active && cue.positionSec !== null && (
                      <span className="absolute bottom-1 text-[9px] font-mono text-[#0099DB]">
                        {formatTimeCode(cue.positionSec).slice(0, 4)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: FX (Dual X/Y Touch Pads + Real DSP Effect Selector + Lock) */}
        {activeSection === MainSection.FX && (
          <div className="w-full h-full flex items-center justify-between px-3 py-2">
            {/* Left FX Unit (Deck A) */}
            <div className="flex-1 h-full flex flex-col justify-between pr-2 gap-2">
              <div className="h-11 rounded border border-[#454A54] bg-[#25282F] flex items-center">
                <div className="flex-1 relative flex items-center px-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFxDropdownOpenA(!fxDropdownOpenA);
                      setFxDropdownOpenB(false);
                    }}
                    className="w-full flex items-center justify-between bg-transparent text-sm font-medium text-[#0099DB] focus:outline-none cursor-pointer"
                  >
                    <span>
                      {FX_OPTIONS.find((o) => o.value === fxSlots[0].name)?.label || fxSlots[0].name}
                    </span>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#0099DB]">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </button>

                  {fxDropdownOpenA && (
                    <div className="absolute left-0 top-full mt-1 w-56 bg-[#1C1F24] border border-[#454A54] rounded shadow-2xl z-50 py-1">
                      {FX_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFxSlots((prev) =>
                              prev.map((s, idx) =>
                                idx === 0 ? { ...s, name: opt.value } : s
                              )
                            );
                            setFxDropdownOpenA(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm font-medium transition flex items-center justify-between ${
                            fxSlots[0].name === opt.value
                              ? 'bg-[#0099DB]/20 text-[#0099DB]'
                              : 'text-white hover:bg-[#32363F]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {fxSlots[0].name === opt.value && (
                            <span className="w-2 h-2 rounded-full bg-[#0099DB]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextLock = !fxLockA;
                    setFxLockA(nextLock);
                    setFxSlots((prev) =>
                      prev.map((s, idx) =>
                        idx === 0 ? { ...s, active: nextLock } : s
                      )
                    );
                  }}
                  title="Bloquear / Mantener FX activo"
                  className={`w-24 h-full border-l border-[#454A54] flex items-center justify-center transition ${
                    fxLockA
                      ? 'bg-[#0099DB] text-[#0B0C0E]'
                      : 'text-[#F3F4F6] hover:bg-[#32363F]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" />
                  </svg>
                </button>
              </div>

              {/* Deck A 2D X/Y Touch Pad with Full Continuous Drag */}
              <div
                ref={fxPadARef}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore capture error
                  }
                  fxPointerIdARef.current = e.pointerId;
                  updateFxPadFromClientPoint('A', e.clientX, e.clientY, true);
                }}
                onPointerMove={(e) => {
                  if (fxPointerIdARef.current !== e.pointerId) return;
                  e.preventDefault();
                  updateFxPadFromClientPoint('A', e.clientX, e.clientY, false);
                }}
                onPointerUp={(e) => {
                  if (fxPointerIdARef.current !== e.pointerId) return;
                  fxPointerIdARef.current = null;
                  if (!fxLockA) {
                    setFxSlots((prev) =>
                      prev.map((s, idx) =>
                        idx === 0 ? { ...s, active: false } : s
                      )
                    );
                  }
                }}
                onPointerCancel={(e) => {
                  if (fxPointerIdARef.current !== e.pointerId) return;
                  fxPointerIdARef.current = null;
                  if (!fxLockA) {
                    setFxSlots((prev) =>
                      prev.map((s, idx) =>
                        idx === 0 ? { ...s, active: false } : s
                      )
                    );
                  }
                }}
                className="relative flex-1 rounded border border-[#454A54] djb-xy-grid cursor-crosshair overflow-hidden touch-none"
              >
                {fxSlots[0].active && (
                  <>
                    <div
                      style={{ left: `${fxCoordA.x * 100}%` }}
                      className="absolute inset-y-0 w-[1px] bg-[#0099DB]/60 pointer-events-none"
                    />
                    <div
                      style={{ top: `${(1 - fxCoordA.y) * 100}%` }}
                      className="absolute inset-x-0 h-[1px] bg-[#0099DB]/60 pointer-events-none"
                    />
                    <div
                      style={{
                        left: `${fxCoordA.x * 100}%`,
                        top: `${(1 - fxCoordA.y) * 100}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0099DB] border-2 border-white pointer-events-none"
                    />
                  </>
                )}
                <div className="absolute bottom-2 left-2.5 text-[11px] font-mono text-[#9CA3AF] pointer-events-none">
                  DEPTH: {fxSlots[0].wetDry}% ·{' '}
                  {fxSlots[0].name === 'FILTER'
                    ? fxCoordA.x < 0.46
                      ? `LPF ${Math.round((1 - fxCoordA.x / 0.46) * 100)}%`
                      : fxCoordA.x > 0.54
                      ? `HPF ${Math.round(((fxCoordA.x - 0.54) / 0.46) * 100)}%`
                      : 'FLAT'
                    : `TIMING: ${Math.round(fxCoordA.x * 100)}%`}
                </div>
              </div>
            </div>

            <CenterRackColumn
              activeSection={activeSection}
              onSelectSection={setActiveSection}
              levelA={meterLevelA}
              levelB={meterLevelB}
              masterVu={masterVu}
            />

            {/* Right FX Unit (Deck B) */}
            <div className="flex-1 h-full flex flex-col justify-between pl-2 gap-2">
              <div className="h-11 rounded border border-[#454A54] bg-[#25282F] flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    const nextLock = !fxLockB;
                    setFxLockB(nextLock);
                    setFxSlots((prev) =>
                      prev.map((s, idx) =>
                        idx === 1 ? { ...s, active: nextLock } : s
                      )
                    );
                  }}
                  title="Bloquear / Mantener FX activo"
                  className={`w-24 h-full border-r border-[#454A54] flex items-center justify-center transition ${
                    fxLockB
                      ? 'bg-[#0099DB] text-[#0B0C0E]'
                      : 'text-[#F3F4F6] hover:bg-[#32363F]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" />
                  </svg>
                </button>

                <div className="flex-1 relative flex items-center px-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFxDropdownOpenB(!fxDropdownOpenB);
                      setFxDropdownOpenA(false);
                    }}
                    className="w-full flex items-center justify-between bg-transparent text-sm font-medium text-[#0099DB] focus:outline-none cursor-pointer text-right"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#0099DB] order-1">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                    <span className="order-2">
                      {FX_OPTIONS.find((o) => o.value === fxSlots[1].name)?.label || fxSlots[1].name}
                    </span>
                  </button>

                  {fxDropdownOpenB && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-[#1C1F24] border border-[#454A54] rounded shadow-2xl z-50 py-1">
                      {FX_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFxSlots((prev) =>
                              prev.map((s, idx) =>
                                idx === 1 ? { ...s, name: opt.value } : s
                              )
                            );
                            setFxDropdownOpenB(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm font-medium transition flex items-center justify-between ${
                            fxSlots[1].name === opt.value
                              ? 'bg-[#0099DB]/20 text-[#0099DB]'
                              : 'text-white hover:bg-[#32363F]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {fxSlots[1].name === opt.value && (
                            <span className="w-2 h-2 rounded-full bg-[#0099DB]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Deck B 2D X/Y Touch Pad with Full Continuous Drag */}
              <div
                ref={fxPadBRef}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore capture error
                  }
                  fxPointerIdBRef.current = e.pointerId;
                  updateFxPadFromClientPoint('B', e.clientX, e.clientY, true);
                }}
                onPointerMove={(e) => {
                  if (fxPointerIdBRef.current !== e.pointerId) return;
                  e.preventDefault();
                  updateFxPadFromClientPoint('B', e.clientX, e.clientY, false);
                }}
                onPointerUp={(e) => {
                  if (fxPointerIdBRef.current !== e.pointerId) return;
                  fxPointerIdBRef.current = null;
                  if (!fxLockB) {
                    setFxSlots((prev) =>
                      prev.map((s, idx) =>
                        idx === 1 ? { ...s, active: false } : s
                      )
                    );
                  }
                }}
                onPointerCancel={(e) => {
                  if (fxPointerIdBRef.current !== e.pointerId) return;
                  fxPointerIdBRef.current = null;
                  if (!fxLockB) {
                    setFxSlots((prev) =>
                      prev.map((s, idx) =>
                        idx === 1 ? { ...s, active: false } : s
                      )
                    );
                  }
                }}
                className="relative flex-1 rounded border border-[#454A54] djb-xy-grid cursor-crosshair overflow-hidden touch-none"
              >
                {fxSlots[1].active && (
                  <>
                    <div
                      style={{ left: `${fxCoordB.x * 100}%` }}
                      className="absolute inset-y-0 w-[1px] bg-[#0099DB]/60 pointer-events-none"
                    />
                    <div
                      style={{ top: `${(1 - fxCoordB.y) * 100}%` }}
                      className="absolute inset-x-0 h-[1px] bg-[#0099DB]/60 pointer-events-none"
                    />
                    <div
                      style={{
                        left: `${fxCoordB.x * 100}%`,
                        top: `${(1 - fxCoordB.y) * 100}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0099DB] border-2 border-white pointer-events-none"
                    />
                  </>
                )}
                <div className="absolute bottom-2 right-2.5 text-[11px] font-mono text-[#9CA3AF] pointer-events-none">
                  DEPTH: {fxSlots[1].wetDry}% ·{' '}
                  {fxSlots[1].name === 'FILTER'
                    ? fxCoordB.x < 0.46
                      ? `LPF ${Math.round((1 - fxCoordB.x / 0.46) * 100)}%`
                      : fxCoordB.x > 0.54
                      ? `HPF ${Math.round(((fxCoordB.x - 0.54) / 0.46) * 100)}%`
                      : 'FLAT'
                    : `TIMING: ${Math.round(fxCoordB.x * 100)}%`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: PERFORMANCE PADS (8 Pads per Deck · 4 Pages: HOT CUES | BEAT JUMP | STEMS | SAMPLER) */}
        {activeSection === MainSection.PERFORMANCE && (
          <PerformancePadsView
            deckA={deckA}
            deckB={deckB}
            pageA={padPageA}
            pageB={padPageB}
            onChangePageA={setPadPageA}
            onChangePageB={setPadPageB}
            clearCueModeA={clearCueModeA}
            clearCueModeB={clearCueModeB}
            onToggleClearCueA={() => setClearCueModeA((prev) => !prev)}
            onToggleClearCueB={() => setClearCueModeB((prev) => !prev)}
            beatJumpPresetA={beatJumpPresetA}
            beatJumpPresetB={beatJumpPresetB}
            onChangeBeatJumpPresetA={setBeatJumpPresetA}
            onChangeBeatJumpPresetB={setBeatJumpPresetB}
            stemsA={stemsA}
            stemsB={stemsB}
            samplerPadsA={samplerPadsA}
            samplerPadsB={samplerPadsB}
            onTriggerPad={handleTriggerPerformancePad}
            onStopSamplerPad={handleStopSamplerPad}
            onToggleSamplerPadLoop={handleToggleSamplerPadLoop}
            onChangeSamplerPadVolume={handleChangeSamplerPadVolume}
            samplerGain={samplerGain}
            onChangeSamplerGain={setSamplerGain}
            isRecording={isRecording}
            onToggleRecording={() => setIsRecording((r) => !r)}
            samplerEditMode={samplerEditMode}
            onToggleSamplerEditMode={() => setSamplerEditMode((e) => !e)}
            onSelectSection={setActiveSection}
            vdjPadOverrides={vdjPadOverrides}
            stemStatusA={(() => {
              const rec = storedTracks.find((t) => t.id === deckA.trackId);
              return {
                status: rec?.stemPreparationStatus || 'IDLE',
                progress: rec?.stemPreparationProgress || 0,
              };
            })()}
            stemStatusB={(() => {
              const rec = storedTracks.find((t) => t.id === deckB.trackId);
              return {
                status: rec?.stemPreparationStatus || 'IDLE',
                progress: rec?.stemPreparationProgress || 0,
              };
            })()}
            stemNoticeA={stemNoticeA}
            stemNoticeB={stemNoticeB}
            onPrepareDeckStems={(deck) => {
              const tid = deck === 'A' ? deckA.trackId : deckB.trackId;
              if (tid) {
                void stemPreparationQueue.prepareTrack(tid);
              }
            }}
          />
        )}
      </main>

      {/* Persistent Bottom Transport & Crossfader Bar */}
      <BottomTransportBar
        deckA={deckA}
        deckB={deckB}
        crossfader={mixer.crossfader}
        onChangeCrossfader={(val) =>
          setMixer((m) => ({ ...m, crossfader: val }))
        }
        onCueDownA={deckAHandlers.onCueDown}
        onCueUpA={deckAHandlers.onCueUp}
        onPlayA={deckAHandlers.onTogglePlay}
        onSyncA={deckAHandlers.onToggleSync}
        onCueDownB={deckBHandlers.onCueDown}
        onCueUpB={deckBHandlers.onCueUp}
        onPlayB={deckBHandlers.onTogglePlay}
        onSyncB={deckBHandlers.onToggleSync}
        cueLedActiveA={cueLedActiveA}
        playLedActiveA={playLedActiveA}
        syncLedActiveA={syncLedActiveA}
        cueLedActiveB={cueLedActiveB}
        playLedActiveB={playLedActiveB}
        syncLedActiveB={syncLedActiveB}
      />
      <OfflineIndicator />
    </div>
  );
}
