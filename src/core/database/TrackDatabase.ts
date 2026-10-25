/**
 * DJ Core — Lightweight Reference-Only Track Database & Persistent Analysis Cache (IndexedDB v4)
 *
 * CRITICAL ARCHITECTURE GUARANTEE:
 * - NEVER copies or duplicates raw audio files into IndexedDB or app storage.
 * - Stores ONLY lightweight metadata references (URI, fileName, folderPath, title, artist, album,
 *   genre, duration, BPM, musical key, Beat Grid offset/resolution, and compact waveform peaks).
 * - Persists OS FileSystemFileHandle (`file_handles`) and FileSystemDirectoryHandle (`directory_handles`)
 *   references for zero-copy playback and automatic recovery of moved/reconnected files.
 * - Supports comprehensive audio format detection with real device codec verification.
 */

import { HotCueSlot } from '../dj/DjEngine';
import { isExcludedSystemOrAppPath } from '../storage/AndroidStorageBridge';

export type TrackAnalysisStatus =
  | 'PENDING'
  | 'REGISTERING'
  | 'ANALYZING'
  | 'GENERATING_WAVEFORM'
  | 'SAVING'
  | 'READY'
  | 'MISSING_FILE'
  | 'UNSUPPORTED_CODEC'
  | 'ERROR';

export type TrackStemPreparationStatus =
  | 'NONE'
  | 'IDLE'
  | 'PENDING'
  | 'QUEUED'
  | 'PREPARING'
  | 'PAUSED'
  | 'CANCELLED'
  | 'READY'
  | 'ERROR';

export type AudioSourceType = 'LOCAL' | 'IMPORTED' | 'GOOGLE_DRIVE';

export type StorageVolumeType =
  | 'INTERNAL'
  | 'SD_CARD'
  | 'USB_OTG'
  | 'EXTERNAL_HDD'
  | 'CLOUD';

/**
 * Comprehensive Audio Extensions & Candidate MIME Types for Decoder Probing
 * Covers: MP3, M4A, AAC, OGG, OGA, OPUS, FLAC, WAV, AIFF, ALAC, WMA, WEBA, AMR, 3GP
 */
export const AUDIO_EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/aac'],
  '.mp4': ['audio/mp4', 'audio/aac'],
  '.m4b': ['audio/mp4', 'audio/x-m4a'],
  '.aac': ['audio/aac', 'audio/aacp', 'audio/mp4'],
  '.ogg': ['audio/ogg', 'audio/vorbis', 'application/ogg'],
  '.oga': ['audio/ogg', 'audio/vorbis'],
  '.opus': [
    'audio/opus',
    'audio/ogg; codecs=opus',
    'audio/webm; codecs=opus',
  ],
  '.flac': ['audio/flac', 'audio/x-flac'],
  '.wav': ['audio/wav', 'audio/x-wav', 'audio/vnd.wave'],
  '.wave': ['audio/wav', 'audio/x-wav'],
  '.aiff': ['audio/aiff', 'audio/x-aiff'],
  '.aif': ['audio/aiff', 'audio/x-aiff'],
  '.aifc': ['audio/aiff', 'audio/x-aiff'],
  '.alac': ['audio/mp4; codecs=alac', 'audio/x-m4a', 'audio/alac'],
  '.wma': ['audio/x-ms-wma', 'audio/wma'],
  '.weba': ['audio/webm', 'audio/webm; codecs=opus', 'audio/webm; codecs=vorbis'],
  '.amr': ['audio/amr', 'audio/3gpp'],
  '.3gp': ['audio/3gpp'],
};

export const SUPPORTED_AUDIO_EXTENSIONS = Object.keys(
  AUDIO_EXTENSION_MIME_MAP
) as readonly string[];

let sharedAudioProber: HTMLAudioElement | null = null;
const codecSupportCache = new Map<string, boolean>();

function getAudioProber(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;
  if (!sharedAudioProber) {
    sharedAudioProber = document.createElement('audio');
  }
  return sharedAudioProber;
}

export function extractFileExtension(fileName: string): string {
  const clean = (fileName || '').trim().toLowerCase();
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx === -1) return '';
  return clean.slice(dotIdx);
}

