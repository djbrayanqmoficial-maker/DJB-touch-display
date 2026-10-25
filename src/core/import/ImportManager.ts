/**
 * DJ Core — Import Manager, Real Device Storage Scanner, Auto-Recovery & Non-Blocking Analysis Queue
 *
 * Key Guarantees:
 * 1. REAL STORAGE ONLY: Never creates synthetic demo songs or fictional folders.
 * 2. ZERO AUDIO DUPLICATION: Never copies audio bytes into IndexedDB or app folders.
 *    Stores only lightweight reference records + OS FileSystemFileHandle / DirectoryHandle references.
 * 3. AUTOMATIC MISSING FILE RECOVERY: When opening IMPORTADAS or LOCAL, automatically checks
 *    mounted DirectoryHandles and Android storage to re-link files that became available again.
 * 4. GOOGLE DRIVE STREAMING & ANALYSIS CACHE: Streams Google Drive audio into an ephemeral
 *    in-memory cache, extracts metadata/BPM/Key/Waveform/BeatGrid once, and saves lightweight
 *    analysis records in TrackDatabase so subsequent loads are instantaneous.
 */

import {
  analyzeAudioBlobPcm,
  extractRealMetadataFromFile,
} from '../analyzer/RealAudioAnalyzer';
import { realAudioEngine } from '../audio/RealAudioEngine';
import {
  AudioSourceType,
  CachedWaveformRecord,
  detectAudioFormatBadge,
  isSupportedAudioFile,
  normalizeFolderPath,
  RegisteredFolderRecord,
  StorageVolumeType,
  StoredTrackRecord,
  trackDatabase,
} from '../database/TrackDatabase';
import {
  fetchGoogleDriveAudioBlob,
  GoogleDriveAudioFileItem,
} from '../drive/GoogleDriveService';
import {
  androidStorageBridge,
  inferVolumeKindFromName,
  isExcludedSystemOrAppPath,
} from '../storage/AndroidStorageBridge';

export interface ImportQueueStatus {
  isProcessing: boolean;
  currentTrackId: string | null;
  currentTrackTitle: string | null;
  currentStage: string;
  pendingCount: number;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

export interface ImportFilesOptions {
  sourceType: AudioSourceType;
  baseFolderPath?: string;
  storageVolume?: StorageVolumeType;
  storageVolumeLabel?: string;
  preserveRelativePaths?: boolean;
}

type QueueListener = (
  tracks: StoredTrackRecord[],
  status: ImportQueueStatus,
  folders: RegisteredFolderRecord[]
) => void;

class ImportManagerService {
  private queue: Array<{ trackId: string }> = [];
  private isProcessing = false;
  private currentTrackId: string | null = null;
  private currentTrackTitle: string | null = null;
  private currentStage = 'IDLE';
  private completedCount = 0;
  private totalCount = 0;
  private currentProgress = 0;
  private listeners = new Set<QueueListener>();

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): ImportQueueStatus {
    return {
      isProcessing: this.isProcessing,
      currentTrackId: this.currentTrackId,
      currentTrackTitle: this.currentTrackTitle,
      currentStage: this.currentStage,
      pendingCount: this.queue.length,
      completedCount: this.completedCount,
      totalCount: this.totalCount,
      progressPercent: this.currentProgress,
    };
  }

  private async notifyListeners(): Promise<void> {
    const [tracks, folders] = await Promise.all([
      trackDatabase.getAllTracks(),
      trackDatabase.getAllRegisteredFolders(),
    ]);
    const status = this.getStatus();
    this.listeners.forEach((cb) => cb(tracks, status, folders));
  }

  /**
   * Initializes the library strictly from real device storage and existing user records.
   * Purges any legacy synthetic tracks or fake folders from earlier versions.
   */
  async initializeLocalLibrary(): Promise<StoredTrackRecord[]> {
    await this.bootstrapDefaultLibrary();
    return await trackDatabase.getAllTracks();
  }

  async bootstrapDefaultLibrary(): Promise<void> {
    await trackDatabase.purgeLegacySyntheticRecords();

    // If running inside an installed Android APK with storage permission, sync real MediaStore audio
    if (androidStorageBridge.isAndroidApk()) {
      await this.syncNativeAndroidApkStorage();
    }

    await this.verifyAllTracksAvailability();
    await this.notifyListeners();
  }

