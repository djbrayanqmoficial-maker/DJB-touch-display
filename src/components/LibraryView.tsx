import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { formatTimeCode } from '../core/dj/DjEngine';
import {
  AudioSourceType,
  detectAudioFormatBadge,
  isSupportedAudioFile,
  normalizeFolderPath,
  PlaylistRecord,
  RegisteredFolderRecord,
  StorageVolumeType,
  StoredTrackRecord,
  SUPPORTED_AUDIO_EXTENSIONS,
} from '../core/database/TrackDatabase';
import {
  getCurrentDriveUser,
  getDriveAccessToken,
  GoogleDriveAudioFileItem,
  GoogleDriveBreadcrumb,
  GoogleDriveFolderItem,
  GoogleDriveSection,
  initDriveAuth,
  listGoogleDriveContents,
  signInToGoogleDrive,
  signOutFromGoogleDrive,
} from '../core/drive/GoogleDriveService';
import { ImportQueueStatus } from '../core/import/ImportManager';
import { androidStorageBridge } from '../core/storage/AndroidStorageBridge';
import { StemQueueStatus } from '../core/stems/StemPreparationQueue';

export type LibraryCategoryTab =
  | 'PLAYLISTS'
  | 'SONGS'
  | 'ALBUMS'
  | 'ARTISTS'
  | 'GENRES';

export type LibrarySourceMode =
  | 'ALL_MUSIC'
  | 'LOCAL'
  | 'IMPORTADAS'
  | 'GOOGLE_DRIVE';

export type AllMusicSortField =
  | 'TITLE'
  | 'ARTIST'
  | 'BPM'
  | 'KEY'
  | 'DURATION'
  | 'RECENT';

export interface LibraryNavigableItem {
  kind: 'FOLDER' | 'TRACK' | 'DRIVE_FOLDER' | 'DRIVE_TRACK';
  id: string; // 'folder:<fullPath>' | 'track:<trackId>' | 'gdrive-folder:<id>' | 'gdrive-track:<id>'
  folderPath?: string;
  folderName?: string;
  track?: StoredTrackRecord;
  driveFolder?: GoogleDriveFolderItem;
  driveFile?: GoogleDriveAudioFileItem;
}

export interface LibraryNavigationState {
  activeSource: LibrarySourceMode;
  categoryTab: LibraryCategoryTab;
  localCurrentFolder: string;
  importedCurrentFolder: string;
  selectedItemId: string | null;
  selectedGroupFilter: string | null;
  selectedPlaylistId: string | null;
  searchQuery: string;
  allMusicSortBy?: AllMusicSortField;
  driveSection?: GoogleDriveSection;
  driveBreadcrumbs?: GoogleDriveBreadcrumb[];
  scrollPositions: Record<string, number>;
}

export const DEFAULT_LIBRARY_NAVIGATION_STATE: LibraryNavigationState = {
  activeSource: 'LOCAL',
  categoryTab: 'SONGS',
  localCurrentFolder: '',
  importedCurrentFolder: '',
  selectedItemId: null,
  selectedGroupFilter: null,
  selectedPlaylistId: null,
  searchQuery: '',
  allMusicSortBy: 'TITLE',
  driveSection: 'MY_DRIVE',
  driveBreadcrumbs: [],
  scrollPositions: {},
};

interface FolderNodeSummary {
  name: string;
  fullPath: string;
  directTrackCount: number;
  totalTrackCount: number;
  subfolderCount: number;
  storageVolume: StorageVolumeType;
  storageVolumeLabel?: string;
}