export function detectAudioFormatBadge(
  fileName: string,
  mimeType = ''
): string {
  const ext = extractFileExtension(fileName);
  const mime = (mimeType || '').toLowerCase();

  if (ext === '.mp3' || mime.includes('mpeg') || mime.includes('mp3'))
    return 'MP3';
  if (ext === '.alac' || mime.includes('alac')) return 'ALAC';
  if (ext === '.m4a' || ext === '.m4b' || mime.includes('m4a')) return 'M4A';
  if (ext === '.aac' || mime.includes('aac')) return 'AAC';
  if (ext === '.opus' || mime.includes('opus')) return 'OPUS';
  if (ext === '.oga') return 'OGA';
  if (ext === '.ogg' || mime.includes('ogg') || mime.includes('vorbis'))
    return 'OGG';
  if (ext === '.flac' || mime.includes('flac')) return 'FLAC';
  if (ext === '.wav' || ext === '.wave' || mime.includes('wav')) return 'WAV';
  if (
    ext === '.aiff' ||
    ext === '.aif' ||
    ext === '.aifc' ||
    mime.includes('aiff')
  )
    return 'AIFF';
  if (ext === '.wma' || mime.includes('wma')) return 'WMA';
  if (ext === '.weba' || mime.includes('webm')) return 'WEBA';
  if (ext === '.amr' || mime.includes('amr')) return 'AMR';
  if (ext === '.3gp' || mime.includes('3gp')) return '3GP';
  if (ext === '.mp4' || mime.includes('mp4')) return 'M4A';
  return ext ? ext.slice(1).toUpperCase() : 'AUDIO';
}

/**
 * Queries the device/browser decoder (`HTMLAudioElement.canPlayType` & MediaCapabilities)
 * to determine if an audio extension/MIME can be decoded on this device.
 * Note: Some containers (like FLAC/WAV/OPUS/AIFF) may return 'maybe' on canPlayType
 * and are verified definitively during Web Audio `decodeAudioData` or `<audio>` playback.
 */
export function canDeviceDecodeAudioFormat(
  fileName: string,
  mimeType = ''
): boolean {
  const ext = extractFileExtension(fileName);
  const cleanMime = (mimeType || '').trim().toLowerCase();

  // Reject non-audio MIME types immediately (e.g. video/*, image/*, text/*, application/pdf)
  if (
    cleanMime &&
    !cleanMime.startsWith('audio/') &&
    cleanMime !== 'application/ogg' &&
    cleanMime !== 'application/octet-stream' &&
    !(cleanMime === 'video/mp4' && (ext === '.m4a' || ext === '.mp4'))
  ) {
    return false;
  }

  const cacheKey = `${ext}|${cleanMime}`;
  const cached = codecSupportCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const prober = getAudioProber();
  if (!prober) return Boolean(ext && AUDIO_EXTENSION_MIME_MAP[ext]);

  const candidates: string[] = [];
  if (cleanMime && cleanMime.startsWith('audio/')) {
    candidates.push(cleanMime);
  }
  if (ext && AUDIO_EXTENSION_MIME_MAP[ext]) {
    candidates.push(...AUDIO_EXTENSION_MIME_MAP[ext]);
  }

  if (candidates.length === 0) {
    codecSupportCache.set(cacheKey, false);
    return false;
  }

  for (const candidate of candidates) {
    try {
      const res = prober.canPlayType(candidate);
      if (res === 'probably' || res === 'maybe') {
        codecSupportCache.set(cacheKey, true);
        return true;
      }
    } catch {
      // Ignore prober error
    }
  }

  // Standard Web Audio / Android decoders natively decode WAV, FLAC, MP3, OGG, OPUS, M4A, AAC
  // even if a specific webview reports empty string for certain container subtypes;
  // however, proprietary formats like WMA/ALAC require explicit decoder support ('probably'/'maybe').
  const universallyDecodedByWebAudio =
    ext === '.mp3' ||
    ext === '.wav' ||
    ext === '.wave' ||
    ext === '.flac' ||
    ext === '.ogg' ||
    ext === '.oga' ||
    ext === '.opus' ||
    ext === '.m4a' ||
    ext === '.aac';

  codecSupportCache.set(cacheKey, universallyDecodedByWebAudio);
  return universallyDecodedByWebAudio;
}

/**
 * Strictly validates that a File or entry is a genuine, supported audio file
 * and NOT an app/system/non-audio file.
 */