  /**
   * Synchronizes real device audio files reported by the native Android APK MediaStore / StorageManager.
   */
  async syncNativeAndroidApkStorage(): Promise<void> {
    const entries = androidStorageBridge.scanNativeApkAudioFiles();
    if (entries.length === 0) return;

    const existingTracks = await trackDatabase.getAllTracks();
    for (const entry of entries) {
      if (
        !isSupportedAudioFile(
          {
            name: entry.fileName,
            type: entry.mimeType,
            size: entry.sizeBytes,
          },
          entry.relativePath
        )
      ) {
        continue;
      }

      const normFolder = normalizeFolderPath(entry.relativePath);
      if (normFolder) {
        await trackDatabase.registerFolderHierarchy(
          'LOCAL',
          normFolder,
          entry.volumeKind,
          entry.volumeLabel
        );
      }

      const alreadyExists = existingTracks.some(
        (t) =>
          t.referenceUri === entry.uri ||
          (t.sourceType === 'LOCAL' &&
            t.folderPath === normFolder &&
            t.fileName.toLowerCase() === entry.fileName.toLowerCase() &&
            t.fileSizeBytes === entry.sizeBytes)
      );
      if (alreadyExists) continue;

      const trackId = `apk-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const record: StoredTrackRecord = {
        id: trackId,
        title: entry.title || entry.fileName.replace(/\.[^/.]+$/, ''),
        artist: entry.artist || 'Unknown',
        album: entry.album || 'Unknown',
        genre: entry.genre || 'Unknown',
        year: '',
        trackNumber: '',
        durationSec: entry.durationSec,
        bpm: null,
        bpmConfidence: 0,
        key: 'Unknown',
        keyConfidence: 0,
        sampleRate: null,
        channels: null,
        bitrateKbps: null,
        fileSizeBytes: entry.sizeBytes,
        format: detectAudioFormatBadge(entry.fileName, entry.mimeType),
        fileName: entry.fileName,
        folderPath: normFolder,
        originFolder: normFolder.split('/').pop() || entry.volumeLabel,
        storageVolume: entry.volumeKind,
        storageVolumeLabel: entry.volumeLabel,
        referenceUri: entry.uri,
        location: entry.fileName,
        fileAvailable: true,
        sourceType: 'LOCAL',
        analysisStatus: 'READY',
        analysisProgress: 100,
        cuePointSec: 0,
        firstBeatOffsetSec: 0,
        beatGridResolution: 1,
        hotCues: Array.from({ length: 8 }, (_, idx) => ({
          index: idx + 1,
          label: 'EMPTY',
          positionSec: null,
          active: false,
        })),
        addedAt: Date.now(),
        analyzedAt: null,
      };
      await trackDatabase.saveTrack(record);
    }
  }

  /**
   * Recursively searches a granted FileSystemDirectoryHandle for missing tracks
   * matching `(fileName, fileSizeBytes)` so IMPORTADAS and LOCAL can automatically
   * recover references when storage becomes accessible again.
   */
  private async scanDirectoryHandleForRecovery(
    dirHandle: FileSystemDirectoryHandle,
    missingByFilename: Map<string, StoredTrackRecord[]>,
    recoveredCountRef: { count: number },
    depth = 0
  ): Promise<void> {
    if (depth > 8 || missingByFilename.size === 0) return;

    try {
      const iterable = dirHandle as unknown as {
        values?: () => AsyncIterable<
          FileSystemFileHandle | FileSystemDirectoryHandle
        >;
      };
      if (typeof iterable.values !== 'function') return;

      for await (const entry of iterable.values()) {
        if (missingByFilename.size === 0) break;
        if (entry.kind === 'file') {
          const lowerName = entry.name.trim().toLowerCase();
          const candidates = missingByFilename.get(lowerName);
          if (candidates && candidates.length > 0) {
            try {
              const file = await (entry as FileSystemFileHandle).getFile();
              for (const trk of [...candidates]) {
                if (
                  trk.fileSizeBytes === 0 ||
                  trk.fileSizeBytes === file.size
                ) {
                  await trackDatabase.saveTrackFileReference(
                    trk.id,
                    file,
                    entry as FileSystemFileHandle
                  );
                  await trackDatabase.saveTrack({
                    ...trk,
                    fileSizeBytes: file.size,
                    fileAvailable: true,
                    analysisStatus:
                      trk.bpm !== null ? 'READY' : trk.analysisStatus,
                  });
                  recoveredCountRef.count += 1;
                  const idx = candidates.indexOf(trk);
                  if (idx !== -1) candidates.splice(idx, 1);
                  if (candidates.length === 0) {
                    missingByFilename.delete(lowerName);
                  }
                  if (trk.bpm === null) {
                    this.enqueueTrackForAnalysis(trk.id);
                  }
                }
              }
            } catch {
              // Ignore inaccessible file
            }
          }
        } else if (
          entry.kind === 'directory' &&
          !isExcludedSystemOrAppPath(entry.name)
        ) {
          await this.scanDirectoryHandleForRecovery(
            entry as FileSystemDirectoryHandle,
            missingByFilename,
            recoveredCountRef,
            depth + 1
          );
        }
      }
    } catch {
      // Directory handle permission not currently granted
    }
  }

  /**
   * Verifies every registered track's availability at its original location,
   * and automatically attempts to re-locate any missing files across all accessible
   * mounted storage directories without duplicating audio bytes.
   */
  async verifyAllTracksAvailability(): Promise<void> {
    const allTracks = await trackDatabase.getAllTracks();
    const missingTracks: StoredTrackRecord[] = [];

    for (const trk of allTracks) {
      if (trk.sourceType === 'GOOGLE_DRIVE') {
        // Google Drive tracks are streamed on demand when authenticated
        continue;
      }

      const blob = await trackDatabase.getAudioBlob(trk.id);
      const isAvailable = Boolean(blob && blob.size > 0);
      if (!isAvailable) {
        missingTracks.push(trk);
      } else if (!trk.fileAvailable || trk.analysisStatus === 'MISSING_FILE') {
        await trackDatabase.saveTrack({
          ...trk,
          fileAvailable: true,
          analysisStatus: trk.bpm !== null ? 'READY' : 'PENDING',
        });
      }
    }

    // Attempt automatic recovery across all mounted DirectoryHandles
    if (missingTracks.length > 0) {
      const mountedDirs = await trackDatabase.getAllMountedDirectoryHandles();
      if (mountedDirs.length > 0) {
        const missingByFilename = new Map<string, StoredTrackRecord[]>();
        for (const trk of missingTracks) {
          const key = (trk.fileName || '').trim().toLowerCase();
          if (!key) continue;
          const list = missingByFilename.get(key) || [];
          list.push(trk);
          missingByFilename.set(key, list);
        }

        const recoveredCountRef = { count: 0 };
        for (const mounted of mountedDirs) {
          if (missingByFilename.size === 0) break;
          await this.scanDirectoryHandleForRecovery(
            mounted.handle,
            missingByFilename,
            recoveredCountRef
          );
        }
      }

      // Mark any remaining unrecovered tracks as MISSING_FILE ("NO ENCONTRADO")
      for (const trk of missingTracks) {
        const blobAfterRecovery = await trackDatabase.getAudioBlob(trk.id);
        const nowAvailable = Boolean(
          blobAfterRecovery && blobAfterRecovery.size > 0
        );
        if (!nowAvailable && trk.fileAvailable !== false) {
          await trackDatabase.saveTrack({
            ...trk,
            fileAvailable: false,
            analysisStatus: 'MISSING_FILE',
          });
        }
      }
    }

    await this.notifyListeners();
  }

  /**
   * Relinks a missing track ("NO ENCONTRADO") when the user selects its new file location,
   * or automatically relinks all other missing tracks if a folder is provided.
   */
  async relinkTrackFile(trackId: string, file: File): Promise<void> {
    if (!isSupportedAudioFile(file)) return;
    const trk = await trackDatabase.getTrack(trackId);
    if (!trk) return;

    await trackDatabase.saveTrackFileReference(trackId, file);
    const updated: StoredTrackRecord = {
      ...trk,
      fileName: file.name,
      fileSizeBytes: file.size,
      referenceUri: `file://${trk.folderPath ? trk.folderPath + '/' : ''}${
        file.name
      }`,
      location: file.name,
      fileAvailable: true,
      analysisStatus: trk.bpm !== null ? 'READY' : 'PENDING',
      analysisProgress: trk.bpm !== null ? 100 : 0,
    };
    await trackDatabase.saveTrack(updated);

    if (trk.bpm === null) {
      this.enqueueTrackForAnalysis(trackId);
    } else {
      await this.notifyListeners();
    }
  }

  /**
   * Uses the modern File System Access API (`window.showDirectoryPicker`) when available
   * to scan a complete folder and all its subfolders in-place without copying audio files.
   */
  async pickAndScanNativeDirectory(
    sourceType: 'LOCAL' | 'IMPORTED',
    parentFolderPath = '',
    preferredVolumeKind?: StorageVolumeType
  ): Promise<boolean> {
    const win = window as unknown as {
      showDirectoryPicker?: (options?: {
        mode?: 'read' | 'readwrite';
      }) => Promise<FileSystemDirectoryHandle>;
    };

    if (typeof win.showDirectoryPicker !== 'function') {
      return false;
    }

    try {
      const dirHandle = await win.showDirectoryPicker({ mode: 'read' });
      if (isExcludedSystemOrAppPath(dirHandle.name)) {
        return true;
      }

      const detectedVolume: StorageVolumeType =
        preferredVolumeKind || inferVolumeKindFromName(dirHandle.name);
      const volumeLabel =
        detectedVolume === 'SD_CARD'
          ? `Tarjeta SD (${dirHandle.name})`
          : detectedVolume === 'USB_OTG'
          ? `USB OTG (${dirHandle.name})`
          : detectedVolume === 'EXTERNAL_HDD'
          ? `Disco Externo (${dirHandle.name})`
          : `Almacenamiento (${dirHandle.name})`;

      const rootFolderPath = normalizeFolderPath(
        parentFolderPath
          ? `${parentFolderPath}/${dirHandle.name}`
          : dirHandle.name
      );

      await trackDatabase.saveMountedDirectoryHandle({
        id: `${sourceType}:${rootFolderPath}`,
        sourceType,
        folderPath: rootFolderPath,
        storageVolume: detectedVolume,
        storageVolumeLabel: volumeLabel,
        handle: dirHandle,
        addedAt: Date.now(),
      });

      await trackDatabase.registerFolderHierarchy(
        sourceType,
        rootFolderPath,
        detectedVolume,
        volumeLabel
      );

      const collected: Array<{
        file: File;
        handle: FileSystemFileHandle;
        folderPath: string;
      }> = [];

      const walkDirectory = async (
        handle: FileSystemDirectoryHandle,
        currentPath: string
      ) => {
        if (isExcludedSystemOrAppPath(currentPath)) return;
        await trackDatabase.registerFolderHierarchy(
          sourceType,
          currentPath,
          detectedVolume,
          volumeLabel
        );

        const iterable = handle as unknown as {
          values: () => AsyncIterable<
            FileSystemFileHandle | FileSystemDirectoryHandle
          >;
        };

        for await (const entry of iterable.values()) {
          if (entry.kind === 'file') {
            if (isExcludedSystemOrAppPath(currentPath, entry.name)) continue;
            const file = await (entry as FileSystemFileHandle).getFile();
            if (isSupportedAudioFile(file, currentPath)) {
              collected.push({
                file,
                handle: entry as FileSystemFileHandle,
                folderPath: currentPath,
              });
            }
          } else if (entry.kind === 'directory') {
            if (isExcludedSystemOrAppPath(entry.name)) continue;
            const subPath = normalizeFolderPath(`${currentPath}/${entry.name}`);
            await walkDirectory(entry as FileSystemDirectoryHandle, subPath);
          }
        }
      };

      await walkDirectory(dirHandle, rootFolderPath);

      await this.registerCollectedAudioEntries(collected, {
        sourceType,
        storageVolume: detectedVolume,
        storageVolumeLabel: volumeLabel,
      });

      // Also check if any previously missing tracks in IMPORTADAS were inside this newly connected folder
      await this.verifyAllTracksAvailability();
      return true;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return true;
      }
      return false;
    }
  }

  /**
   * Imports individual audio files or complete folders (from `<input type="file">`)
   * without duplicating audio bytes into IndexedDB.
   */
  async importFiles(
    fileList: FileList | File[],
    options: ImportFilesOptions = { sourceType: 'IMPORTED' }
  ): Promise<void> {
    const rawFiles = Array.from(fileList);
    const baseFolder = normalizeFolderPath(options.baseFolderPath || '');
    const storageVolume: StorageVolumeType =
      options.storageVolume || 'INTERNAL';
    const storageVolumeLabel =
      options.storageVolumeLabel ||
      (storageVolume === 'SD_CARD'
        ? 'Tarjeta SD'
        : storageVolume === 'USB_OTG'
        ? 'USB OTG'
        : 'Almacenamiento Interno');
    const sourceType: AudioSourceType = options.sourceType || 'IMPORTED';
    const preserveRelative = options.preserveRelativePaths ?? true;

    const validEntries: Array<{
      file: File;
      handle?: FileSystemFileHandle;
      folderPath: string;
    }> = [];

    for (const file of rawFiles) {
      const relPathRaw =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        '';
      let folderPath = baseFolder;

      if (preserveRelative && relPathRaw && relPathRaw.includes('/')) {
        const segments = relPathRaw.replace(/\\/g, '/').split('/');
        segments.pop(); // remove filename
        const relDir = normalizeFolderPath(segments.join('/'));
        folderPath = normalizeFolderPath(
          baseFolder ? `${baseFolder}/${relDir}` : relDir
        );
      }

      if (
        isExcludedSystemOrAppPath(folderPath, file.name) ||
        !isSupportedAudioFile(file, folderPath)
      ) {
        continue;
      }

      if (folderPath && sourceType !== 'GOOGLE_DRIVE') {
        await trackDatabase.registerFolderHierarchy(
          sourceType,
          folderPath,
          storageVolume,
          storageVolumeLabel
        );
      }

      validEntries.push({
        file,
        folderPath,
      });
    }

    if (validEntries.length === 0) {
      await this.notifyListeners();
      return;
    }

    await this.registerCollectedAudioEntries(validEntries, {
      sourceType,
      storageVolume,
      storageVolumeLabel,
    });
  }

  /**
   * Streams a Google Drive audio file into the ephemeral in-memory cache,
   * reuses cached analysis from TrackDatabase if already analyzed, or analyzes
   * its metadata, BPM, Camelot key, Beat Grid, and HD Waveform on first load.
   */
  async loadAndAnalyzeGoogleDriveFile(
    driveItem: GoogleDriveAudioFileItem
  ): Promise<StoredTrackRecord> {
    const existingAll = await trackDatabase.getAllTracks();
    const existingRecord = existingAll.find(
      (t) => t.driveFileId === driveItem.id
    );

    const blob = await fetchGoogleDriveAudioBlob(
      driveItem.id,
      driveItem.mimeType
    );

    if (existingRecord) {
      await trackDatabase.saveTrackFileReference(existingRecord.id, blob);
      if (existingRecord.analysisStatus === 'READY' && existingRecord.bpm) {
        const updated: StoredTrackRecord = {
          ...existingRecord,
          fileAvailable: true,
        };
        await trackDatabase.saveTrack(updated);
        await this.notifyListeners();
        return updated;
      }
    }

    const trackId = existingRecord?.id || `gdrive-${driveItem.id}`;
    const fileForMeta = new File([blob], driveItem.name, {
      type: driveItem.mimeType || 'audio/mpeg',
    });
    const quickMeta = await extractRealMetadataFromFile(fileForMeta);
    const normFolder = normalizeFolderPath(
      driveItem.folderPathDisplay || 'Mi unidad'
    );

    const initialRecord: StoredTrackRecord = {
      id: trackId,
      title: quickMeta.title || driveItem.name.replace(/\.[^/.]+$/, ''),
      artist: quickMeta.artist || 'Unknown',
      album: quickMeta.album || 'Google Drive',
      genre: quickMeta.genre || 'Unknown',
      year: quickMeta.year || '',
      trackNumber: quickMeta.trackNumber || '',
      durationSec: existingRecord?.durationSec || 0,
      bpm: quickMeta.tagBpm || existingRecord?.bpm || null,
      bpmConfidence: existingRecord?.bpmConfidence || 0,
      key: quickMeta.tagKey || existingRecord?.key || 'Unknown',
      keyConfidence: existingRecord?.keyConfidence || 0,
      sampleRate: existingRecord?.sampleRate || null,
      channels: existingRecord?.channels || null,
      bitrateKbps: existingRecord?.bitrateKbps || null,
      fileSizeBytes: driveItem.sizeBytes || blob.size,
      format: detectAudioFormatBadge(driveItem.name, driveItem.mimeType),
      fileName: driveItem.name,
      folderPath: normFolder,
      originFolder: normFolder.split('/').pop() || 'Google Drive',
      storageVolume: 'CLOUD',
      storageVolumeLabel: 'Google Drive',
      referenceUri: `gdrive://${driveItem.id}/${driveItem.name}`,
      driveFileId: driveItem.id,
      location: driveItem.name,
      fileAvailable: true,
      sourceType: 'GOOGLE_DRIVE',
      analysisStatus: 'ANALYZING',
      analysisProgress: 20,
      cuePointSec: existingRecord?.cuePointSec ?? 0,
      firstBeatOffsetSec: existingRecord?.firstBeatOffsetSec ?? 0,
      beatGridResolution: existingRecord?.beatGridResolution ?? 1,
      hotCues:
        existingRecord?.hotCues ||
        Array.from({ length: 8 }, (_, idx) => ({
          index: idx + 1,
          label: 'EMPTY',
          positionSec: null,
          active: false,
        })),
      addedAt: existingRecord?.addedAt || Date.now(),
      analyzedAt: existingRecord?.analyzedAt || null,
    };