interface LibraryViewProps {
  tracks: StoredTrackRecord[];
  registeredFolders?: RegisteredFolderRecord[];
  playlists: PlaylistRecord[];
  queueStatus: ImportQueueStatus;
  targetDeck: 'A' | 'B';
  onChangeTargetDeck: (deck: 'A' | 'B') => void;
  onImportIndividualFiles: (
    files: FileList,
    sourceType: AudioSourceType,
    targetFolderPath?: string
  ) => void;
  onImportFolderFiles: (
    files: FileList,
    sourceType: AudioSourceType,
    parentFolderPath?: string,
    storageVolume?: StorageVolumeType
  ) => void;
  onPickNativeDirectory?: (
    sourceType: 'LOCAL' | 'IMPORTED',
    parentFolderPath?: string,
    preferredVolumeKind?: StorageVolumeType
  ) => Promise<boolean>;
  onVerifyTracksAvailability?: () => Promise<void>;
  onLoadGoogleDriveFile?: (
    driveItem: GoogleDriveAudioFileItem,
    deck: 'A' | 'B',
    closeLibraryAfterLoad?: boolean
  ) => Promise<void>;
  onRelinkTrackFile?: (trackId: string, file: File) => void;
  onReanalyzeTrack: (trackId: string) => void;
  onAnalyzeAllUnanalyzed: () => void;
  onDeleteTrack: (trackId: string) => void;
  onLoadTrackToDeck: (track: StoredTrackRecord, deck: 'A' | 'B') => void;
  onCreatePlaylist: (name: string) => void;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  onBackToDecks: () => void;
  selectedTrackId?: string | null;
  onSelectTrack?: (trackId: string) => void;
  onVisibleTracksChange?: (visibleTracks: StoredTrackRecord[]) => void;
  navigationState: LibraryNavigationState;
  onNavigationStateChange: React.Dispatch<
    React.SetStateAction<LibraryNavigationState>
  >;
  onNavigableItemsChange?: (items: LibraryNavigableItem[]) => void;
  stemQueueStatus?: StemQueueStatus;
  onPrepareTrackStems?: (trackId: string, force?: boolean) => void;
  onPrepareMultipleTrackStems?: (trackIds: string[]) => void;
  onPrepareFolderStems?: (
    folderPath: string,
    sourceType?: 'LOCAL' | 'IMPORTED'
  ) => void;
  onPauseStemPreparation?: (trackId?: string) => void;
  onResumeStemPreparation?: (trackId?: string) => void;
  onCancelStemPreparation?: (trackId: string) => void;
  onRetryStemPreparation?: (trackId: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = React.memo(({
  tracks,
  registeredFolders = [],
  playlists,
  queueStatus,
  targetDeck,
  onChangeTargetDeck,
  onImportIndividualFiles,
  onImportFolderFiles,
  onPickNativeDirectory,
  onVerifyTracksAvailability,
  onLoadGoogleDriveFile,
  onRelinkTrackFile,
  onReanalyzeTrack,
  onAnalyzeAllUnanalyzed,
  onDeleteTrack,
  onLoadTrackToDeck,
  onCreatePlaylist,
  onToggleTrackInPlaylist,
  onBackToDecks,
  selectedTrackId = null,
  onSelectTrack,
  onVisibleTracksChange,
  navigationState,
  onNavigationStateChange,
  onNavigableItemsChange,
  stemQueueStatus,
  onPrepareTrackStems,
  onPrepareMultipleTrackStems,
  onPrepareFolderStems,
  onPauseStemPreparation,
  onResumeStemPreparation,
  onCancelStemPreparation,
  onRetryStemPreparation,
}) => {
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [importPickerMenuOpen, setImportPickerMenuOpen] = useState(false);
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [pendingUploadSource, setPendingUploadSource] =
    useState<AudioSourceType>('IMPORTED');
  const [pendingStorageVolume, setPendingStorageVolume] =
    useState<StorageVolumeType>('INTERNAL');
  const [relinkTargetTrackId, setRelinkTargetTrackId] = useState<string | null>(
    null
  );

  // Google Drive Auth & Listing State
  const [driveAuthenticated, setDriveAuthenticated] = useState<boolean>(() =>
    Boolean(getDriveAccessToken())
  );
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(
    () => getCurrentDriveUser()?.email || null
  );
  const [driveSigningIn, setDriveSigningIn] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveLoadingFileId, setDriveLoadingFileId] = useState<string | null>(
    null
  );
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveFolders, setDriveFolders] = useState<GoogleDriveFolderItem[]>([]);
  const [driveAudioFiles, setDriveAudioFiles] = useState<
    GoogleDriveAudioFileItem[]
  >([]);
  const autoDriveAuthAttemptedRef = useRef(false);

  const {
    activeSource,
    categoryTab,
    localCurrentFolder,
    importedCurrentFolder,
    selectedItemId,
    selectedGroupFilter,
    selectedPlaylistId,
    searchQuery,
    allMusicSortBy = 'TITLE',
    driveSection = 'MY_DRIVE',
    driveBreadcrumbs = [],
    scrollPositions,
  } = navigationState;

  const individualFileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const relinkFileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevSelectedItemIdRef = useRef<string | null>(selectedItemId);

  const acceptAudioExtensionsString = useMemo(
    () =>
      `${SUPPORTED_AUDIO_EXTENSIONS.join(',')},audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/opus,audio/flac,audio/wav,audio/aiff,audio/x-ms-wma,audio/*`,
    []
  );

  const currentFolderPath =
    activeSource === 'LOCAL'
      ? localCurrentFolder
      : activeSource === 'IMPORTADAS'
      ? importedCurrentFolder
      : '';

  const currentDriveFolderId =
    driveBreadcrumbs.length > 0
      ? driveBreadcrumbs[driveBreadcrumbs.length - 1].id
      : null;
  const currentDriveId =
    driveBreadcrumbs.length > 0
      ? driveBreadcrumbs[driveBreadcrumbs.length - 1].driveId
      : undefined;

  const scrollContextKey = `${activeSource}:${categoryTab}:${currentFolderPath}:${driveSection}:${
    currentDriveFolderId || 'root'
  }:${selectedPlaylistId || ''}:${selectedGroupFilter || ''}`;

  // Automatically verify and recover missing track references when opening IMPORTADAS or LOCAL
  useEffect(() => {
    if (
      activeSource === 'IMPORTADAS' ||
      activeSource === 'LOCAL' ||
      activeSource === 'ALL_MUSIC'
    ) {
      onVerifyTracksAvailability?.();
    }
  }, [activeSource, onVerifyTracksAvailability]);

  // Initialize Firebase Google Drive Auth state listener
  useEffect(() => {
    const unsub = initDriveAuth(
      (user) => {
        setDriveAuthenticated(true);
        setDriveUserEmail(user.email || user.displayName || 'Cuenta conectada');
      },
      () => {
        setDriveAuthenticated(false);
        setDriveUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  const handleGoogleDriveSignIn = useCallback(async () => {
    if (driveSigningIn) return;
    setDriveSigningIn(true);
    setDriveError(null);
    try {
      const res = await signInToGoogleDrive();
      if (res) {
        setDriveAuthenticated(true);
        setDriveUserEmail(
          res.user.email || res.user.displayName || 'Google Drive'
        );
      }
    } catch (err: any) {
      const isCancellation =
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/popup-blocked' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('cancelled-popup-request') ||
            err.message.includes('popup-closed-by-user') ||
            err.message.includes('popup-blocked')));

      if (!isCancellation) {
        setDriveError(
          err?.message ||
            'Error al conectar con Google Drive.'
        );
      }
    } finally {
      setDriveSigningIn(false);
    }
  }, [driveSigningIn]);

  // When selecting Google Drive for the first time, mark attempted so UI is in ready state
  useEffect(() => {
    if (
      activeSource === 'GOOGLE_DRIVE' &&
      !driveAuthenticated &&
      !driveSigningIn &&
      !autoDriveAuthAttemptedRef.current
    ) {
      autoDriveAuthAttemptedRef.current = true;
    }
  }, [
    activeSource,
    driveAuthenticated,
    driveSigningIn,
  ]);

  const driveFolderPathDisplay = useMemo(() => {
    const sectionLabel =
      driveSection === 'MY_DRIVE'
        ? 'Mi unidad'
        : driveSection === 'SHARED_WITH_ME'
        ? 'Compartidos conmigo'
        : 'Unidades compartidas';
    if (driveBreadcrumbs.length === 0) return sectionLabel;
    return [sectionLabel, ...driveBreadcrumbs.map((b) => b.name)].join('/');
  }, [driveSection, driveBreadcrumbs]);

  // Fetch Google Drive folders & audio files when authenticated and inside GOOGLE_DRIVE view
  const refreshGoogleDriveListing = useCallback(async () => {
    if (activeSource !== 'GOOGLE_DRIVE' || !driveAuthenticated) return;
    setDriveLoading(true);
    setDriveError(null);
    try {
      const listing = await listGoogleDriveContents({
        section: driveSection,
        folderId: currentDriveFolderId,
        driveId: currentDriveId,
        folderPathDisplay: driveFolderPathDisplay,
        searchQuery,
      });
      setDriveFolders(listing.folders);
      setDriveAudioFiles(listing.audioFiles);
    } catch (err) {
      const msg = (err as Error)?.message || '';
      if (msg === 'AUTH_REQUIRED') {
        setDriveAuthenticated(false);
      } else {
        setDriveError(msg || 'Error al cargar carpetas de Google Drive.');
      }
    } finally {
      setDriveLoading(false);
    }
  }, [
    activeSource,
    driveAuthenticated,
    driveSection,
    currentDriveFolderId,
    currentDriveId,
    driveFolderPathDisplay,
    searchQuery,
  ]);

  useEffect(() => {
    if (activeSource === 'GOOGLE_DRIVE' && driveAuthenticated) {
      refreshGoogleDriveListing();
    }
  }, [activeSource, driveAuthenticated, refreshGoogleDriveListing]);

  const setActiveSource = (nextSource: LibrarySourceMode) => {
    if (nextSource === 'GOOGLE_DRIVE' && !driveAuthenticated) {
      autoDriveAuthAttemptedRef.current = false;
    }
    onNavigationStateChange((prev) => ({
      ...prev,
      activeSource: nextSource,
    }));
  };

  const setCategoryTab = (nextTab: LibraryCategoryTab) => {
    onNavigationStateChange((prev) => ({
      ...prev,
      categoryTab: nextTab,
    }));
  };

  const setSearchQuery = (nextQuery: string) => {
    onNavigationStateChange((prev) => ({
      ...prev,
      searchQuery: nextQuery,
    }));
  };

  const setSelectedGroupFilter = (nextFilter: string | null) => {
    onNavigationStateChange((prev) => ({
      ...prev,
      selectedGroupFilter: nextFilter,
    }));
  };

  const setSelectedPlaylistId = (nextPlaylistId: string | null) => {
    onNavigationStateChange((prev) => ({
      ...prev,
      selectedPlaylistId: nextPlaylistId,
    }));
  };

  const setAllMusicSortBy = (nextSort: AllMusicSortField) => {
    onNavigationStateChange((prev) => ({
      ...prev,
      allMusicSortBy: nextSort,
    }));
  };

  const setSelectedItemId = (nextItemId: string | null) => {
    onNavigationStateChange((prev) => ({
      ...prev,
      selectedItemId: nextItemId,
    }));
    if (nextItemId && nextItemId.startsWith('track:')) {
      onSelectTrack?.(nextItemId.slice('track:'.length));
    }
  };

  const setCurrentFolderPath = (
    nextPath: string,
    preferredSelectedItemId?: string | null
  ) => {
    const normalized = normalizeFolderPath(nextPath);
    onNavigationStateChange((prev) => ({
      ...prev,
      localCurrentFolder:
        prev.activeSource === 'LOCAL' ? normalized : prev.localCurrentFolder,
      importedCurrentFolder:
        prev.activeSource === 'IMPORTADAS'
          ? normalized
          : prev.importedCurrentFolder,
      selectedItemId:
        preferredSelectedItemId !== undefined
          ? preferredSelectedItemId
          : prev.selectedItemId,
    }));
  };

  // Trigger individual audio files selector (Option A)
  const triggerIndividualFilePicker = (targetSource: AudioSourceType) => {
    setSourceDrawerOpen(false);
    setImportPickerMenuOpen(false);
    setPendingUploadSource(targetSource);
    individualFileInputRef.current?.click();
  };

  // Trigger complete folder selector (Option B) — uses modern Android/Web Directory Picker or webkitdirectory fallback
  const triggerCompleteFolderPicker = async (
    targetSource: 'LOCAL' | 'IMPORTED',
    preferredVolumeKind: StorageVolumeType = 'INTERNAL'
  ) => {
    setSourceDrawerOpen(false);
    setImportPickerMenuOpen(false);
    setPendingUploadSource(targetSource);
    setPendingStorageVolume(preferredVolumeKind);

    if (androidStorageBridge.isAndroidApk()) {
      await androidStorageBridge.requestStoragePermission();
    }

    if (onPickNativeDirectory) {
      const parentPath =
        targetSource === 'LOCAL' ? localCurrentFolder : importedCurrentFolder;
      const handledNatively = await onPickNativeDirectory(
        targetSource,
        parentPath,
        preferredVolumeKind
      );
      if (handledNatively) return;
    }

    folderInputRef.current?.click();
  };

  // Tracks belonging to the currently active source
  const sourceTracks = useMemo(() => {
    if (activeSource === 'LOCAL') {
      return tracks.filter((t) => t.sourceType === 'LOCAL');
    }
    if (activeSource === 'IMPORTADAS') {
      return tracks.filter((t) => t.sourceType === 'IMPORTED');
    }
    if (activeSource === 'ALL_MUSIC') {
      // TODA LA MÚSICA: Flat unified library of all accessible device & imported audio tracks
      return tracks.filter(
        (t) =>
          t.sourceType === 'LOCAL' ||
          t.sourceType === 'IMPORTED' ||
          t.fileAvailable
      );
    }
    if (activeSource === 'GOOGLE_DRIVE') {
      return tracks.filter((t) => t.sourceType === 'GOOGLE_DRIVE');
    }
    return tracks;
  }, [tracks, activeSource]);

  // Compute child folders at `currentFolderPath` for LOCAL and IMPORTADAS (never for ALL_MUSIC)
  const childFoldersAtCurrentLevel = useMemo<FolderNodeSummary[]>(() => {
    if (
      activeSource === 'GOOGLE_DRIVE' ||
      activeSource === 'ALL_MUSIC' ||
      categoryTab !== 'SONGS'
    ) {
      return [];
    }

    const dbSourceType: 'LOCAL' | 'IMPORTED' =
      activeSource === 'LOCAL' ? 'LOCAL' : 'IMPORTED';
    const prefix = currentFolderPath ? `${currentFolderPath}/` : '';
    const q = searchQuery.trim().toLowerCase();

    const folderMap = new Map<
      string,
      {
        name: string;
        fullPath: string;
        directTrackCount: number;
        totalTrackCount: number;
        subfolders: Set<string>;
        storageVolume: StorageVolumeType;
        storageVolumeLabel?: string;
      }
    >();

    const ensureChildFolder = (
      childName: string,
      storageVolume: StorageVolumeType = 'INTERNAL',
      storageVolumeLabel?: string
    ) => {
      if (!childName) return null;
      const fullPath = currentFolderPath
        ? `${currentFolderPath}/${childName}`
        : childName;
      let existing = folderMap.get(fullPath);
      if (!existing) {
        existing = {
          name: childName,
          fullPath,
          directTrackCount: 0,
          totalTrackCount: 0,
          subfolders: new Set<string>(),
          storageVolume,
          storageVolumeLabel,
        };
        folderMap.set(fullPath, existing);
      }
      return existing;
    };

    // 1. Include user-granted registered folders from TrackDatabase
    for (const reg of registeredFolders) {
      if (reg.sourceType !== dbSourceType) continue;
      const norm = normalizeFolderPath(reg.folderPath);
      if (!norm) continue;

      if (!currentFolderPath) {
        const segs = norm.split('/');
        const rootName = segs[0];
        const entry = ensureChildFolder(
          rootName,
          reg.storageVolume,
          reg.storageVolumeLabel
        );
        if (entry && segs.length > 1) {
          entry.subfolders.add(segs[1]);
        }
      } else if (norm.startsWith(prefix)) {
        const remainder = norm.slice(prefix.length);
        const segs = remainder.split('/').filter(Boolean);
        if (segs.length >= 1) {
          const entry = ensureChildFolder(
            segs[0],
            reg.storageVolume,
            reg.storageVolumeLabel
          );
          if (entry && segs.length > 1) {
            entry.subfolders.add(segs[1]);
          }
        }
      }
    }

    // 2. Aggregate tracks into folders & subfolders
    for (const trk of sourceTracks) {
      const norm = normalizeFolderPath(trk.folderPath || '');
      if (!norm) continue;

      if (!currentFolderPath) {
        const segs = norm.split('/');
        const rootName = segs[0];
        const entry = ensureChildFolder(
          rootName,
          trk.storageVolume || 'INTERNAL',
          trk.storageVolumeLabel
        );
        if (entry) {
          entry.totalTrackCount += 1;
          if (segs.length === 1) {
            entry.directTrackCount += 1;
          } else {
            entry.subfolders.add(segs[1]);
          }
        }
      } else if (norm.startsWith(prefix)) {
        const remainder = norm.slice(prefix.length);
        const segs = remainder.split('/').filter(Boolean);
        if (segs.length >= 1) {
          const entry = ensureChildFolder(
            segs[0],
            trk.storageVolume || 'INTERNAL',
            trk.storageVolumeLabel
          );
          if (entry) {
            entry.totalTrackCount += 1;
            if (segs.length === 1) {
              entry.directTrackCount += 1;
            } else {
              entry.subfolders.add(segs[1]);
            }
          }
        }
      }
    }

    let list = Array.from(folderMap.values()).map((f) => ({
      name: f.name,
      fullPath: f.fullPath,
      directTrackCount: f.directTrackCount,
      totalTrackCount: f.totalTrackCount,
      subfolderCount: f.subfolders.size,
      storageVolume: f.storageVolume,
      storageVolumeLabel: f.storageVolumeLabel,
    }));

    if (q) {
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.fullPath.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return list;
  }, [
    activeSource,
    categoryTab,
    currentFolderPath,
    registeredFolders,
    sourceTracks,
    searchQuery,
  ]);

  // Filter & sort tracks for ALL_MUSIC, LOCAL, IMPORTADAS, PLAYLISTS, ALBUMS, ARTISTS, GENRES
  const filteredTracks = useMemo(() => {
    if (activeSource === 'GOOGLE_DRIVE') {
      return [];
    }

    const q = searchQuery.trim().toLowerCase();

    const matching = sourceTracks.filter((t) => {
      if (t.analysisStatus === 'UNSUPPORTED_CODEC') {
        return false;
      }

      if (activeSource === 'ALL_MUSIC') {
        // In TODA LA MÚSICA, folder structure does NOT filter tracks — all tracks appear in one flat list!
        if (categoryTab === 'PLAYLISTS' && selectedPlaylistId) {
          const pl = playlists.find((p) => p.id === selectedPlaylistId);
          if (pl && !pl.trackIds.includes(t.id)) return false;
        } else if (
          (categoryTab === 'ALBUMS' ||
            categoryTab === 'ARTISTS' ||
            categoryTab === 'GENRES') &&
          selectedGroupFilter
        ) {
          if (categoryTab === 'ALBUMS' && t.album !== selectedGroupFilter)
            return false;
          if (categoryTab === 'ARTISTS' && t.artist !== selectedGroupFilter)
            return false;
          if (categoryTab === 'GENRES' && t.genre !== selectedGroupFilter)
            return false;
        }
      } else if (categoryTab === 'PLAYLISTS') {
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
      } else if (categoryTab === 'SONGS') {
        // Hierarchical Folder Explorer filtering in LOCAL and IMPORTADAS
        const trackFolder = normalizeFolderPath(t.folderPath || '');
        if (!q) {
          if (trackFolder !== currentFolderPath) return false;
        } else {
          if (
            currentFolderPath &&
            trackFolder !== currentFolderPath &&
            !trackFolder.startsWith(`${currentFolderPath}/`)
          ) {
            return false;
          }
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

    if (activeSource === 'ALL_MUSIC') {
      const sorted = [...matching];
      sorted.sort((a, b) => {
        switch (allMusicSortBy) {
          case 'TITLE':
            return a.title.localeCompare(b.title, 'es');
          case 'ARTIST':
            return a.artist.localeCompare(b.artist, 'es');
          case 'BPM':
            return (a.bpm || 999) - (b.bpm || 999);
          case 'KEY':
            return (a.key || 'ZZ').localeCompare(b.key || 'ZZ');
          case 'DURATION':
            return b.durationSec - a.durationSec;
          case 'RECENT':
          default:
            return b.addedAt - a.addedAt;
        }
      });
      return sorted;
    }

    return matching;
  }, [
    activeSource,
    sourceTracks,
    searchQuery,
    categoryTab,
    selectedGroupFilter,
    selectedPlaylistId,
    playlists,
    currentFolderPath,
    allMusicSortBy,
  ]);

  // Unified navigable items list (Folders + Songs, including Google Drive folders & songs)
  const navigableItems = useMemo<LibraryNavigableItem[]>(() => {
    const items: LibraryNavigableItem[] = [];

    if (activeSource === 'GOOGLE_DRIVE') {
      for (const df of driveFolders) {
        items.push({
          kind: 'DRIVE_FOLDER',
          id: `gdrive-folder:${df.id}`,
          folderName: df.name,
          driveFolder: df,
        });
      }
      for (const da of driveAudioFiles) {
        const cachedTrack = tracks.find((t) => t.driveFileId === da.id);
        items.push({
          kind: 'DRIVE_TRACK',
          id: `gdrive-track:${da.id}`,
          driveFile: da,
          track: cachedTrack,
        });
      }
      return items;
    }

    if (categoryTab === 'SONGS' && activeSource !== 'ALL_MUSIC') {
      for (const folder of childFoldersAtCurrentLevel) {
        items.push({
          kind: 'FOLDER',
          id: `folder:${folder.fullPath}`,
          folderPath: folder.fullPath,
          folderName: folder.name,
        });
      }
    }

    for (const trk of filteredTracks) {
      items.push({
        kind: 'TRACK',
        id: `track:${trk.id}`,
        track: trk,
      });
    }
    return items;
  }, [
    activeSource,
    categoryTab,
    childFoldersAtCurrentLevel,
    filteredTracks,
    driveFolders,
    driveAudioFiles,
    tracks,
  ]);

  // Keep parent informed of visible tracks and unified navigable items
  useEffect(() => {
    onVisibleTracksChange?.(filteredTracks);
  }, [filteredTracks, onVisibleTracksChange]);

  useEffect(() => {
    onNavigableItemsChange?.(navigableItems);
  }, [navigableItems, onNavigableItemsChange]);

  // Ensure a valid item (folder or song) is selected in the current view without overriding a valid existing selection
  useEffect(() => {
    if (navigableItems.length === 0) return;

    const hasCurrentSelection =
      selectedItemId !== null &&
      navigableItems.some((item) => item.id === selectedItemId);
    if (hasCurrentSelection) return;

    if (selectedTrackId) {
      const matchingTrackItem = navigableItems.find(
        (item) =>
          (item.kind === 'TRACK' || item.kind === 'DRIVE_TRACK') &&
          item.track?.id === selectedTrackId
      );
      if (matchingTrackItem) {
        setSelectedItemId(matchingTrackItem.id);
        return;
      }
    }

    const firstItem = navigableItems[0];
    if (firstItem) {
      setSelectedItemId(firstItem.id);
    }
  }, [navigableItems, selectedItemId, selectedTrackId]);

  // Restore saved scroll position when mounting LibraryView or switching folders/tabs
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const savedScrollTop = scrollPositions[scrollContextKey];
    if (typeof savedScrollTop === 'number' && savedScrollTop >= 0) {
      container.scrollTop = savedScrollTop;
    } else {
      container.scrollTop = 0;
    }
  }, [scrollContextKey]);

  // Automatically scroll the selected item (folder OR song) into view when selection changes
  useEffect(() => {
    if (!selectedItemId) return;
    const rowEl = itemRowRefs.current.get(selectedItemId);
    if (rowEl) {
      const isInitialMount = prevSelectedItemIdRef.current === selectedItemId;
      rowEl.scrollIntoView({
        block: 'nearest',
        behavior: isInitialMount ? 'auto' : 'smooth',
      });
    }
    prevSelectedItemIdRef.current = selectedItemId;
  }, [selectedItemId, navigableItems.length, scrollContextKey]);

  // Group counts for ALBUMS / ARTISTS / GENRES tabs within active source
  const groupedItems = useMemo(() => {
    if (
      categoryTab !== 'ALBUMS' &&
      categoryTab !== 'ARTISTS' &&
      categoryTab !== 'GENRES'
    ) {
      return [];
    }
    const counts = new Map<string, number>();
    sourceTracks.forEach((t) => {
      const key =
        categoryTab === 'ALBUMS'
          ? t.album || 'Unknown'
          : categoryTab === 'ARTISTS'
          ? t.artist || 'Unknown'
          : t.genre || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [sourceTracks, categoryTab]);

  const breadcrumbSegments = useMemo(() => {
    if (!currentFolderPath) return [];
    const parts = currentFolderPath.split('/').filter(Boolean);
    return parts.map((name, idx) => ({
      name,
      path: parts.slice(0, idx + 1).join('/'),
    }));
  }, [currentFolderPath]);

  const allMusicTracksCount = useMemo(
    () =>
      tracks.filter(
        (t) =>
          (t.sourceType === 'LOCAL' ||
            t.sourceType === 'IMPORTED' ||
            t.fileAvailable) &&
          t.analysisStatus !== 'UNSUPPORTED_CODEC'
      ).length,
    [tracks]
  );
  const localTracksCount = useMemo(
    () => tracks.filter((t) => t.sourceType === 'LOCAL').length,
    [tracks]
  );
  const importedTracksCount = useMemo(
    () => tracks.filter((t) => t.sourceType === 'IMPORTED').length,
    [tracks]
  );
  const driveCachedTracksCount = useMemo(
    () => tracks.filter((t) => t.sourceType === 'GOOGLE_DRIVE').length,
    [tracks]
  );

  const localRegisteredFoldersCount = useMemo(
    () => registeredFolders.filter((f) => f.sourceType === 'LOCAL').length,
    [registeredFolders]
  );

  const hasLocalStorageAccess =
    localTracksCount > 0 || localRegisteredFoldersCount > 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#212328] text-[#F3F4F6] flex flex-col select-none">
      {/* 1. Hidden Input for Individual Audio Files (All Compatible Audio Formats) */}
      <input
        ref={individualFileInputRef}
        type="file"
        multiple
        accept={acceptAudioExtensionsString}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const targetFolder =
              pendingUploadSource === 'LOCAL'
                ? localCurrentFolder
                : importedCurrentFolder;
            onImportIndividualFiles(
              e.target.files,
              pendingUploadSource,
              targetFolder
            );
            onNavigationStateChange((prev) => ({
              ...prev,
              activeSource:
                prev.activeSource === 'ALL_MUSIC'
                  ? 'ALL_MUSIC'
                  : pendingUploadSource === 'LOCAL'
                  ? 'LOCAL'
                  : 'IMPORTADAS',
              categoryTab: 'SONGS',
            }));
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* 2. Hidden Input for Complete Folders (Preserves Folder & Subfolder Hierarchy) */}
      <input
        ref={(el) => {
          folderInputRef.current = el;
          if (el) {
            el.setAttribute('webkitdirectory', '');
            el.setAttribute('directory', '');
          }
        }}
        type="file"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const parentFolder =
              pendingUploadSource === 'LOCAL'
                ? localCurrentFolder
                : importedCurrentFolder;
            onImportFolderFiles(
              e.target.files,
              pendingUploadSource,
              parentFolder,
              pendingStorageVolume
            );
            onNavigationStateChange((prev) => ({
              ...prev,
              activeSource:
                prev.activeSource === 'ALL_MUSIC'
                  ? 'ALL_MUSIC'
                  : pendingUploadSource === 'LOCAL'
                  ? 'LOCAL'
                  : 'IMPORTADAS',
              categoryTab: 'SONGS',
            }));
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* 3. Hidden Input for Relinking a Moved / Missing Audio File ("NO ENCONTRADO") */}
      <input
        ref={relinkFileInputRef}
        type="file"
        accept={acceptAudioExtensionsString}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && relinkTargetTrackId && onRelinkTrackFile) {
            if (isSupportedAudioFile(file)) {
              onRelinkTrackFile(relinkTargetTrackId, file);
            }
          }
          setRelinkTargetTrackId(null);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* ====================================================================
          REQUIREMENT 4: FULL-HEIGHT LEFT SLIDE-OUT SIDE PANEL (MENÚ HAMBURGUESA)
          ==================================================================== */}
      {/* Backdrop Overlay (closes side panel on outside touch) */}
      <div
        onClick={() => setSourceDrawerOpen(false)}
        className={`fixed inset-0 z-[100] bg-black/60 transition-opacity duration-300 ${
          sourceDrawerOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Left Side Panel Drawer (starts from left-0, full screen height, slides smoothly) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-[110] w-80 max-w-[85vw] h-full bg-[#16181D] border-r border-[#32363F] shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-out ${
          sourceDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Drawer Header */}
          <div className="bg-[#008ECC] text-white px-4 py-3.5 flex items-center justify-between shrink-0">
            <div>
              <div className="text-sm font-bold tracking-wide">
                FUENTES DE BIBLIOTECA
              </div>
              <div className="text-[11px] text-white/85 font-mono">
                DJB BROWSER · ZERO AUDIO COPY
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSourceDrawerOpen(false)}
              title="Cerrar panel lateral"
              className="w-8 h-8 rounded hover:bg-black/20 flex items-center justify-center text-white font-bold text-base transition"
            >
              ✕
            </button>
          </div>

          {/* Primary Sources List */}
          <div className="p-3 space-y-1.5">
            <div className="px-2 py-1 text-[10px] font-mono text-[#9CA3AF] uppercase tracking-wider">
              SECCIONES DE AUDIO
            </div>

            {/* 1. TODA LA MÚSICA */}
            <button
              type="button"
              onClick={() => {
                setActiveSource('ALL_MUSIC');
                setCategoryTab('SONGS');
                setSourceDrawerOpen(false);
              }}
              className={`w-full text-left px-3 py-3 rounded-md text-xs font-semibold flex items-center justify-between transition border ${
                activeSource === 'ALL_MUSIC'
                  ? 'bg-[#1E2936] text-[#0099DB] border-[#0099DB]/60'
                  : 'bg-[#1C1F26] hover:bg-[#252932] text-[#F3F4F6] border-[#2A2E37]'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">TODA LA MÚSICA</span>
                <span className="text-[10px] text-[#9CA3AF]">
                  Interno · SD · USB OTG · Importadas
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-[#0099DB]">
                {allMusicTracksCount}
              </span>
            </button>

            {/* 2. LOCAL (Real Device Storage Only) */}
            <button
              type="button"
              onClick={() => {
                setActiveSource('LOCAL');
                setCategoryTab('SONGS');
                setSourceDrawerOpen(false);
              }}
              className={`w-full text-left px-3 py-3 rounded-md text-xs font-semibold flex items-center justify-between transition border ${
                activeSource === 'LOCAL'
                  ? 'bg-[#1E2936] text-[#0099DB] border-[#0099DB]/60'
                  : 'bg-[#1C1F26] hover:bg-[#252932] text-[#F3F4F6] border-[#2A2E37]'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">LOCAL</span>
                <span className="text-[10px] text-[#9CA3AF]">
                  Explorador real por carpetas del dispositivo
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-[#D1D5DB]">
                {localTracksCount}
              </span>
            </button>

            {/* 3. IMPORTADAS */}
            <button
              type="button"
              onClick={() => {
                setActiveSource('IMPORTADAS');
                setCategoryTab('SONGS');
                setSourceDrawerOpen(false);
              }}
              className={`w-full text-left px-3 py-3 rounded-md text-xs font-semibold flex items-center justify-between transition border ${
                activeSource === 'IMPORTADAS'
                  ? 'bg-[#1E2936] text-[#0099DB] border-[#0099DB]/60'
                  : 'bg-[#1C1F26] hover:bg-[#252932] text-[#F3F4F6] border-[#2A2E37]'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">IMPORTADAS</span>
                <span className="text-[10px] text-[#9CA3AF]">
                  Canciones y carpetas con auto-recuperación
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-[#0099DB]">
                {importedTracksCount}
              </span>
            </button>

            {/* 4. GOOGLE DRIVE */}
            <button
              type="button"
              onClick={() => {
                setActiveSource('GOOGLE_DRIVE');
                setSourceDrawerOpen(false);
              }}
              className={`w-full text-left px-3 py-3 rounded-md text-xs font-semibold flex items-center justify-between transition border ${
                activeSource === 'GOOGLE_DRIVE'
                  ? 'bg-[#1E2936] text-[#0099DB] border-[#0099DB]/60'
                  : 'bg-[#1C1F26] hover:bg-[#252932] text-[#F3F4F6] border-[#2A2E37]'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">GOOGLE DRIVE</span>
                <span className="text-[10px] text-[#9CA3AF]">
                  {driveAuthenticated
                    ? `Conectado (${driveUserEmail || 'Drive'})`
                    : 'Mi unidad · Compartidos · Streaming'}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  driveAuthenticated
                    ? 'bg-[#0099DB]/20 text-[#0099DB]'
                    : 'bg-black/30 text-[#9CA3AF]'
                }`}
              >
                {driveAuthenticated ? 'ONLINE' : `OAUTH (${driveCachedTracksCount})`}
              </span>
            </button>
          </div>

          {/* Storage Volumes & APK Permissions Section inside Side Panel */}
          <div className="px-3 py-2 border-t border-[#262A32] space-y-2">
            <div className="px-2 text-[10px] font-mono text-[#9CA3AF] uppercase tracking-wider">
              CONECTAR ALMACENAMIENTO DEL DISPOSITIVO
            </div>

            <button
              type="button"
              onClick={() => triggerCompleteFolderPicker('LOCAL', 'INTERNAL')}
              className="w-full text-left px-3 py-2 rounded bg-[#21252D] hover:bg-[#2B303B] border border-[#343944] text-xs text-[#E5E7EB] flex items-center justify-between transition"
            >
              <span>📱 Almacenamiento Interno</span>
              <span className="text-[10px] font-mono text-[#0099DB]">
                CONECTAR
              </span>
            </button>

            <button
              type="button"
              onClick={() => triggerCompleteFolderPicker('LOCAL', 'SD_CARD')}
              className="w-full text-left px-3 py-2 rounded bg-[#21252D] hover:bg-[#2B303B] border border-[#343944] text-xs text-[#E5E7EB] flex items-center justify-between transition"
            >
              <span>💾 Memoria MicroSD</span>
              <span className="text-[10px] font-mono text-[#0099DB]">
                CONECTAR
              </span>
            </button>

            <button
              type="button"
              onClick={() => triggerCompleteFolderPicker('LOCAL', 'USB_OTG')}
              className="w-full text-left px-3 py-2 rounded bg-[#21252D] hover:bg-[#2B303B] border border-[#343944] text-xs text-[#E5E7EB] flex items-center justify-between transition"
            >
              <span>🔌 USB / OTG / Disco Externo</span>
              <span className="text-[10px] font-mono text-[#0099DB]">
                CONECTAR
              </span>
            </button>
          </div>

          {/* Supported Decoders Info Footer inside Side Panel */}
          <div className="mt-auto p-3 border-t border-[#262A32] text-[10px] font-mono text-[#9CA3AF] space-y-1">
            <div className="text-[#D1D5DB] font-semibold">
              DECODIFICADORES DE AUDIO COMPATIBLES:
            </div>
            <div>MP3 · M4A · AAC · OGG · OGA · OPUS · FLAC · WAV · AIFF · ALAC · WMA</div>
            <div className="text-[#686E78]">
              Entorno:{' '}
              {androidStorageBridge.isAndroidApk()
                ? 'APK ANDROID NATIVO'
                : 'WEB / SAF EXPLORER'}
            </div>
          </div>
        </div>
      </aside>

      {/* Top Header Bar */}
      <header className="relative bg-[#008ECC] text-white px-4 pt-2.5 pb-0 shadow-md shrink-0 z-30">
        <div className="flex items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-3">
            {/* Hamburger Audio Source Drawer Trigger */}
            <button
              type="button"
              onClick={() => {
                setSourceDrawerOpen((o) => !o);
                setImportPickerMenuOpen(false);
              }}
              className="p-2 rounded hover:bg-black/15 transition"
              title="Abrir panel lateral de fuentes (TODA LA MÚSICA / LOCAL / IMPORTADAS / GOOGLE DRIVE)"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
              </svg>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold leading-tight">
                  {activeSource === 'GOOGLE_DRIVE'
                    ? 'Google Drive'
                    : activeSource === 'ALL_MUSIC'
                    ? 'Toda la Música'
                    : activeSource === 'IMPORTADAS'
                    ? 'Importadas'
                    : categoryTab === 'SONGS'
                    ? 'Local'
                    : categoryTab}
                </span>
                <span className="text-[11px] font-mono bg-black/20 px-2 py-0.5 rounded">
                  SOURCE:{' '}
                  {activeSource === 'ALL_MUSIC'
                    ? 'TODA LA MÚSICA'
                    : activeSource}
                </span>
              </div>
              <div className="text-xs text-white/85">
                {activeSource === 'GOOGLE_DRIVE'
                  ? `${driveFolders.length} carpetas · ${driveAudioFiles.length} canciones · Deck ${targetDeck}`
                  : `${
                      childFoldersAtCurrentLevel.length > 0
                        ? `${childFoldersAtCurrentLevel.length} carpetas · `
                        : ''
                    }${filteredTracks.length} canciones · Deck ${targetDeck}`}
              </div>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap relative">
            <input
              type="text"
              placeholder="Buscar en Toda la Música, Local, Drive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-56 rounded bg-black/20 border border-white/25 px-3 text-xs text-white placeholder-white/75 focus:outline-none focus:border-white"
            />

            {/* Sort Selector in TODA LA MÚSICA */}
            {activeSource === 'ALL_MUSIC' && (
              <select
                value={allMusicSortBy}
                onChange={(e) =>
                  setAllMusicSortBy(e.target.value as AllMusicSortField)
                }
                title="Ordenar Toda la Música"
                className="h-8 rounded bg-black/25 border border-white/25 px-2.5 text-xs text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="TITLE" className="bg-[#181A1F] text-white">
                  Orden: Título (A-Z)
                </option>
                <option value="ARTIST" className="bg-[#181A1F] text-white">
                  Orden: Artista
                </option>
                <option value="BPM" className="bg-[#181A1F] text-white">
                  Orden: BPM
                </option>
                <option value="KEY" className="bg-[#181A1F] text-white">
                  Orden: Tonalidad (Key)
                </option>
                <option value="DURATION" className="bg-[#181A1F] text-white">
                  Orden: Duración
                </option>
                <option value="RECENT" className="bg-[#181A1F] text-white">
                  Orden: Recientes
                </option>
              </select>
            )}

            {/* Inside IMPORTADAS: Dedicated "IMPORTAR" Button in Top Blue Bar */}
            {activeSource === 'IMPORTADAS' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setImportPickerMenuOpen((o) => !o);
                    setSourceDrawerOpen(false);
                  }}
                  className="h-8 px-3.5 rounded bg-white text-[#008ECC] font-bold text-xs hover:bg-white/90 transition whitespace-nowrap flex items-center gap-1.5 shadow-xs"
                >
                  <span>IMPORTAR</span>
                  <span className="text-[10px]">▼</span>
                </button>

                {importPickerMenuOpen && (
                  <div className="absolute right-0 top-10 w-72 rounded-md bg-[#181A1F] border border-[#383D47] shadow-2xl p-2 z-50 text-[#F3F4F6]">
                    <div className="px-3 py-1.5 text-[10px] font-mono text-[#9CA3AF] border-b border-[#2A2E36]">
                      SELECTOR DE AUDIO (SIN DUPLICAR ARCHIVOS)
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerIndividualFilePicker('IMPORTED')}
                      className="w-full text-left px-3 py-2.5 rounded text-xs font-semibold hover:bg-[#23272F] text-[#F3F4F6] flex flex-col gap-0.5 mt-1"
                    >
                      <span className="text-[#0099DB] font-bold">
                        A) ARCHIVOS INDIVIDUALES
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        MP3, M4A, AAC, OGG, OPUS, FLAC, WAV, AIFF, ALAC, WMA
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerCompleteFolderPicker('IMPORTED', 'INTERNAL')
                      }
                      className="w-full text-left px-3 py-2.5 rounded text-xs font-semibold hover:bg-[#23272F] text-[#F3F4F6] flex flex-col gap-0.5 mt-1 border-t border-[#2A2E36]"
                    >
                      <span className="text-[#0099DB] font-bold">
                        B) CARPETAS COMPLETAS
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        Conservar estructura, subcarpetas y referencias URI
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : activeSource === 'GOOGLE_DRIVE' ? (
              <button
                type="button"
                onClick={() => {
                  if (driveAuthenticated) {
                    refreshGoogleDriveListing();
                  } else {
                    handleGoogleDriveSignIn();
                  }
                }}
                className="h-8 px-3 rounded bg-white text-[#008ECC] font-bold text-xs hover:bg-white/90 transition whitespace-nowrap"
              >
                {driveAuthenticated ? '↻ ACTUALIZAR DRIVE' : 'CONECTAR DRIVE'}
              </button>
            ) : (
              /* Inside LOCAL or TODA LA MÚSICA: Button to connect storage folders (Internal / SD / USB OTG) */
              <button
                type="button"
                onClick={() => triggerCompleteFolderPicker('LOCAL', 'INTERNAL')}
                title="Conceder acceso a carpeta de almacenamiento Interno, tarjeta SD o USB OTG"
                className="h-8 px-3 rounded bg-white text-[#008ECC] font-bold text-xs hover:bg-white/90 transition whitespace-nowrap"
              >
                + CONECTAR ALMACENAMIENTO / SD / USB
              </button>
            )}

            <button
              type="button"
              onClick={onAnalyzeAllUnanalyzed}
              className="h-8 px-2.5 rounded bg-black/20 hover:bg-black/30 text-xs font-semibold tracking-wide transition whitespace-nowrap"
            >
              ANALYSE SONGS
            </button>

            {onPrepareMultipleTrackStems && filteredTracks.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onPrepareMultipleTrackStems(filteredTracks.map((t) => t.id))
                }
                title="Preparar separación de pistas en cola para las canciones visibles (1 por 1)"
                className="h-8 px-2.5 rounded bg-black/25 hover:bg-black/40 border border-white/20 text-xs font-semibold tracking-wide transition whitespace-nowrap"
              >
                PREPARAR COLA STEMS
              </button>
            )}

            <div className="flex items-center bg-black/20 rounded p-0.5">
              <button
                type="button"
                onClick={() => onChangeTargetDeck('A')}
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  targetDeck === 'A'
                    ? 'bg-white text-[#008ECC]'
                    : 'text-white/80'
                }`}
              >
                DECK A
              </button>
              <button
                type="button"
                onClick={() => onChangeTargetDeck('B')}
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  targetDeck === 'B'
                    ? 'bg-white text-[#008ECC]'
                    : 'text-white/80'
                }`}
              >
                DECK B
              </button>
            </div>
          </div>
        </div>

        {/* Category Sub-Tabs (Or Google Drive Root Sections when in GOOGLE_DRIVE) */}
        <div className="flex items-center justify-between pl-14 pr-2">
          {activeSource === 'GOOGLE_DRIVE' ? (
            <div className="flex items-center gap-6 text-xs font-semibold tracking-wider">
              {(
                [
                  { id: 'MY_DRIVE', label: 'MI UNIDAD' },
                  { id: 'SHARED_WITH_ME', label: 'COMPARTIDOS CONMIGO' },
                  { id: 'SHARED_DRIVES', label: 'UNIDADES COMPARTIDAS' },
                ] as const
              ).map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() =>
                    onNavigationStateChange((prev) => ({
                      ...prev,
                      driveSection: sec.id,
                      driveBreadcrumbs: [],
                      selectedItemId: null,
                    }))
                  }
                  className={`py-2.5 border-b-[3px] transition ${
                    driveSection === sec.id
                      ? 'border-white text-white'
                      : 'border-transparent text-white/75 hover:text-white'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-6 text-xs font-semibold tracking-wider">
              {(
                ['PLAYLISTS', 'SONGS', 'ALBUMS', 'ARTISTS', 'GENRES'] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setCategoryTab(tab);
                    setSelectedGroupFilter(null);
                  }}
                  className={`py-2.5 border-b-[3px] transition ${
                    categoryTab === tab
                      ? 'border-white text-white'
                      : 'border-transparent text-white/75 hover:text-white'
                  }`}
                >
                  {tab === 'SONGS'
                    ? activeSource === 'ALL_MUSIC'
                      ? 'TODA LA MÚSICA (LISTA UNIFICADA)'
                      : activeSource === 'IMPORTADAS'
                      ? 'IMPORTADAS (CARPETAS / AUDIO)'
                      : 'LOCAL (ALMACENAMIENTO REAL)'
                    : tab}
                </button>
              ))}
            </div>
          )}

          {/* Background Sequential Analysis & Offline Stem Preparation Progress Indicators */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {queueStatus.isProcessing && (
              <div className="flex items-center gap-2 text-xs font-mono bg-black/25 px-3 py-1 rounded">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>
                  {queueStatus.currentStage}: {queueStatus.currentTrackTitle} (
                  {queueStatus.progressPercent}% · {queueStatus.pendingCount} in
                  queue)
                </span>
              </div>
            )}

            {stemQueueStatus &&
              (stemQueueStatus.isProcessing ||
                stemQueueStatus.isPaused ||
                stemQueueStatus.queuedTrackIds.length > 0) && (
                <div className="flex items-center gap-2 text-xs font-mono bg-[#111822]/90 border border-white/30 px-2.5 py-1 rounded">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      stemQueueStatus.isPaused
                        ? 'bg-[#FBBF24]'
                        : 'bg-[#34D399] animate-pulse'
                    }`}
                  />
                  <span className="max-w-[240px] truncate">
                    {stemQueueStatus.isPaused
                      ? 'STEMS PAUSADO'
                      : 'PREPARANDO STEMS'}
                    : {stemQueueStatus.activeTrackTitle || 'En cola'} (
                    {stemQueueStatus.progressPercent}%
                    {stemQueueStatus.queuedTrackIds.length > 0
                      ? ` · +${stemQueueStatus.queuedTrackIds.length} en cola`
                      : ''}
                    )
                  </span>
                  {stemQueueStatus.isPaused ? (
                    <button
                      type="button"
                      onClick={() =>
                        onResumeStemPreparation?.(
                          stemQueueStatus.activeTrackId || undefined
                        )
                      }
                      title="Reanudar preparación de pistas"
                      className="px-1.5 py-0.5 rounded bg-[#10B981] text-[#0B0C0E] font-bold text-[10px]"
                    >
                      ▶ Reanudar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onPauseStemPreparation?.(
                          stemQueueStatus.activeTrackId || undefined
                        )
                      }
                      title="Pausar preparación de pistas"
                      className="px-1.5 py-0.5 rounded bg-[#F59E0B] text-[#0B0C0E] font-bold text-[10px]"
                    >
                      ⏸ Pausar
                    </button>
                  )}
                  {stemQueueStatus.activeTrackId && (
                    <button
                      type="button"
                      onClick={() =>
                        onCancelStemPreparation?.(
                          stemQueueStatus.activeTrackId!
                        )
                      }
                      title="Cancelar preparación de esta canción"
                      className="px-1.5 py-0.5 rounded bg-[#EF4444] text-white font-bold text-[10px]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
          </div>
        </div>
      </header>

      {/* Floating Return-to-Decks Button (z-[90]: strictly above blue header bar and all library elements; only covered by hamburger drawer z-[100]/z-[110]) */}
      <button
        type="button"
        onClick={onBackToDecks}
        title="Volver a la pantalla anterior (conservando la ubicación actual en la Biblioteca)"
        className="fixed top-[74px] left-4 z-[90] w-11 h-11 rounded-full bg-[#383D47] hover:bg-[#4B515E] border border-[#686E7A] text-white shadow-lg flex items-center justify-center transition"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      {/* Main Content Area */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          onNavigationStateChange((prev) => {
            if (prev.scrollPositions[scrollContextKey] === top) return prev;
            return {
              ...prev,
              scrollPositions: {
                ...prev.scrollPositions,
                [scrollContextKey]: top,
              },
            };
          });
        }}
        className="relative flex-1 overflow-y-auto px-3 py-2"
        onClick={() => {
          if (importPickerMenuOpen) setImportPickerMenuOpen(false);
          if (openMenuTrackId) setOpenMenuTrackId(null);
        }}
      >

        {/* ==================================================================
            REQUIREMENTS 7, 8, 9: GOOGLE DRIVE INTEGRATED CLOUD BROWSER
            ================================================================== */}
        {activeSource === 'GOOGLE_DRIVE' ? (
          <div className="pl-14 pr-2 space-y-2.5">
            {!driveAuthenticated ? (
              <div className="bg-[#181A1F] border border-[#32363F] rounded-md p-6 max-w-2xl mx-auto mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#F3F4F6]">
                      Conectar Google Drive como Fuente de Audio
                    </h3>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      Inicia sesión con tu cuenta de Google para explorar{' '}
                      <strong className="text-white">Mi unidad</strong>,{' '}
                      <strong className="text-white">
                        Compartidos conmigo
                      </strong>{' '}
                      y{' '}
                      <strong className="text-white">
                        Unidades compartidas
                      </strong>{' '}
                      directamente desde el Browser sin descargar toda tu
                      biblioteca al teléfono.
                    </p>
                  </div>
                </div>

                {driveError && (
                  <div className="p-3 rounded bg-[#3B1D1D] border border-[#EF4444]/50 text-xs text-[#FCA5A5]">
                    {driveError}
                  </div>
                )}

                <div className="flex items-center gap-4 pt-1">
                  {/* Official Google Sign-In Material Button */}
                  <button
                    type="button"
                    disabled={driveSigningIn}
                    onClick={handleGoogleDriveSignIn}
                    className="h-10 px-4 rounded bg-white hover:bg-gray-100 text-[#1F1F1F] font-semibold text-xs flex items-center gap-3 shadow transition cursor-pointer disabled:opacity-60"
                  >
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="w-5 h-5 shrink-0"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    <span>
                      {driveSigningIn
                        ? 'Conectando con Google Drive...'
                        : 'Sign in with Google'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Google Drive Breadcrumb & Account Bar */}
                <div className="bg-[#181A1F] border border-[#2F333B] rounded px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs flex-wrap">
                    {driveBreadcrumbs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const exited =
                            driveBreadcrumbs[driveBreadcrumbs.length - 1];
                          const nextCrumbs = driveBreadcrumbs.slice(0, -1);
                          onNavigationStateChange((prev) => ({
                            ...prev,
                            driveBreadcrumbs: nextCrumbs,
                            selectedItemId: exited
                              ? `gdrive-folder:${exited.id}`
                              : null,
                          }));
                        }}
                        className="h-7 px-2.5 rounded bg-[#282D36] hover:bg-[#343B46] border border-[#454B56] text-[#0099DB] font-mono text-[11px] font-bold flex items-center gap-1 mr-1"
                      >
                        <span>⬅</span>
                        <span>Subir nivel</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onNavigationStateChange((prev) => ({
                          ...prev,
                          driveBreadcrumbs: [],
                          selectedItemId: null,
                        }))
                      }
                      className={`px-2 py-1 rounded font-mono text-xs font-bold transition ${
                        driveBreadcrumbs.length === 0
                          ? 'bg-[#0099DB]/20 text-[#0099DB] border border-[#0099DB]/50'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      ☁️{' '}
                      {driveSection === 'MY_DRIVE'
                        ? 'Mi unidad'
                        : driveSection === 'SHARED_WITH_ME'
                        ? 'Compartidos conmigo'
                        : 'Unidades compartidas'}
                    </button>

                    {driveBreadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={crumb.id}>
                        <span className="text-[#686E78] font-mono">/</span>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigationStateChange((prev) => ({
                              ...prev,
                              driveBreadcrumbs: driveBreadcrumbs.slice(
                                0,
                                idx + 1
                              ),
                              selectedItemId: null,
                            }))
                          }
                          className={`px-2 py-1 rounded font-mono text-xs font-semibold transition ${
                            idx === driveBreadcrumbs.length - 1
                              ? 'bg-[#0099DB]/20 text-[#0099DB] border border-[#0099DB]/50'
                              : 'text-[#D1D5DB] hover:text-white'
                          }`}
                        >
                          {crumb.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-[#9CA3AF]">{driveUserEmail}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await signOutFromGoogleDrive();
                        setDriveAuthenticated(false);
                        setDriveFolders([]);
                        setDriveAudioFiles([]);
                      }}
                      className="h-7 px-2.5 rounded bg-[#25282F] hover:bg-[#3B1D1D] border border-[#3E434D] text-[#D1D5DB] hover:text-white transition"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>

                {driveError && (
                  <div className="p-3 rounded bg-[#3B1D1D] border border-[#EF4444]/50 text-xs text-[#FCA5A5]">
                    {driveError}
                  </div>
                )}

                {driveLoading ? (
                  <div className="bg-[#181A1F] border border-[#2F333B] rounded p-6 text-center text-xs font-mono text-[#0099DB]">
                    Cargando carpetas y pistas de audio desde Google Drive...
                  </div>
                ) : (
                  <>
                    {/* Google Drive Folders */}
                    {driveFolders.length > 0 && (
                      <div className="divide-y divide-[#2B2E35] border border-[#2B2E35] rounded bg-[#1B1D22]">
                        {driveFolders.map((folder) => {
                          const itemId = `gdrive-folder:${folder.id}`;
                          const isSelected = selectedItemId === itemId;
                          return (
                            <div
                              key={folder.id}
                              ref={(el) => {
                                if (el) itemRowRefs.current.set(itemId, el);
                                else itemRowRefs.current.delete(itemId);
                              }}
                              onClick={() =>
                                onNavigationStateChange((prev) => ({
                                  ...prev,
                                  driveBreadcrumbs: [
                                    ...(prev.driveBreadcrumbs || []),
                                    {
                                      id: folder.id,
                                      name: folder.name,
                                      driveId: folder.driveId,
                                    },
                                  ],
                                  selectedItemId: null,
                                }))
                              }
                              className={`flex items-center justify-between py-2.5 px-3 cursor-pointer transition gap-3 ${
                                isSelected
                                  ? 'bg-[#1D2833] border-l-2 border-l-[#0099DB]'
                                  : 'hover:bg-[#262A32]'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                <div className="w-11 h-11 rounded bg-[#14161A] border border-[#2F333B] flex items-center justify-center shrink-0 text-[#0099DB]">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="w-6 h-6 fill-current"
                                  >
                                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-[#F3F4F6] truncate">
                                      {folder.name}
                                    </span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#25282F] text-[#9CA3AF]">
                                      {folder.isSharedDriveRoot
                                        ? 'UNIDAD COMPARTIDA'
                                        : 'GOOGLE DRIVE'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-[#9CA3AF] mt-0.5">
                                    Carpeta de Google Drive · {driveFolderPathDisplay}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono text-xs text-[#0099DB]">
                                <span>ABRIR CARPETA</span>
                                <span>▸</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Google Drive Audio Files */}
                    {driveAudioFiles.length > 0 && (
                      <div className="divide-y divide-[#2B2E35]">
                        {driveAudioFiles.map((driveFile) => {
                          const itemId = `gdrive-track:${driveFile.id}`;
                          const isSelected = selectedItemId === itemId;
                          const cachedRecord = tracks.find(
                            (t) => t.driveFileId === driveFile.id
                          );
                          const isStreamingThis =
                            driveLoadingFileId === driveFile.id;
                          const badgeFormat =
                            cachedRecord?.format ||
                            detectAudioFormatBadge(
                              driveFile.name,
                              driveFile.mimeType
                            );

                          const handleTriggerDriveLoad = async (
                            deck: 'A' | 'B'
                          ) => {
                            if (!onLoadGoogleDriveFile) return;
                            setSelectedItemId(itemId);
                            setDriveLoadingFileId(driveFile.id);
                            try {
                              await onLoadGoogleDriveFile(
                                driveFile,
                                deck,
                                true
                              );
                            } catch (err) {
                              setDriveError(
                                (err as Error)?.message ||
                                  'Error al transmitir canción desde Google Drive.'
                              );
                            } finally {
                              setDriveLoadingFileId(null);
                            }
                          };

                          return (
                            <div
                              key={driveFile.id}
                              ref={(el) => {
                                if (el) itemRowRefs.current.set(itemId, el);
                                else itemRowRefs.current.delete(itemId);
                              }}
                              onClick={() => handleTriggerDriveLoad(targetDeck)}
                              className={`flex items-center justify-between py-2.5 px-2 cursor-pointer transition gap-3 ${
                                isSelected
                                  ? 'bg-[#1D2833] border-l-2 border-l-[#0099DB]'
                                  : 'hover:bg-[#2A2D34]'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                <div className="w-11 h-11 rounded bg-[#15171B] border border-[#2F333B] flex flex-col items-center justify-center shrink-0 font-mono">
                                  <span className="text-[10px] font-bold text-[#0099DB]">
                                    {badgeFormat}
                                  </span>
                                  <span className="text-[9px] text-[#9CA3AF]">
                                    CLOUD
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-[#F3F4F6] truncate">
                                      {cachedRecord?.bpm
                                        ? `${cachedRecord.bpm.toFixed(1)} - `
                                        : ''}
                                      {cachedRecord?.title ||
                                        driveFile.name.replace(/\.[^/.]+$/, '')}
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                        isStreamingThis
                                          ? 'bg-[#2B2F37] text-[#FBBF24]'
                                          : cachedRecord?.analysisStatus ===
                                            'READY'
                                          ? 'bg-[#1D2830] text-[#0099DB]'
                                          : 'bg-[#25282F] text-[#9CA3AF]'
                                      }`}
                                    >
                                      {isStreamingThis
                                        ? 'STREAMING & ANALYZING...'
                                        : cachedRecord?.analysisStatus ===
                                          'READY'
                                        ? 'READY (CACHED)'
                                        : 'CLOUD STREAM'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-0.5 flex-wrap">
                                    <span className="font-semibold text-[#D1D5DB]">
                                      {cachedRecord?.artist || 'Google Drive'}
                                    </span>
                                    <span>·</span>
                                    <span>
                                      Album:{' '}
                                      {cachedRecord?.album ||
                                        driveFolderPathDisplay}
                                    </span>
                                    {cachedRecord &&
                                      cachedRecord.durationSec > 0 && (
                                        <>
                                          <span>·</span>
                                          <span className="font-mono tabular-nums text-[#F3F4F6]">
                                            {formatTimeCode(
                                              cachedRecord.durationSec
                                            ).slice(0, 4)}
                                          </span>
                                        </>
                                      )}
                                    <span className="text-[10px] font-mono text-[#686E78] truncate">
                                      [{driveFolderPathDisplay} / {driveFile.name}]
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div
                                className="flex items-center gap-2.5 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="text-right font-mono tabular-nums pr-1">
                                  <div className="text-xs font-bold text-[#0099DB]">
                                    {cachedRecord?.bpm
                                      ? `${cachedRecord.bpm.toFixed(1)} BPM`
                                      : '-- BPM'}
                                  </div>
                                  <div className="text-[11px] text-[#9CA3AF]">
                                    Key: {cachedRecord?.key || 'Auto'}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  disabled={isStreamingThis}
                                  onClick={() => handleTriggerDriveLoad('A')}
                                  className="h-9 px-3 rounded bg-[#32363F] hover:bg-[#0099DB] hover:text-[#0B0C0E] text-xs font-bold text-[#F3F4F6] transition disabled:opacity-50"
                                >
                                  LOAD A
                                </button>
                                <button
                                  type="button"
                                  disabled={isStreamingThis}
                                  onClick={() => handleTriggerDriveLoad('B')}
                                  className="h-9 px-3 rounded bg-[#32363F] hover:bg-[#0099DB] hover:text-[#0B0C0E] text-xs font-bold text-[#F3F4F6] transition disabled:opacity-50"
                                >
                                  LOAD B
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {driveFolders.length === 0 &&
                      driveAudioFiles.length === 0 && (
                        <div className="bg-[#181A1F] border border-[#2F333B] rounded p-6 text-center space-y-2">
                          <div className="text-sm font-bold text-[#F3F4F6]">
                            No se encontraron carpetas ni archivos de audio en
                            esta ubicación de Google Drive
                          </div>
                          <p className="text-xs text-[#9CA3AF]">
                            Solo se muestran carpetas y formatos de audio
                            compatibles.
                          </p>
                        </div>
                      )}
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="pl-14 pr-2 space-y-2.5">
            {/* FOLDER EXPLORER BREADCRUMB & STORAGE BAR (Shown in LOCAL and IMPORTADAS when in SONGS view) */}
            {categoryTab === 'SONGS' && activeSource !== 'ALL_MUSIC' && (
              <div className="bg-[#181A1F] border border-[#2F333B] rounded px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  {currentFolderPath && (
                    <button
                      type="button"
                      onClick={() => {
                        const exitedFolderPath = currentFolderPath;
                        const segs = currentFolderPath
                          .split('/')
                          .filter(Boolean);
                        segs.pop();
                        setCurrentFolderPath(
                          segs.join('/'),
                          `folder:${exitedFolderPath}`
                        );
                      }}
                      className="h-7 px-2.5 rounded bg-[#282D36] hover:bg-[#343B46] border border-[#454B56] text-[#0099DB] font-mono text-[11px] font-bold flex items-center gap-1 mr-1"
                    >
                      <span>⬅</span>
                      <span>Subir nivel</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setCurrentFolderPath('', null)}
                    className={`px-2 py-1 rounded font-mono text-xs font-bold transition ${
                      !currentFolderPath
                        ? 'bg-[#0099DB]/20 text-[#0099DB] border border-[#0099DB]/50'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {activeSource === 'LOCAL' ? '📁 LOCAL' : '📁 IMPORTADAS'}
                  </button>

                  {breadcrumbSegments.map((seg) => (
                    <React.Fragment key={seg.path}>
                      <span className="text-[#686E78] font-mono">/</span>
                      <button
                        type="button"
                        onClick={() => setCurrentFolderPath(seg.path, null)}
                        className={`px-2 py-1 rounded font-mono text-xs font-semibold transition ${
                          seg.path === currentFolderPath
                            ? 'bg-[#0099DB]/20 text-[#0099DB] border border-[#0099DB]/50'
                            : 'text-[#D1D5DB] hover:text-white'
                        }`}
                      >
                        {seg.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                {/* Quick Storage / Import Actions inside current folder */}
                <div className="flex items-center gap-2 text-[11px]">
                  {activeSource === 'LOCAL' ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCompleteFolderPicker('LOCAL', 'INTERNAL')
                        }
                        className="h-7 px-2.5 rounded bg-[#25282F] hover:bg-[#32363F] border border-[#3E434D] text-[#D1D5DB] font-mono"
                      >
                        + Interno
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCompleteFolderPicker('LOCAL', 'SD_CARD')
                        }
                        className="h-7 px-2.5 rounded bg-[#25282F] hover:bg-[#32363F] border border-[#3E434D] text-[#D1D5DB] font-mono"
                      >
                        + Memoria SD
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCompleteFolderPicker('LOCAL', 'USB_OTG')
                        }
                        className="h-7 px-2.5 rounded bg-[#25282F] hover:bg-[#32363F] border border-[#3E434D] text-[#0099DB] font-mono font-semibold"
                      >
                        + USB OTG
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => triggerIndividualFilePicker('IMPORTED')}
                        className="h-7 px-2.5 rounded bg-[#25282F] hover:bg-[#32363F] border border-[#3E434D] text-[#0099DB] font-mono font-semibold"
                      >
                        + Importar Canciones
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCompleteFolderPicker('IMPORTED', 'INTERNAL')
                        }
                        className="h-7 px-2.5 rounded bg-[#25282F] hover:bg-[#32363F] border border-[#3E434D] text-[#D1D5DB] font-mono"
                      >
                        + Importar Carpeta Completa
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* PLAYLISTS BAR */}
            {categoryTab === 'PLAYLISTS' && (
              <div className="bg-[#181A1F] border border-[#2F333B] rounded p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedPlaylistId(null)}
                    className={`h-8 px-3 rounded text-xs font-semibold border ${
                      selectedPlaylistId === null
                        ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB]'
                        : 'bg-[#22262E] text-[#D1D5DB] border-[#383D47]'
                    }`}
                  >
                    All Tracks ({sourceTracks.length})
                  </button>
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className={`h-8 px-3 rounded text-xs font-semibold border ${
                        selectedPlaylistId === pl.id
                          ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB]'
                          : 'bg-[#22262E] text-[#D1D5DB] border-[#383D47]'
                      }`}
                    >
                      {pl.name} ({pl.trackIds.length})
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nueva playlist..."
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className="h-8 rounded bg-[#121417] border border-[#383D47] px-2.5 text-xs text-[#F3F4F6]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newPlaylistName.trim()) return;
                      onCreatePlaylist(newPlaylistName.trim());
                      setNewPlaylistName('');
                    }}
                    className="h-8 px-3 rounded bg-[#0099DB] text-[#0B0C0E] text-xs font-bold"
                  >
                    + Crear Playlist
                  </button>
                </div>
              </div>
            )}

            {/* GROUP FILTER PILLS FOR ALBUMS / ARTISTS / GENRES */}
            {(categoryTab === 'ALBUMS' ||
              categoryTab === 'ARTISTS' ||
              categoryTab === 'GENRES') && (
              <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-[#2B2E35]">
                <button
                  type="button"
                  onClick={() => setSelectedGroupFilter(null)}
                  className={`h-8 px-3 rounded text-xs font-semibold border ${
                    selectedGroupFilter === null
                      ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB]'
                      : 'bg-[#181A1F] text-[#D1D5DB] border-[#383D47]'
                  }`}
                >
                  Todos ({sourceTracks.length})
                </button>
                {groupedItems.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => setSelectedGroupFilter(g.name)}
                    className={`h-8 px-3 rounded text-xs font-semibold border ${
                      selectedGroupFilter === g.name
                        ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB]'
                        : 'bg-[#181A1F] text-[#D1D5DB] border-[#383D47]'
                    }`}
                  >
                    {g.name} ({g.count})
                  </button>
                ))}
              </div>
            )}

            {/* FOLDERS & SUBFOLDERS LIST (File Explorer in LOCAL and IMPORTADAS) */}
            {categoryTab === 'SONGS' &&
              activeSource !== 'ALL_MUSIC' &&
              childFoldersAtCurrentLevel.length > 0 && (
                <div className="divide-y divide-[#2B2E35] border border-[#2B2E35] rounded bg-[#1B1D22]">
                  {childFoldersAtCurrentLevel.map((folder) => {
                    const folderItemId = `folder:${folder.fullPath}`;
                    const isFolderSelected = selectedItemId === folderItemId;

                    return (
                      <div
                        key={folder.fullPath}
                        ref={(el) => {
                          if (el) {
                            itemRowRefs.current.set(folderItemId, el);
                          } else {
                            itemRowRefs.current.delete(folderItemId);
                          }
                        }}
                        onClick={() => {
                          setCurrentFolderPath(folder.fullPath, null);
                        }}
                        className={`flex items-center justify-between py-2.5 px-3 cursor-pointer transition gap-3 ${
                          isFolderSelected
                            ? 'bg-[#1D2833] border-l-2 border-l-[#0099DB]'
                            : 'hover:bg-[#262A32]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-11 h-11 rounded border flex items-center justify-center shrink-0 ${
                              isFolderSelected
                                ? 'bg-[#13222E] border-[#0099DB] text-[#0099DB]'
                                : 'bg-[#14161A] border-[#2F333B] text-[#0099DB]'
                            }`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="w-6 h-6 fill-current"
                            >
                              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#F3F4F6] truncate">
                                {folder.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#25282F] text-[#9CA3AF]">
                                {folder.storageVolumeLabel ||
                                  folder.storageVolume}
                              </span>
                              {isFolderSelected && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0099DB]/20 text-[#0099DB] border border-[#0099DB]/40">
                                  SELECCIONADA (ENTER = ABRIR)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#9CA3AF] mt-0.5 flex items-center gap-2">
                              <span>
                                {folder.subfolderCount > 0
                                  ? `${folder.subfolderCount} subcarpetas · `
                                  : ''}
                                {folder.totalTrackCount} archivos de audio
                              </span>
                              <span className="text-[10px] font-mono text-[#686E78]">
                                ({folder.fullPath})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2 shrink-0 font-mono text-xs text-[#0099DB]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onPrepareFolderStems && (
                            <button
                              type="button"
                              onClick={() =>
                                onPrepareFolderStems(
                                  folder.fullPath,
                                  activeSource === 'LOCAL'
                                    ? 'LOCAL'
                                    : 'IMPORTED'
                                )
                              }
                              title="Preparar separación de pistas en cola para todas las canciones de esta carpeta"
                              className="h-8 px-2.5 rounded bg-[#25282F] hover:bg-[#0099DB] hover:text-[#0B0C0E] border border-[#3E434D] text-[11px] font-bold text-[#D1D5DB] transition"
                            >
                              🎛 Preparar carpeta
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentFolderPath(folder.fullPath, null)
                            }
                            className="flex items-center gap-1 hover:underline"
                          >
                            <span>ABRIR CARPETA</span>
                            <span>▸</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            {/* EMPTY / PERMISSION STATE WHEN NO REAL STORAGE IS CONNECTED YET */}
            {categoryTab === 'SONGS' &&
              childFoldersAtCurrentLevel.length === 0 &&
              filteredTracks.length === 0 && (
                <div className="bg-[#181A1F] border border-[#2F333B] rounded p-6 text-center space-y-3">
                  <div className="text-sm font-bold text-[#F3F4F6]">
                    {activeSource === 'LOCAL' && !hasLocalStorageAccess
                      ? 'Se requiere acceso al almacenamiento real del dispositivo'
                      : activeSource === 'ALL_MUSIC'
                      ? 'No se han detectado archivos de audio en los almacenamientos accesibles'
                      : activeSource === 'IMPORTADAS'
                      ? 'No hay canciones ni carpetas registradas en IMPORTADAS'
                      : 'No se encontraron archivos de audio en esta carpeta'}
                  </div>
                  <p className="text-xs text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
                    {activeSource === 'LOCAL' && !hasLocalStorageAccess
                      ? 'LOCAL muestra únicamente carpetas y archivos reales del almacenamiento del dispositivo (Almacenamiento Interno, Tarjeta MicroSD y USB OTG). Concede permiso o selecciona la carpeta de almacenamiento para explorar tus canciones sin duplicar archivos.'
                      : 'Compatible con MP3, M4A, AAC, OGG, OGA, OPUS, FLAC, WAV, AIFF, ALAC y WMA soportados por el decodificador del dispositivo.'}
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
                    {activeSource === 'IMPORTADAS' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            triggerIndividualFilePicker('IMPORTED')
                          }
                          className="h-9 px-4 rounded bg-[#0099DB] text-[#0B0C0E] text-xs font-bold"
                        >
                          + Importar Archivos Individuales
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            triggerCompleteFolderPicker('IMPORTED', 'INTERNAL')
                          }
                          className="h-9 px-4 rounded bg-[#282D36] border border-[#454B56] text-xs font-semibold text-[#F3F4F6]"
                        >
                          + Importar Carpeta Completa
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            triggerCompleteFolderPicker('LOCAL', 'INTERNAL')
                          }
                          className="h-9 px-4 rounded bg-[#0099DB] text-[#0B0C0E] text-xs font-bold"
                        >
                          + Conceder Acceso a Almacenamiento Interno
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            triggerCompleteFolderPicker('LOCAL', 'SD_CARD')
                          }
                          className="h-9 px-4 rounded bg-[#282D36] border border-[#454B56] text-xs font-semibold text-[#F3F4F6]"
                        >
                          + Conectar Tarjeta SD
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            triggerCompleteFolderPicker('LOCAL', 'USB_OTG')
                          }
                          className="h-9 px-4 rounded bg-[#282D36] border border-[#454B56] text-xs font-semibold text-[#F3F4F6]"
                        >
                          + Conectar USB / OTG
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

            {/* TRACKS LIST (Compatible Audio Files Only) */}
            <div className="divide-y divide-[#2B2E35]">
              {filteredTracks.map((trk) => {
                const isMissing =
                  trk.fileAvailable === false ||
                  trk.analysisStatus === 'MISSING_FILE';
                const isReady = !isMissing && trk.analysisStatus === 'READY';
                const trackItemId = `track:${trk.id}`;
                const isMidiSelected =
                  selectedItemId === trackItemId ||
                  (selectedItemId === null && selectedTrackId === trk.id);

                return (
                  <div
                    key={trk.id}
                    ref={(el) => {
                      if (el) {
                        itemRowRefs.current.set(trackItemId, el);
                      } else {
                        itemRowRefs.current.delete(trackItemId);
                      }
                    }}
                    onClick={() => {
                      setSelectedItemId(trackItemId);
                      onSelectTrack?.(trk.id);
                      if (isMissing) {
                        setRelinkTargetTrackId(trk.id);
                        relinkFileInputRef.current?.click();
                        return;
                      }
                      onLoadTrackToDeck(trk, targetDeck);
                    }}
                    className={`flex items-center justify-between py-2.5 px-2 cursor-pointer transition gap-3 ${
                      isMidiSelected
                        ? 'bg-[#1D2833] border-l-2 border-l-[#0099DB]'
                        : 'hover:bg-[#2A2D34]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded bg-[#15171B] border border-[#2F333B] flex flex-col items-center justify-center shrink-0 font-mono">
                        <span className="text-[10px] font-bold text-[#0099DB]">
                          {trk.format}
                        </span>
                        <span className="text-[9px] text-[#9CA3AF]">
                          {trk.sampleRate
                            ? `${(trk.sampleRate / 1000).toFixed(1)}k`
                            : '--'}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#F3F4F6] truncate">
                            {trk.bpm ? `${trk.bpm.toFixed(1)} - ` : ''}
                            {trk.title}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isMissing
                                ? 'bg-[#451A1A] text-[#FCA5A5] border border-[#EF4444]'
                                : isReady
                                ? 'bg-[#1D2830] text-[#0099DB]'
                                : trk.analysisStatus === 'ERROR'
                                ? 'bg-[#3B1D1D] text-[#F87171]'
                                : 'bg-[#2B2F37] text-[#FBBF24]'
                            }`}
                          >
                            {isMissing
                              ? 'NO ENCONTRADO'
                              : trk.analysisStatus}
                            {!isMissing &&
                            !isReady &&
                            trk.analysisStatus !== 'ERROR'
                              ? ` ${trk.analysisProgress}%`
                              : ''}
                          </span>

                          {/* Per-Song Stem Preparation Status Badge */}
                          {trk.stemPreparationStatus === 'READY' ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#112A24] border border-[#10B981]/60 text-[#34D399] font-bold">
                              ✓ COMPLETADO (STEMS LISTOS)
                            </span>
                          ) : trk.stemPreparationStatus === 'PREPARING' ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2B2412] border border-[#F59E0B] text-[#FBBF24] font-bold flex items-center gap-1.5">
                              <span>
                                PREPARANDO {trk.stemPreparationProgress || 0}%
                              </span>
                            </span>
                          ) : trk.stemPreparationStatus === 'QUEUED' ||
                            trk.stemPreparationStatus === 'PENDING' ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1D2833] border border-[#0099DB]/60 text-[#0099DB]">
                              STEMS: PENDIENTE
                            </span>
                          ) : trk.stemPreparationStatus === 'PAUSED' ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2B2412] border border-[#F59E0B]/60 text-[#FBBF24]">
                              STEMS: PAUSADO ({trk.stemPreparationProgress || 0}
                              %)
                            </span>
                          ) : trk.stemPreparationStatus === 'CANCELLED' ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#25282F] border border-[#6B7280]/60 text-[#9CA3AF]">
                              STEMS: CANCELADO
                            </span>
                          ) : trk.stemPreparationStatus === 'ERROR' ? (
                            <span
                              title={
                                trk.stemPreparationError ||
                                'Error al separar pistas'
                              }
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#3B1D1D] border border-[#EF4444] text-[#FCA5A5]"
                            >
                              STEMS: ERROR
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1E2026] text-[#6B7280]">
                              No preparado
                            </span>
                          )}

                          {activeSource === 'ALL_MUSIC' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#25282F] text-[#9CA3AF]">
                              {trk.storageVolumeLabel || trk.storageVolume}
                            </span>
                          )}
                        </div>

                        {/* Inline Progress Bar when Preparing or Paused */}
                        {(trk.stemPreparationStatus === 'PREPARING' ||
                          trk.stemPreparationStatus === 'PAUSED') && (
                          <div className="mt-1.5 flex items-center gap-2 max-w-md">
                            <div className="flex-1 h-1.5 rounded-full bg-[#14161A] overflow-hidden border border-[#2F333B]">
                              <div
                                style={{
                                  width: `${Math.max(
                                    2,
                                    Math.min(
                                      100,
                                      trk.stemPreparationProgress || 0
                                    )
                                  )}%`,
                                }}
                                className={`h-full transition-all duration-200 ${
                                  trk.stemPreparationStatus === 'PAUSED'
                                    ? 'bg-[#F59E0B]'
                                    : 'bg-[#0099DB]'
                                }`}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-[#D1D5DB]">
                              {trk.stemPreparationProgress || 0}%
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-0.5 flex-wrap">
                          <span className="font-semibold text-[#D1D5DB]">
                            {trk.artist}
                          </span>
                          <span>·</span>
                          <span>Album: {trk.album}</span>
                          <span>·</span>
                          <span>Genre: {trk.genre}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums text-[#F3F4F6]">
                            {trk.durationSec > 0
                              ? formatTimeCode(trk.durationSec).slice(0, 4)
                              : '--:--'}
                          </span>
                          <span className="text-[10px] font-mono text-[#686E78] truncate max-w-[280px]">
                            [{trk.folderPath || trk.originFolder || 'Raíz'} /{' '}
                            {trk.fileName || trk.location}]
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Side Metadata & Deck Load / Relink Buttons */}
                    <div
                      className="flex items-center gap-2.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-right font-mono tabular-nums pr-1">
                        <div className="text-xs font-bold text-[#0099DB]">
                          {trk.bpm ? `${trk.bpm.toFixed(1)} BPM` : '-- BPM'}
                          {trk.bpmConfidence > 0 && (
                            <span className="text-[9px] text-[#9CA3AF] ml-1">
                              ({trk.bpmConfidence}%)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF]">
                          Key: {trk.key || 'Unknown'}
                          {trk.keyConfidence > 0 && trk.key !== 'Unknown' && (
                            <span className="text-[9px] text-[#6B7280] ml-1">
                              ({trk.keyConfidence}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedPlaylistId && (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleTrackInPlaylist(selectedPlaylistId, trk.id)
                          }
                          className="h-8 px-2 rounded bg-[#25282F] border border-[#3E434D] text-[11px] text-[#D1D5DB]"
                        >
                          ± Playlist
                        </button>
                      )}

                      {isMissing ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemId(trackItemId);
                            onSelectTrack?.(trk.id);
                            setRelinkTargetTrackId(trk.id);
                            relinkFileInputRef.current?.click();
                          }}
                          title="Localizar nuevamente el archivo de audio sin duplicarlo"
                          className="h-9 px-3 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold text-white transition"
                        >
                          LOCALIZAR ARCHIVO
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemId(trackItemId);
                              onSelectTrack?.(trk.id);
                              onLoadTrackToDeck(trk, 'A');
                            }}
                            className="h-9 px-3 rounded bg-[#32363F] hover:bg-[#0099DB] hover:text-[#0B0C0E] text-xs font-bold text-[#F3F4F6] transition"
                          >
                            LOAD A
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemId(trackItemId);
                              onSelectTrack?.(trk.id);
                              onLoadTrackToDeck(trk, 'B');
                            }}
                            className="h-9 px-3 rounded bg-[#32363F] hover:bg-[#0099DB] hover:text-[#0B0C0E] text-xs font-bold text-[#F3F4F6] transition"
                          >
                            LOAD B
                          </button>
                        </>
                      )}

                      {/* Inline Quick Controls when Stem Separation is Preparing / Paused / Queued / Error */}
                      {trk.stemPreparationStatus === 'PREPARING' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onPauseStemPreparation?.(trk.id)}
                            title="Pausar preparación de pistas"
                            className="h-8 px-2 rounded bg-[#2B2412] hover:bg-[#F59E0B] hover:text-[#0B0C0E] border border-[#F59E0B] text-[11px] font-mono font-bold text-[#FBBF24] transition"
                          >
                            ⏸
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelStemPreparation?.(trk.id)}
                            title="Cancelar preparación de pistas"
                            className="h-8 px-2 rounded bg-[#3B1D1D] hover:bg-[#EF4444] border border-[#EF4444] text-[11px] font-mono font-bold text-[#FCA5A5] hover:text-white transition"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {trk.stemPreparationStatus === 'PAUSED' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onResumeStemPreparation?.(trk.id)}
                            title="Reanudar preparación de pistas"
                            className="h-8 px-2 rounded bg-[#112A24] hover:bg-[#10B981] hover:text-[#0B0C0E] border border-[#10B981] text-[11px] font-mono font-bold text-[#34D399] transition"
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelStemPreparation?.(trk.id)}
                            title="Cancelar preparación de pistas"
                            className="h-8 px-2 rounded bg-[#3B1D1D] hover:bg-[#EF4444] border border-[#EF4444] text-[11px] font-mono font-bold text-[#FCA5A5] hover:text-white transition"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {(trk.stemPreparationStatus === 'QUEUED' ||
                        trk.stemPreparationStatus === 'PENDING') && (
                        <button
                          type="button"
                          onClick={() => onCancelStemPreparation?.(trk.id)}
                          title="Quitar de la cola de preparación"
                          className="h-8 px-2 rounded bg-[#25282F] hover:bg-[#EF4444] border border-[#3E434D] text-[11px] font-mono text-[#9CA3AF] hover:text-white transition"
                        >
                          ✕ Cola
                        </button>
                      )}
                      {(trk.stemPreparationStatus === 'ERROR' ||
                        trk.stemPreparationStatus === 'CANCELLED') && (
                        <button
                          type="button"
                          onClick={() => onRetryStemPreparation?.(trk.id)}
                          title="Reintentar preparación de pistas"
                          className="h-8 px-2.5 rounded bg-[#3B1D1D] hover:bg-[#EF4444] border border-[#EF4444] text-[11px] font-mono font-bold text-[#FCA5A5] hover:text-white transition"
                        >
                          ↻ Reintentar
                        </button>
                      )}

                      {/* Three-Dots Menu "⋮" per Song */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuTrackId((prev) =>
                              prev === trk.id ? null : trk.id
                            )
                          }
                          title="Opciones de canción (Analizar canción, Preparar separación de pistas...)"
                          className={`h-9 w-9 rounded border flex items-center justify-center text-base font-bold transition ${
                            openMenuTrackId === trk.id
                              ? 'bg-[#0099DB] text-[#0B0C0E] border-[#0099DB]'
                              : 'bg-[#25282F] hover:bg-[#32363F] border-[#3E434D] text-[#E5E7EB]'
                          }`}
                        >
                          ⋮
                        </button>

                        {openMenuTrackId === trk.id && (
                          <div className="absolute right-0 top-10 w-64 rounded-md bg-[#16181D] border border-[#383D47] shadow-2xl py-1.5 z-50 text-xs text-[#F3F4F6]">
                            <div className="px-3 py-1 text-[10px] font-mono text-[#9CA3AF] border-b border-[#262A32] truncate">
                              {trk.artist} — {trk.title}
                            </div>

                            {/* Option 1: Analizar canción */}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuTrackId(null);
                                onReanalyzeTrack(trk.id);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#232730] flex items-center justify-between gap-2 transition"
                            >
                              <span>🔍 Analizar canción</span>
                              <span className="text-[10px] font-mono text-[#9CA3AF]">
                                BPM / Key / Grid
                              </span>
                            </button>

                            {/* Option 2: Preparar separación de pistas */}
                            {!isMissing && (
                              <>
                                {trk.stemPreparationStatus === 'PREPARING' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTrackId(null);
                                        onPauseStemPreparation?.(trk.id);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-[#232730] text-[#FBBF24] font-semibold flex items-center justify-between gap-2 transition"
                                    >
                                      <span>⏸ Pausar preparación de pistas</span>
                                      <span className="text-[10px] font-mono">
                                        {trk.stemPreparationProgress || 0}%
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTrackId(null);
                                        onCancelStemPreparation?.(trk.id);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-[#3B1D1D] text-[#FCA5A5] flex items-center justify-between gap-2 transition"
                                    >
                                      <span>✕ Cancelar preparación</span>
                                    </button>
                                  </>
                                ) : trk.stemPreparationStatus === 'PAUSED' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTrackId(null);
                                        onResumeStemPreparation?.(trk.id);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-[#232730] text-[#34D399] font-semibold flex items-center justify-between gap-2 transition"
                                    >
                                      <span>▶ Reanudar preparación de pistas</span>
                                      <span className="text-[10px] font-mono">
                                        {trk.stemPreparationProgress || 0}%
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTrackId(null);
                                        onCancelStemPreparation?.(trk.id);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-[#3B1D1D] text-[#FCA5A5] flex items-center justify-between gap-2 transition"
                                    >
                                      <span>✕ Cancelar preparación</span>
                                    </button>
                                  </>
                                ) : trk.stemPreparationStatus === 'QUEUED' ||
                                  trk.stemPreparationStatus === 'PENDING' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuTrackId(null);
                                      onCancelStemPreparation?.(trk.id);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[#3B1D1D] text-[#FCA5A5] flex items-center justify-between gap-2 transition"
                                  >
                                    <span>✕ Cancelar / quitar de la cola</span>
                                  </button>
                                ) : trk.stemPreparationStatus === 'ERROR' ||
                                  trk.stemPreparationStatus === 'CANCELLED' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuTrackId(null);
                                      onRetryStemPreparation?.(trk.id);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[#232730] text-[#FCA5A5] font-semibold flex items-center justify-between gap-2 transition"
                                  >
                                    <span>↻ Reintentar preparación de pistas</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuTrackId(null);
                                      onPrepareTrackStems?.(
                                        trk.id,
                                        trk.stemPreparationStatus === 'READY'
                                      );
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[#232730] text-[#0099DB] font-semibold flex items-center justify-between gap-2 transition"
                                  >
                                    <span>
                                      {trk.stemPreparationStatus === 'READY'
                                        ? '✓ Stems listos (Re-preparar pistas)'
                                        : '🎛 Preparar separación de pistas'}
                                    </span>
                                    <span className="text-[10px] font-mono text-[#34D399]">
                                      4 STEMS
                                    </span>
                                  </button>
                                )}
                              </>
                            )}

                            {/* Deck Load Actions inside Menu */}
                            {!isMissing && (
                              <div className="border-t border-[#262A32] mt-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuTrackId(null);
                                    setSelectedItemId(trackItemId);
                                    onSelectTrack?.(trk.id);
                                    onLoadTrackToDeck(trk, 'A');
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#232730] text-[#D1D5DB] flex items-center justify-between"
                                >
                                  <span>Cargar en Deck A</span>
                                  <span className="font-mono text-[10px] text-[#0099DB]">
                                    LOAD A
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuTrackId(null);
                                    setSelectedItemId(trackItemId);
                                    onSelectTrack?.(trk.id);
                                    onLoadTrackToDeck(trk, 'B');
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#232730] text-[#D1D5DB] flex items-center justify-between"
                                >
                                  <span>Cargar en Deck B</span>
                                  <span className="font-mono text-[10px] text-[#0099DB]">
                                    LOAD B
                                  </span>
                                </button>
                              </div>
                            )}

                            {(trk.sourceType ===
                              ('IMPORTED' as AudioSourceType) ||
                              trk.sourceType ===
                                ('GOOGLE_DRIVE' as AudioSourceType)) && (
                              <div className="border-t border-[#262A32] mt-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuTrackId(null);
                                    onDeleteTrack(trk.id);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#3B1D1D] text-[#FCA5A5] flex items-center justify-between"
                                >
                                  <span>Quitar de la biblioteca</span>
                                  <span>×</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