export function isSupportedAudioFile(
  fileOrName: File | { name: string; type?: string; size?: number },
  folderPath = ''
): boolean {
  const name = (fileOrName.name || '').trim();
  if (!name) return false;

  if (isExcludedSystemOrAppPath(folderPath, name)) {
    return false;
  }

  if (typeof fileOrName.size === 'number' && fileOrName.size <= 128) {
    return false;
  }

  const ext = extractFileExtension(name);
  const mime = (fileOrName.type || '').toLowerCase();

  // Must have either a recognized audio extension or an explicit audio/* MIME type
  const hasKnownAudioExt = Boolean(ext && AUDIO_EXTENSION_MIME_MAP[ext]);
  const hasAudioMime =
    mime.startsWith('audio/') || mime === 'application/ogg';

  if (!hasKnownAudioExt && !hasAudioMime) {
    return false;
  }

  return canDeviceDecodeAudioFormat(name, mime);
}

export interface StoredTrackRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  trackNumber: string;
  durationSec: number;
  bpm: number | null;
  bpmConfidence: number; // 0 - 100
  key: string;           // Camelot e.g. "8A", "11B", or "Unknown"
  keyConfidence: number; // 0 - 100
  sampleRate: number | null;
  channels: number | null;
  bitrateKbps: number | null;
  fileSizeBytes: number;
  format: string;
  mimeType?: string;
  /**
   * File name with extension (e.g., "cumbia_mix.mp3")
   */
  fileName: string;
  /**
   * Normalized relative folder path inside its source (e.g. "Música/Cumbia" or "")
   */
  folderPath: string;
  /**
   * Origin display folder name (e.g. "Cumbia" or "Mi unidad/Música")
   */
  originFolder: string;
  /**
   * Storage volume classification (INTERNAL, SD_CARD, USB_OTG, EXTERNAL_HDD, CLOUD)
   */
  storageVolume: StorageVolumeType;
  /**
   * Volume display label (e.g. "Almacenamiento Interno", "Tarjeta SD", "USB OTG", "Google Drive")
   */
  storageVolumeLabel?: string;
  /**
   * Lightweight URI / content reference (never duplicates audio bytes)
   */
  referenceUri: string;
  /**
   * Optional Google Drive file ID when `sourceType === 'GOOGLE_DRIVE'`
   */
  driveFileId?: string;
  /**
   * Legacy alias for referenceUri/fileName
   */
  location: string;
  /**
   * True when the underlying audio file is currently reachable at its original location
   */
  fileAvailable: boolean;
  sourceType: AudioSourceType;
  analysisStatus: TrackAnalysisStatus;
  analysisProgress: number; // 0 - 100
  cuePointSec: number;
  firstBeatOffsetSec?: number;
  beatGridResolution?: number; // 0.5, 1, 2
  hotCues: HotCueSlot[];
  addedAt: number;
  analyzedAt: number | null;
  /**
   * Stable persistent identifier for stem separation cache (survives restarts and reloads)
   */
  audioFileId?: string;
  /**
   * Offline stem separation status ('NONE' | 'QUEUED' | 'PREPARING' | 'PAUSED' | 'READY' | 'ERROR')
   */
  stemPreparationStatus?: TrackStemPreparationStatus;
  /**
   * Offline stem separation progress percentage (0 - 100)
   */
  stemPreparationProgress?: number;
  /**
   * Timestamp when offline stem separation completed
   */
  stemPreparedAt?: number | null;
  /**
   * Identifier of the separator engine/model used to generate the stems
   */
  stemModelId?: string;
  stemModelName?: string;
  stemPreparationError?: string;
  stemValidationSummary?: {
    lowBandBassDrumsIndependence: number;
    midBandVocalMelodyIndependence: number;
    vocalToDrumsRejectionDb: number;
  };
}

export interface PreparedTrackStemsRecord {
  id: string;
  sampleRate: number;
  totalSamples: number;
  durationSec: number;
  modelName: string;
  preparedAt: number;
  vocalL: Int16Array;
  vocalR: Int16Array;
  melodyL: Int16Array;
  melodyR: Int16Array;
  bassL: Int16Array;
  bassR: Int16Array;
  drumsL: Int16Array;
  drumsR: Int16Array;
  validationSummary?: {
    lowBandBassDrumsIndependence: number;
    midBandVocalMelodyIndependence: number;
    vocalToDrumsRejectionDb: number;
  };
}

export interface PersistentStemMetaRecord {
  audioFileId: string;
  trackId: string;
  sampleRate: number;
  totalSamples: number;
  segmentSamples: number;
  totalSegments: number;
  completedSegments: number;
  modelId: string;
  validationSummary?: {
    lowBandBassDrumsIndependence: number;
    midBandVocalMelodyIndependence: number;
    vocalToDrumsRejectionDb: number;
    stemEnergyShare: {
      vocal: number;
      melody: number;
      bass: number;
      drums: number;
    };
  } | null;
  updatedAt: number;
}