    await trackDatabase.saveTrack(initialRecord);
    await trackDatabase.saveTrackFileReference(trackId, blob);
    await this.notifyListeners();

    // Perform full PCM analysis (BPM, Camelot Key, Beat Grid, HD Waveform) and cache in TrackDatabase
    await this.processTrack(trackId);
    const finalRecord = await trackDatabase.getTrack(trackId);
    await this.notifyListeners();
    return finalRecord || initialRecord;
  }

  private async registerCollectedAudioEntries(
    entries: Array<{
      file: File;
      handle?: FileSystemFileHandle;
      folderPath: string;
    }>,
    options: {
      sourceType: AudioSourceType;
      storageVolume: StorageVolumeType;
      storageVolumeLabel?: string;
    }
  ): Promise<void> {
    if (entries.length === 0) return;

    this.totalCount += entries.length;
    const existingTracks = await trackDatabase.getAllTracks();

    for (let i = 0; i < entries.length; i++) {
      const { file, handle, folderPath } = entries[i];
      const normFolder = normalizeFolderPath(folderPath);
      const originFolder =
        normFolder.split('/').filter(Boolean).pop() || 'Raíz';
      const referenceUri = `${options.sourceType.toLowerCase()}://${
        normFolder ? normFolder + '/' : ''
      }${file.name}`;

      // 1. Check if this exact record already exists in the same source + folder
      const exactExisting = existingTracks.find(
        (t) =>
          t.sourceType === options.sourceType &&
          normalizeFolderPath(t.folderPath) === normFolder &&
          (t.fileName || '').toLowerCase() === file.name.toLowerCase() &&
          t.fileSizeBytes === file.size
      );

      if (exactExisting) {
        await trackDatabase.saveTrackFileReference(
          exactExisting.id,
          file,
          handle
        );
        if (
          !exactExisting.fileAvailable ||
          exactExisting.analysisStatus !== 'READY'
        ) {
          await trackDatabase.saveTrack({
            ...exactExisting,
            fileAvailable: true,
            analysisStatus: exactExisting.bpm ? 'READY' : 'PENDING',
          });
          if (!exactExisting.bpm) {
            this.queue.push({ trackId: exactExisting.id });
          }
        }
        continue;
      }

      // 2. Check if this song was already analyzed previously so we reuse cached analysis immediately
      const cachedAnalysis = await trackDatabase.findAnalyzedTrackByIdentity(
        file.name,
        file.size
      );
      const cachedWaveform = cachedAnalysis
        ? await trackDatabase.getWaveform(cachedAnalysis.id)
        : null;

      const trackId = `trk-${Date.now()}-${i}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      const quickMeta = await extractRealMetadataFromFile(file);

      if (cachedAnalysis && cachedWaveform) {
        const reusedRecord: StoredTrackRecord = {
          ...cachedAnalysis,
          id: trackId,
          fileName: file.name,
          folderPath: normFolder,
          originFolder,
          storageVolume: options.storageVolume,
          storageVolumeLabel: options.storageVolumeLabel,
          referenceUri,
          location: file.name,
          fileAvailable: true,
          sourceType: options.sourceType,
          analysisStatus: 'READY',
          analysisProgress: 100,
          addedAt: Date.now(),
        };

        await trackDatabase.saveTrack(reusedRecord);
        await trackDatabase.saveTrackFileReference(trackId, file, handle);
        await trackDatabase.saveWaveform({
          ...cachedWaveform,
          trackId,
          updatedAt: Date.now(),
        });
        this.completedCount += 1;
        continue;
      }

      const initialRecord: StoredTrackRecord = {
        id: trackId,
        title: quickMeta.title,
        artist: quickMeta.artist,
        album: quickMeta.album,
        genre: quickMeta.genre,
        year: quickMeta.year,
        trackNumber: quickMeta.trackNumber,
        durationSec: 0,
        bpm: quickMeta.tagBpm,
        bpmConfidence: quickMeta.tagBpm ? 85 : 0,
        key: quickMeta.tagKey || 'Unknown',
        keyConfidence: quickMeta.tagKey ? 80 : 0,
        sampleRate: null,
        channels: null,
        bitrateKbps: null,
        fileSizeBytes: file.size,
        format: quickMeta.format,
        fileName: file.name,
        folderPath: normFolder,
        originFolder,
        storageVolume: options.storageVolume,
        storageVolumeLabel: options.storageVolumeLabel,
        referenceUri,
        location: file.name,
        fileAvailable: true,
        sourceType: options.sourceType,
        analysisStatus: 'PENDING',
        analysisProgress: 5,
        cuePointSec: 0,
        firstBeatOffsetSec: 0,
        beatGridResolution: 1,
        hotCues: Array.from({ length: 8 }, (_, idx) => ({
          index: idx + 1,
          label: 'EMPTY',
          positionSec: null,
          active: false,
        })),
        addedAt: Date.now(),
        analyzedAt: null,
      };

      await trackDatabase.saveTrack(initialRecord);
      await trackDatabase.saveTrackFileReference(trackId, file, handle);

      this.queue.push({ trackId });
    }

    await this.notifyListeners();
    this.processNextInQueue();
  }

  private enqueueTrackForAnalysis(trackId: string): void {
    if (!this.queue.some((q) => q.trackId === trackId)) {
      this.totalCount += 1;
      this.queue.push({ trackId });
    }
    this.processNextInQueue();
  }

  async reanalyzeTrack(trackId: string): Promise<void> {
    const trk = await trackDatabase.getTrack(trackId);
    if (!trk) return;

    await trackDatabase.saveTrack({
      ...trk,
      analysisStatus: 'PENDING',
      analysisProgress: 0,
    });

    this.enqueueTrackForAnalysis(trackId);
    await this.notifyListeners();
  }

  private async processNextInQueue(): Promise<void> {
    if (this.isProcessing) return;

    // Do not run CPU-intensive audio analysis while a song is actively playing on any deck
    const engA = realAudioEngine.deckA;
    const engB = realAudioEngine.deckB;
    const isPlaying = Boolean(
      (engA && engA.isPlaying()) ||
      (engB && engB.isPlaying())
    );
    if (isPlaying) {
      setTimeout(() => {
        this.processNextInQueue();
      }, 1500);
      return;
    }

    const nextItem = this.queue.shift();

    if (!nextItem) {
      this.isProcessing = false;
      this.currentTrackId = null;
      this.currentTrackTitle = null;
      this.currentStage = 'IDLE';
      this.currentProgress = 100;
      await this.notifyListeners();
      return;
    }

    this.isProcessing = true;
    this.currentTrackId = nextItem.trackId;

    try {
      await this.processTrack(nextItem.trackId);
    } catch (err) {
      console.error('Track analysis failed:', err);
      const failedTrack = await trackDatabase.getTrack(nextItem.trackId);
      if (failedTrack) {
        await trackDatabase.saveTrack({
          ...failedTrack,
          analysisStatus: 'UNSUPPORTED_CODEC',
          analysisProgress: 0,
        });
      }
    }

    this.completedCount += 1;
    this.isProcessing = false;
    await this.notifyListeners();

    setTimeout(() => {
      this.processNextInQueue();
    }, 30);
  }

  private async processTrack(trackId: string): Promise<void> {
    const record = await trackDatabase.getTrack(trackId);
    if (!record) return;

    this.currentTrackTitle = record.title;

    const blob = await trackDatabase.getAudioBlob(trackId);
    if (!blob) {
      await trackDatabase.saveTrack({
        ...record,
        fileAvailable: false,
        analysisStatus: 'MISSING_FILE',
      });
      return;
    }

    // Stage 1: Registering
    this.currentStage = 'REGISTERING';
    this.currentProgress = 15;
    const latest1 = (await trackDatabase.getTrack(trackId)) || record;
    await trackDatabase.saveTrack({
      ...latest1,
      fileAvailable: true,
      analysisStatus: 'REGISTERING',
      analysisProgress: 15,
    });
    await this.notifyListeners();

    const fileForMeta = new File([blob], record.fileName || record.location, {
      type: blob.type || 'audio/mpeg',
    });
    const meta = await extractRealMetadataFromFile(fileForMeta);

    // Stage 2: Analyzing BPM, Beat Grid & Musical Key
    this.currentStage = 'ANALYZING';
    this.currentProgress = 55;
    const latest2 = (await trackDatabase.getTrack(trackId)) || latest1;
    await trackDatabase.saveTrack({
      ...latest2,
      fileAvailable: true,
      analysisStatus: 'ANALYZING',
      analysisProgress: 55,
    });
    await this.notifyListeners();

    const analysisResult = await analyzeAudioBlobPcm(
      blob,
      meta.tagBpm,
      meta.tagKey
    );

    // Stage 3: Saving Waveform & Finalizing Track Record
    this.currentStage = 'SAVING';
    this.currentProgress = 95;

    const waveformRecord: CachedWaveformRecord = {
      trackId,
      overviewPeaks: analysisResult.overviewPeaks,
      detailLow: analysisResult.detailLow,
      detailMid: analysisResult.detailMid,
      detailHigh: analysisResult.detailHigh,
      detailPeaks: analysisResult.detailLow,
      lowPeaks: analysisResult.detailLow,
      midPeaks: analysisResult.detailMid,
      highPeaks: analysisResult.detailHigh,
      updatedAt: Date.now(),
    };
    await trackDatabase.saveWaveform(waveformRecord);

    const beatSec = 60 / (analysisResult.bpm || 124);
    const firstBeat = analysisResult.firstBeatOffsetSec || 0;
    const autoHotCues = Array.from({ length: 8 }, (_, idx) => {
      if (idx < 4) {
        const pos = Math.min(
          Math.max(0, firstBeat + idx * 16 * beatSec),
          Math.max(0, analysisResult.durationSec - 1)
        );
        return {
          index: idx + 1,
          label: `CUE ${idx + 1}`,
          positionSec: Number(pos.toFixed(2)),
          active: true,
        };
      }
      return {
        index: idx + 1,
        label: 'EMPTY',
        positionSec: null,
        active: false,
      };
    });

    const estimatedBitrateKbps =
      analysisResult.durationSec > 0 && record.fileSizeBytes > 0
        ? Math.round(
            (record.fileSizeBytes * 8) / (analysisResult.durationSec * 1000)
          )
        : null;

    const latestFinal = (await trackDatabase.getTrack(trackId)) || latest2;
    const finalRecord: StoredTrackRecord = {
      ...latestFinal,
      title: meta.title || latestFinal.title,
      artist: meta.artist !== 'Unknown' ? meta.artist : latestFinal.artist,
      album: meta.album !== 'Unknown' ? meta.album : latestFinal.album,
      genre: meta.genre !== 'Unknown' ? meta.genre : latestFinal.genre,
      year: meta.year || latestFinal.year,
      trackNumber: meta.trackNumber || latestFinal.trackNumber,
      durationSec: analysisResult.durationSec,
      bpm: analysisResult.bpm,
      bpmConfidence: analysisResult.bpmConfidence,
      key: analysisResult.key,
      keyConfidence: analysisResult.keyConfidence,
      sampleRate: analysisResult.sampleRate,
      channels: analysisResult.channels,
      bitrateKbps: estimatedBitrateKbps,
      format: meta.format || latestFinal.format,
      fileAvailable: true,
      cuePointSec: Number(firstBeat.toFixed(3)),
      firstBeatOffsetSec: Number(firstBeat.toFixed(4)),
      beatGridResolution: latestFinal.beatGridResolution || 1,
      hotCues: latestFinal.hotCues.some((c) => c.active)
        ? latestFinal.hotCues
        : autoHotCues,
      analysisStatus: 'READY',
      analysisProgress: 100,
      analyzedAt: Date.now(),
    };

    await trackDatabase.saveTrack(finalRecord);
  }
}

export const importManager = new ImportManagerService();