export interface PersistentStemSegmentRecord {
  id: string; // `${audioFileId}:${segmentIndex}`
  audioFileId: string;
  segmentIndex: number;
  startSample: number;
  numSamples: number;
  // Stored as 16-bit signed PCM (Int16Array, 96 dB SNR) for 50% lower RAM/disk usage and zero codec latency
  vocalL: Int16Array;
  vocalR: Int16Array;
  melodyL: Int16Array;
  melodyR: Int16Array;
  bassL: Int16Array;
  bassR: Int16Array;
  drumsL: Int16Array;
  drumsR: Int16Array;
}

export function computeStableAudioFileId(
  track: Pick<
    StoredTrackRecord,
    'id' | 'fileName' | 'fileSizeBytes' | 'driveFileId' | 'audioFileId'
  >
): string {
  if (track.audioFileId && track.audioFileId.trim().length > 0) {
    return track.audioFileId.trim();
  }
  if (track.driveFileId && track.driveFileId.trim().length > 0) {
    return `af_gdrive_${track.driveFileId.trim()}`;
  }
  const cleanName = (track.fileName || track.id || 'track')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  const size =
    typeof track.fileSizeBytes === 'number' && track.fileSizeBytes > 0
      ? track.fileSizeBytes
      : 0;
  return `af_${cleanName}_${size}`;
}

export interface RegisteredFolderRecord {
  id: string; // `${sourceType}:${folderPath}`
  sourceType: 'LOCAL' | 'IMPORTED';
  folderPath: string; // e.g. "Música" or "Música/Cumbia"
  name: string;       // e.g. "Cumbia"
  parentPath: string; // e.g. "Música" or ""
  storageVolume: StorageVolumeType;
  storageVolumeLabel?: string;
  addedAt: number;
}

export interface MountedDirectoryHandleRecord {
  id: string; // `${sourceType}:${folderPath}`
  sourceType: 'LOCAL' | 'IMPORTED';
  folderPath: string;
  storageVolume: StorageVolumeType;
  storageVolumeLabel: string;
  handle: FileSystemDirectoryHandle;
  addedAt: number;
}

export interface CachedWaveformRecord {
  trackId: string;
  overviewPeaks: number[]; // 600 buckets (0..1)
  detailLow: number[];     // 4800 buckets (0..1) for bass coloring
  detailMid: number[];     // 4800 buckets (0..1) for mid coloring
  detailHigh: number[];    // 4800 buckets (0..1) for high coloring
  detailPeaks?: number[];
  lowPeaks?: number[];
  midPeaks?: number[];
  highPeaks?: number[];
  updatedAt: number;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export function normalizeFolderPath(rawPath: string): string {
  if (!rawPath) return '';
  return rawPath
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0 && seg !== '.')
    .join('/');
}

const DB_NAME = 'djb_core_persistence_v2';
const DB_VERSION = 5;
const STORE_TRACKS = 'tracks';
const STORE_FILE_HANDLES = 'file_handles';
const STORE_DIRECTORY_HANDLES = 'directory_handles';
const STORE_REGISTERED_FOLDERS = 'registered_folders';
const STORE_WAVEFORMS = 'waveforms';
const STORE_PLAYLISTS = 'playlists';
const STORE_PREPARED_STEM_META = 'prepared_stem_meta';
const STORE_PREPARED_STEM_SEGMENTS = 'prepared_stem_segments';

class TrackDatabaseService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  /**
   * Ephemeral in-memory map of File/Blob objects selected during the active session
   * or streamed temporarily from Google Drive.
   * Zero bytes are copied into IndexedDB storage.
   */
  private inMemoryFiles = new Map<string, Blob>();

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (db.objectStoreNames.contains('audio_blobs')) {
          db.deleteObjectStore('audio_blobs');
        }
        if (!db.objectStoreNames.contains(STORE_TRACKS)) {
          db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_FILE_HANDLES)) {
          db.createObjectStore(STORE_FILE_HANDLES);
        }
        if (!db.objectStoreNames.contains(STORE_DIRECTORY_HANDLES)) {
          db.createObjectStore(STORE_DIRECTORY_HANDLES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_REGISTERED_FOLDERS)) {
          db.createObjectStore(STORE_REGISTERED_FOLDERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_WAVEFORMS)) {
          db.createObjectStore(STORE_WAVEFORMS, { keyPath: 'trackId' });
        }
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PREPARED_STEM_META)) {
          db.createObjectStore(STORE_PREPARED_STEM_META, {
            keyPath: 'audioFileId',
          });
        }
        if (!db.objectStoreNames.contains(STORE_PREPARED_STEM_SEGMENTS)) {
          const segStore = db.createObjectStore(STORE_PREPARED_STEM_SEGMENTS, {
            keyPath: 'id',
          });
          segStore.createIndex('by_audioFileId', 'audioFileId', {
            unique: false,
          });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  /**
   * Purges any legacy synthetic demo tracks or fictional seed folders from earlier versions
   * so LOCAL and TODA LA MÚSICA contain strictly 100% real device audio files.
   */
  async purgeLegacySyntheticRecords(): Promise<void> {
    const allTracks = await this.getAllTracks();
    const legacySyntheticIds = new Set(['trk-01', 'trk-02', 'trk-03', 'trk-04']);

    for (const trk of allTracks) {
      const isSynthetic =
        legacySyntheticIds.has(trk.id) ||
        (trk.referenceUri || '').startsWith('app://synthetic/') ||
        (trk.location || '').startsWith('app://synthetic/');
      if (isSynthetic) {
        await this.deleteTrack(trk.id);
      }
    }

    // Remove legacy seed folders if no real tracks or mounted directory handles exist
    const remainingTracks = await this.getAllTracks();
    const mountedDirs = await this.getAllMountedDirectoryHandles();
    if (remainingTracks.length === 0 && mountedDirs.length === 0) {
      await this.clearAllRegisteredFolders();
    }
  }

  async getAllTracks(): Promise<StoredTrackRecord[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const req = tx.objectStore(STORE_TRACKS).getAll();
      req.onsuccess = () => {
        const list = (req.result as StoredTrackRecord[]) || [];
        const normalized = list
          .filter(
            (t) =>
              !(t.referenceUri || '').startsWith('app://synthetic/') &&
              !isExcludedSystemOrAppPath(t.folderPath || '', t.fileName || '')
          )
          .map((t) => ({
            ...t,
            fileName: t.fileName || t.location || `${t.title}.mp3`,
            folderPath: normalizeFolderPath(t.folderPath ?? ''),
            originFolder:
              t.originFolder ||
              normalizeFolderPath(t.folderPath ?? '').split('/').pop() ||
              'Raíz',
            storageVolume: t.storageVolume || 'INTERNAL',
            referenceUri: t.referenceUri || t.location || '',
            fileAvailable: t.fileAvailable ?? true,
            audioFileId: computeStableAudioFileId(t),
            stemPreparationStatus: t.stemPreparationStatus || 'NONE',
            stemPreparationProgress: t.stemPreparationProgress ?? 0,
            stemPreparedAt: t.stemPreparedAt ?? null,
          }));
        normalized.sort((a, b) => b.addedAt - a.addedAt);
        resolve(normalized);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getTrack(id: string): Promise<StoredTrackRecord | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const req = tx.objectStore(STORE_TRACKS).get(id);
      req.onsuccess = () => resolve((req.result as StoredTrackRecord) || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Finds an existing analyzed record matching the same file name + byte size or Google Drive ID
   * so we can reuse cached BPM, Key, Beat Grid, and HD Waveform without re-analyzing.
   */
  async findAnalyzedTrackByIdentity(
    fileName: string,
    fileSizeBytes: number,
    driveFileId?: string
  ): Promise<StoredTrackRecord | null> {
    const all = await this.getAllTracks();
    if (driveFileId) {
      const byDrive = all.find(
        (t) => t.driveFileId === driveFileId && t.analysisStatus === 'READY'
      );
      if (byDrive) return byDrive;
    }
    const cleanName = fileName.trim().toLowerCase();
    return (
      all.find(
        (t) =>
          (t.fileName || '').trim().toLowerCase() === cleanName &&
          t.fileSizeBytes === fileSizeBytes &&
          t.analysisStatus === 'READY' &&
          t.bpm !== null
      ) || null
    );
  }

  async saveTrack(record: StoredTrackRecord): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      tx.objectStore(STORE_TRACKS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteTrack(id: string): Promise<void> {
    this.inMemoryFiles.delete(id);
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_TRACKS, STORE_FILE_HANDLES, STORE_WAVEFORMS],
        'readwrite'
      );
      tx.objectStore(STORE_TRACKS).delete(id);
      tx.objectStore(STORE_FILE_HANDLES).delete(id);
      tx.objectStore(STORE_WAVEFORMS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Registers an OS File/Blob reference in memory (and optionally a FileSystemFileHandle in IDB)
   * WITHOUT copying or storing the audio file's bytes in IndexedDB.
   */
  async saveTrackFileReference(
    trackId: string,
    fileOrBlob: Blob,
    fileHandle?: FileSystemFileHandle
  ): Promise<void> {
    this.inMemoryFiles.set(trackId, fileOrBlob);
    if (!fileHandle) return;

    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_FILE_HANDLES, 'readwrite');
        tx.objectStore(STORE_FILE_HANDLES).put(fileHandle, trackId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore if environment does not support structured cloning of FileSystemFileHandle
    }
  }

  /**
   * Resolves the audio Blob/File directly from its original reference without duplicating storage.
   */
  async getAudioBlob(trackId: string): Promise<Blob | null> {
    const memFile = this.inMemoryFiles.get(trackId);
    if (memFile && memFile.size > 0) {
      return memFile;
    }

    try {
      const db = await this.openDb();
      const handle = await new Promise<FileSystemFileHandle | null>(
        (resolve) => {
          const tx = db.transaction(STORE_FILE_HANDLES, 'readonly');
          const req = tx.objectStore(STORE_FILE_HANDLES).get(trackId);
          req.onsuccess = () =>
            resolve((req.result as FileSystemFileHandle) || null);
          req.onerror = () => resolve(null);
        }
      );

      if (handle && typeof handle.getFile === 'function') {
        const file = await handle.getFile();
        if (file && file.size > 0) {
          this.inMemoryFiles.set(trackId, file);
          return file;
        }
      }
    } catch {
      // File was moved, deleted, or external USB/SD storage is disconnected
    }

    return null;
  }

  /**
   * Resolves the audio Blob for a StoredTrackRecord directly from its original reference
   * without duplicating audio files.
   */
  async resolveTrackAudioFile(
    track: StoredTrackRecord
  ): Promise<{ blob: Blob | null; isMissing: boolean }> {
    const blob = await this.getAudioBlob(track.id);
    if (blob && blob.size > 0) {
      return { blob, isMissing: false };
    }
    return { blob: null, isMissing: true };
  }

  /**
   * Saves a granted FileSystemDirectoryHandle so the app can automatically re-verify and
   * relink moved/reconnected files inside IMPORTADAS and LOCAL.
   */
  async saveMountedDirectoryHandle(
    record: MountedDirectoryHandleRecord
  ): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_DIRECTORY_HANDLES, 'readwrite');
        tx.objectStore(STORE_DIRECTORY_HANDLES).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore if browser does not allow cloning directory handles
    }
  }

  async getAllMountedDirectoryHandles(): Promise<
    MountedDirectoryHandleRecord[]
  > {
    try {
      const db = await this.openDb();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE_DIRECTORY_HANDLES, 'readonly');
        const req = tx.objectStore(STORE_DIRECTORY_HANDLES).getAll();
        req.onsuccess = () =>
          resolve((req.result as MountedDirectoryHandleRecord[]) || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async registerFolderHierarchy(
    sourceType: 'LOCAL' | 'IMPORTED',
    rawFolderPath: string,
    storageVolume: StorageVolumeType = 'INTERNAL',
    storageVolumeLabel?: string
  ): Promise<void> {
    const cleanPath = normalizeFolderPath(rawFolderPath);
    if (!cleanPath || isExcludedSystemOrAppPath(cleanPath)) return;

    const segments = cleanPath.split('/');
    const db = await this.openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_REGISTERED_FOLDERS, 'readwrite');
      const store = tx.objectStore(STORE_REGISTERED_FOLDERS);

      let accumulated = '';
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const parentPath = accumulated;
        accumulated = accumulated ? `${accumulated}/${seg}` : seg;
        const id = `${sourceType}:${accumulated}`;

        const record: RegisteredFolderRecord = {
          id,
          sourceType,
          folderPath: accumulated,
          name: seg,
          parentPath,
          storageVolume,
          storageVolumeLabel,
          addedAt: Date.now(),
        };
        store.put(record);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllRegisteredFolders(): Promise<RegisteredFolderRecord[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REGISTERED_FOLDERS, 'readonly');
      const req = tx.objectStore(STORE_REGISTERED_FOLDERS).getAll();
      req.onsuccess = () => {
        const list = ((req.result as RegisteredFolderRecord[]) || []).filter(
          (f) => !isExcludedSystemOrAppPath(f.folderPath)
        );
        list.sort((a, b) => a.folderPath.localeCompare(b.folderPath));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearAllRegisteredFolders(): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REGISTERED_FOLDERS, 'readwrite');
      tx.objectStore(STORE_REGISTERED_FOLDERS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveWaveform(record: CachedWaveformRecord): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WAVEFORMS, 'readwrite');
      tx.objectStore(STORE_WAVEFORMS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getWaveform(trackId: string): Promise<CachedWaveformRecord | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WAVEFORMS, 'readonly');
      const req = tx.objectStore(STORE_WAVEFORMS).get(trackId);
      req.onsuccess = () =>
        resolve((req.result as CachedWaveformRecord) || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllPlaylists(): Promise<PlaylistRecord[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readonly');
      const req = tx.objectStore(STORE_PLAYLISTS).getAll();
      req.onsuccess = () => resolve((req.result as PlaylistRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  async savePlaylist(playlist: PlaylistRecord): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
      tx.objectStore(STORE_PLAYLISTS).put(playlist);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
      tx.objectStore(STORE_PLAYLISTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async savePreparedStemMetadata(
    meta: PersistentStemMetaRecord
  ): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PREPARED_STEM_META, 'readwrite');
      tx.objectStore(STORE_PREPARED_STEM_META).put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPreparedStemMetadata(
    audioFileId: string
  ): Promise<PersistentStemMetaRecord | null> {
    if (!audioFileId) return null;
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PREPARED_STEM_META, 'readonly');
      const req = tx.objectStore(STORE_PREPARED_STEM_META).get(audioFileId);
      req.onsuccess = () =>
        resolve((req.result as PersistentStemMetaRecord) || null);
      req.onerror = () => reject(req.error);
    });
  }

  async savePreparedStemSegment(
    segment: PersistentStemSegmentRecord
  ): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PREPARED_STEM_SEGMENTS, 'readwrite');
      tx.objectStore(STORE_PREPARED_STEM_SEGMENTS).put(segment);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPreparedStemSegments(
    audioFileId: string
  ): Promise<PersistentStemSegmentRecord[]> {
    if (!audioFileId) return [];
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PREPARED_STEM_SEGMENTS, 'readonly');
      const store = tx.objectStore(STORE_PREPARED_STEM_SEGMENTS);
      const idx = store.index('by_audioFileId');
      const req = idx.getAll(IDBKeyRange.only(audioFileId));
      req.onsuccess = () => {
        const list = (req.result as PersistentStemSegmentRecord[]) || [];
        list.sort((a, b) => a.segmentIndex - b.segmentIndex);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deletePreparedStems(audioFileId: string): Promise<void> {
    if (!audioFileId) return;
    const db = await this.openDb();
    const existingSegments = await this.getPreparedStemSegments(audioFileId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_PREPARED_STEM_META, STORE_PREPARED_STEM_SEGMENTS],
        'readwrite'
      );
      tx.objectStore(STORE_PREPARED_STEM_META).delete(audioFileId);
      const segStore = tx.objectStore(STORE_PREPARED_STEM_SEGMENTS);
      for (const seg of existingSegments) {
        segStore.delete(seg.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async savePreparedStems(record: PreparedTrackStemsRecord): Promise<void> {
    const track = await this.getTrack(record.id);
    const audioFileId = track ? computeStableAudioFileId(track) : record.id;
    const sr = record.sampleRate || 44100;
    const totalSamples = record.totalSamples;
    const segmentSamples = sr * 10;
    const totalSegments = Math.max(1, Math.ceil(totalSamples / segmentSamples));

    const meta: PersistentStemMetaRecord = {
      audioFileId,
      trackId: record.id,
      sampleRate: sr,
      totalSamples,
      segmentSamples,
      totalSegments,
      completedSegments: totalSegments,
      modelId: record.modelName,
      validationSummary: record.validationSummary
        ? {
            ...record.validationSummary,
            stemEnergyShare: {
              vocal: 0.25,
              melody: 0.25,
              bass: 0.25,
              drums: 0.25,
            },
          }
        : null,
      updatedAt: record.preparedAt || Date.now(),
    };

    await this.savePreparedStemMetadata(meta);
    if (audioFileId !== record.id) {
      await this.savePreparedStemMetadata({
        ...meta,
        audioFileId: record.id,
      });
    }

    for (let segIdx = 0; segIdx < totalSegments; segIdx++) {
      const startSample = segIdx * segmentSamples;
      const numSamples = Math.min(segmentSamples, totalSamples - startSample);
      if (numSamples <= 0) break;

      const segRecord: PersistentStemSegmentRecord = {
        id: `${audioFileId}:${segIdx}`,
        audioFileId,
        segmentIndex: segIdx,
        startSample,
        numSamples,
        vocalL: record.vocalL.slice(startSample, startSample + numSamples),
        vocalR: record.vocalR.slice(startSample, startSample + numSamples),
        melodyL: record.melodyL.slice(startSample, startSample + numSamples),
        melodyR: record.melodyR.slice(startSample, startSample + numSamples),
        bassL: record.bassL.slice(startSample, startSample + numSamples),
        bassR: record.bassR.slice(startSample, startSample + numSamples),
        drumsL: record.drumsL.slice(startSample, startSample + numSamples),
        drumsR: record.drumsR.slice(startSample, startSample + numSamples),
      };
      await this.savePreparedStemSegment(segRecord);
    }
  }

  async getPreparedStems(
    trackId: string
  ): Promise<PreparedTrackStemsRecord | null> {
    if (!trackId) return null;
    const track = await this.getTrack(trackId);
    const candidateKeys = Array.from(
      new Set(
        [
          track ? computeStableAudioFileId(track) : '',
          track?.audioFileId || '',
          trackId,
        ].filter(Boolean)
      )
    );

    for (const key of candidateKeys) {
      const meta = await this.getPreparedStemMetadata(key);
      const segments = await this.getPreparedStemSegments(key);
      if (
        meta &&
        meta.totalSamples > 0 &&
        segments.length >= meta.totalSegments
      ) {
        const total = meta.totalSamples;
        const vocalL = new Int16Array(total);
        const vocalR = new Int16Array(total);
        const melodyL = new Int16Array(total);
        const melodyR = new Int16Array(total);
        const bassL = new Int16Array(total);
        const bassR = new Int16Array(total);
        const drumsL = new Int16Array(total);
        const drumsR = new Int16Array(total);

        for (const seg of segments) {
          if (seg.vocalL && seg.startSample + seg.vocalL.length <= total) {
            vocalL.set(seg.vocalL, seg.startSample);
            vocalR.set(seg.vocalR, seg.startSample);
            melodyL.set(seg.melodyL, seg.startSample);
            melodyR.set(seg.melodyR, seg.startSample);
            bassL.set(seg.bassL, seg.startSample);
            bassR.set(seg.bassR, seg.startSample);
            drumsL.set(seg.drumsL, seg.startSample);
            drumsR.set(seg.drumsR, seg.startSample);
          }
        }

        return {
          id: trackId,
          sampleRate: meta.sampleRate,
          totalSamples: meta.totalSamples,
          durationSec: meta.totalSamples / (meta.sampleRate || 44100),
          modelName: meta.modelId || '2D-HPSS + REPET-SIM + SHS-F0 2048-STFT',
          preparedAt: meta.updatedAt || Date.now(),
          vocalL,
          vocalR,
          melodyL,
          melodyR,
          bassL,
          bassR,
          drumsL,
          drumsR,
          validationSummary: meta.validationSummary
            ? {
                lowBandBassDrumsIndependence:
                  meta.validationSummary.lowBandBassDrumsIndependence,
                midBandVocalMelodyIndependence:
                  meta.validationSummary.midBandVocalMelodyIndependence,
                vocalToDrumsRejectionDb:
                  meta.validationSummary.vocalToDrumsRejectionDb,
              }
            : undefined,
        };
      }
    }

    // Fallback: check if a direct record was stored by key trackId
    const db = await this.openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PREPARED_STEM_SEGMENTS, 'readonly');
      const req = tx.objectStore(STORE_PREPARED_STEM_SEGMENTS).get(trackId);
      req.onsuccess = () => {
        const res = req.result as PreparedTrackStemsRecord | undefined;
        if (res && res.totalSamples > 0 && res.vocalL) {
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  async hasPreparedStems(trackId: string): Promise<boolean> {
    if (!trackId) return false;
    const track = await this.getTrack(trackId);
    const candidateKeys = Array.from(
      new Set(
        [
          track ? computeStableAudioFileId(track) : '',
          track?.audioFileId || '',
          trackId,
        ].filter(Boolean)
      )
    );

    for (const key of candidateKeys) {
      const meta = await this.getPreparedStemMetadata(key);
      if (
        meta &&
        meta.totalSamples > 0 &&
        meta.completedSegments >= meta.totalSegments
      ) {
        const segs = await this.getPreparedStemSegments(key);
        if (segs.length >= meta.totalSegments) {
          return true;
        }
      }
    }

    const rec = await this.getPreparedStems(trackId);
    return Boolean(rec && rec.totalSamples > 0);
  }
}

export const trackDatabase = new TrackDatabaseService();
