/**
 * DJ Core — Offline Per-Song Stem Preparation Queue & Persistent Cache Manager
 *
 * Architecture:
 *   - Processes ONLY songs explicitly requested by the user ("Preparar separación de pistas"
 *     in the ⋮ menu, "Preparar carpeta", or "Preparar varias canciones en cola").
 *   - NEVER runs automatically during normal playback or when pressing a stem pad.
 *   - Processes strictly 1 song at a time in a background Web Worker, divided into 10-second
 *     segments with cooperative main-thread yields so live deck playback remains 100% glitch-free.
 *   - Supports Pause, Resume, Cancel, and Retry per song.
 *   - Saves the 4 separated stereo stems (VOCAL, MELODY, BASS, DRUMS) persistently in IndexedDB
 *     (`trackDatabase.savePreparedStems`) so prepared stems survive app restarts.
 */

import {
  computeStableAudioFileId,
  StoredTrackRecord,
  trackDatabase,
  TrackStemPreparationStatus,
} from '../database/TrackDatabase';
import { fetchGoogleDriveAudioBlob } from '../drive/GoogleDriveService';
import {
  CachedStemSegment,
  stemCacheStore,
  StemValidationReport,
} from './StemCacheStore';
import {
  REAL_SOURCE_SEPARATION_WORKER_CODE,
  SEGMENT_DURATION_SEC,
} from './StemSeparationEngine';

export interface StemQueueStatus {
  isProcessing: boolean;
  isPaused: boolean;
  activeTrackId: string | null;
  activeTrackTitle: string | null;
  progressPercent: number;
  queuedTrackIds: string[];
  modelName: string;
}

export type StemQueueListener = (
  status: StemQueueStatus,
  updatedTrack?: StoredTrackRecord
) => void;

export type TrackStemReadyListener = (trackId: string) => void;

const MODEL_NAME = '2D-HPSS + REPET-SIM + SHS-F0 2048-STFT';

interface ActiveJobState {
  trackId: string;
  audioFileId: string;
  trackTitle: string;
  sampleRate: number;
  totalSamples: number;
  segmentSamples: number;
  totalSegments: number;
  nextSegmentIndex: number;
  ch0: Float32Array;
  ch1: Float32Array;
}

export const STEM_EXECUTION_ENABLED = false;

class StemPreparationQueueService {
  private queue: string[] = [];
  private activeJob: ActiveJobState | null = null;
  private isStartingNext = false;
  private startingTrackId: string | null = null;
  private cancelledTrackIds = new Set<string>();
  private isPaused = false;
  private isWorkerRunningSegment = false;
  private scheduledNextSegmentTimer: ReturnType<typeof setTimeout> | null =
    null;
  private worker: Worker | null = null;
  private currentProgressPercent = 0;

  private listeners = new Set<StemQueueListener>();
  private readyListeners = new Set<TrackStemReadyListener>();
  private liveTrackCache = new Map<string, StoredTrackRecord>();

  constructor() {
    this.initWorker();
  }

  private clearScheduledTimer(): void {
    if (this.scheduledNextSegmentTimer !== null) {
      clearTimeout(this.scheduledNextSegmentTimer);
      this.scheduledNextSegmentTimer = null;
    }
  }

  private initWorker(): void {
    if (!STEM_EXECUTION_ENABLED) return;
    if (typeof Worker === 'undefined') return;
    try {
      const blob = new Blob([REAL_SOURCE_SEPARATION_WORKER_CODE], {
        type: 'application/javascript',
      });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      this.worker.onmessage = (e) => {
        const d = e.data;
        if (!d) return;
        if (d.type === 'SEGMENT_PROGRESS') {
          this.handleWorkerSubProgress(d);
        } else if (d.type === 'SEGMENT_SEPARATED') {
          void this.handleWorkerSegmentCompleted(d);
        }
      };
    } catch {
      this.worker = null;
    }
  }

  /**
   * Immediately terminates the running Web Worker and spawns a fresh idle Worker
   * so that PAUSE or CANCEL halts CPU/DSP processing at that exact millisecond
   * and guarantees the progress percentage NEVER increases while Paused or Cancelled.
   */
  private terminateAndResetWorker(): void {
    this.clearScheduledTimer();
    this.isWorkerRunningSegment = false;
    if (this.worker) {
      try {
        this.worker.onmessage = null;
        this.worker.terminate();
      } catch {
        // Ignore worker termination errors
      }
      this.worker = null;
    }
    this.initWorker();
  }

  /**
   * Called once on application startup to clean up any tracks whose status in IndexedDB
   * was left as 'PREPARING' or 'QUEUED' when a previous browser session was closed.
   */
  public async recoverInterruptedJobsOnStartup(): Promise<void> {
    const allTracks = await trackDatabase.getAllTracks();
    for (const t of allTracks) {
      const isCurrentlyActive =
        this.activeJob?.trackId === t.id ||
        this.startingTrackId === t.id ||
        this.queue.includes(t.id);
      if (isCurrentlyActive) continue;

      if (
        t.stemPreparationStatus === 'PREPARING' ||
        t.stemPreparationStatus === 'QUEUED' ||
        t.stemPreparationStatus === 'PENDING'
      ) {
        const nextStatus: TrackStemPreparationStatus =
          (t.stemPreparationProgress || 0) > 0 ? 'PAUSED' : 'NONE';
        await this.updateTrackStemFields(t.id, {
          stemPreparationStatus: nextStatus,
          stemPreparationProgress:
            nextStatus === 'PAUSED' ? t.stemPreparationProgress || 0 : 0,
        });
      }
    }
  }

  public subscribe(listener: StemQueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onTrackStemsReady(listener: TrackStemReadyListener): () => void {
    this.readyListeners.add(listener);
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  public getStatus(): StemQueueStatus {
    return {
      isProcessing:
        (this.activeJob !== null || this.isStartingNext) && !this.isPaused,
      isPaused: this.isPaused,
      activeTrackId: this.activeJob
        ? this.activeJob.trackId
        : this.startingTrackId,
      activeTrackTitle: this.activeJob ? this.activeJob.trackTitle : null,
      progressPercent: this.currentProgressPercent,
      queuedTrackIds: [...this.queue],
      modelName: MODEL_NAME,
    };
  }

  private emitStatus(updatedTrack?: StoredTrackRecord): void {
    const st = this.getStatus();
    this.listeners.forEach((cb) => cb(st, updatedTrack));
  }

  private async updateTrackStemFields(
    trackId: string,
    patch: {
      stemPreparationStatus: TrackStemPreparationStatus;
      stemPreparationProgress: number;
      stemPreparedAt?: number;
      stemModelName?: string;
      stemPreparationError?: string;
      stemValidationSummary?: StoredTrackRecord['stemValidationSummary'];
    },
    persistToDb = true
  ): Promise<StoredTrackRecord | undefined> {
    const existing =
      (persistToDb ? await trackDatabase.getTrack(trackId) : null) ||
      this.liveTrackCache.get(trackId) ||
      (await trackDatabase.getTrack(trackId));
    if (!existing) return undefined;
    const updated: StoredTrackRecord = {
      ...existing,
      ...patch,
    };
    this.liveTrackCache.set(trackId, updated);
    if (persistToDb) {
      await trackDatabase.saveTrack(updated);
    }
    this.emitStatus(updated);
    return updated;
  }

  /**
   * Enqueues a single song for offline stem separation.
   */
  public async prepareTrack(trackId: string, force = false): Promise<void> {
    if (!STEM_EXECUTION_ENABLED) return;
    const track = await trackDatabase.getTrack(trackId);
    if (!track) return;

    this.cancelledTrackIds.delete(trackId);

    if (!force && track.stemPreparationStatus === 'READY') {
      const hasSaved = await trackDatabase.hasPreparedStems(trackId);
      if (hasSaved) {
        this.emitStatus(track);
        this.readyListeners.forEach((cb) => cb(trackId));
        return;
      }
    }

    if (
      (this.activeJob && this.activeJob.trackId === trackId) ||
      this.startingTrackId === trackId
    ) {
      if (this.isPaused) {
        await this.resumePreparation(trackId);
      }
      return;
    }

    if (!this.queue.includes(trackId)) {
      this.queue.push(trackId);
    }

    await this.updateTrackStemFields(trackId, {
      stemPreparationStatus: 'QUEUED',
      stemPreparationProgress: 0,
      stemPreparationError: undefined,
      stemModelName: MODEL_NAME,
    });

    if (!this.activeJob && !this.isStartingNext && !this.isPaused) {
      void this.startNextInQueue();
    }
  }

  /**
   * Enqueues multiple songs sequentially.
   */
  public async prepareMultipleTracks(trackIds: string[]): Promise<void> {
    for (const id of trackIds) {
      const trk = await trackDatabase.getTrack(id);
      if (!trk) continue;
      this.cancelledTrackIds.delete(id);
      if (trk.stemPreparationStatus === 'READY') {
        const hasSaved = await trackDatabase.hasPreparedStems(id);
        if (hasSaved) continue;
      }
      if (
        this.activeJob?.trackId === id ||
        this.startingTrackId === id ||
        this.queue.includes(id)
      ) {
        continue;
      }
      this.queue.push(id);
      await this.updateTrackStemFields(id, {
        stemPreparationStatus: 'QUEUED',
        stemPreparationProgress: 0,
        stemPreparationError: undefined,
        stemModelName: MODEL_NAME,
      });
    }

    if (!this.activeJob && !this.isStartingNext && !this.isPaused) {
      void this.startNextInQueue();
    }
  }

  /**
   * Enqueues all songs in a given folder (and subfolders) sequentially.
   */
  public async prepareFolder(
    folderPath: string,
    sourceType?: 'LOCAL' | 'IMPORTED'
  ): Promise<void> {
    const allTracks = await trackDatabase.getAllTracks();
    const normTarget = folderPath.replace(/^\/+|\/+$/g, '');
    const matching = allTracks.filter((t) => {
      if (sourceType && t.sourceType !== sourceType) return false;
      const tf = (t.folderPath || '').replace(/^\/+|\/+$/g, '');
      if (!normTarget) return true;
      return tf === normTarget || tf.startsWith(`${normTarget}/`);
    });
    await this.prepareMultipleTracks(matching.map((t) => t.id));
  }

  /**
   * Pauses the currently active stem preparation job immediately without losing completed segments.
   * Stops the Worker immediately so the progress percentage NEVER increases while PAUSED.
   */
  public async pausePreparation(trackId?: string): Promise<void> {
    const targetId =
      this.activeJob?.trackId || this.startingTrackId || trackId || null;
    if (!targetId) return;
    if (
      trackId &&
      this.activeJob &&
      this.activeJob.trackId !== trackId &&
      this.startingTrackId !== trackId
    ) {
      return;
    }

    this.isPaused = true;
    this.terminateAndResetWorker();

    await this.updateTrackStemFields(targetId, {
      stemPreparationStatus: 'PAUSED',
      stemPreparationProgress: this.currentProgressPercent,
      stemModelName: MODEL_NAME,
    });
  }

  /**
   * Resumes a paused stem preparation job from the exact next segment.
   */
  public async resumePreparation(trackId?: string): Promise<void> {
    if (this.activeJob && (!trackId || this.activeJob.trackId === trackId)) {
      this.isPaused = false;
      await this.updateTrackStemFields(this.activeJob.trackId, {
        stemPreparationStatus: 'PREPARING',
        stemPreparationProgress: this.currentProgressPercent,
        stemModelName: MODEL_NAME,
      });
      if (!this.isWorkerRunningSegment) {
        this.dispatchNextSegment();
      }
      return;
    }

    if (trackId) {
      this.isPaused = false;
      await this.prepareTrack(trackId, true);
    } else if (!this.activeJob && this.queue.length > 0) {
      this.isPaused = false;
      void this.startNextInQueue();
    }
  }

  /**
   * Cancels preparation for `trackId`, stops the Worker immediately, removes it from the queue,
   * cleans partial cache, and sets its status to CANCELLED.
   */
  public async cancelPreparation(trackId: string): Promise<void> {
    this.cancelledTrackIds.add(trackId);
    const qIdx = this.queue.indexOf(trackId);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
    }

    const track = await trackDatabase.getTrack(trackId);
    const audioFileId = track ? computeStableAudioFileId(track) : trackId;

    if (
      (this.activeJob && this.activeJob.trackId === trackId) ||
      this.startingTrackId === trackId
    ) {
      this.terminateAndResetWorker();
      this.activeJob = null;
      this.isPaused = false;
      this.currentProgressPercent = 0;
      stemCacheStore.removeTrackCache(trackId);
      stemCacheStore.removeTrackCache(audioFileId);
      await trackDatabase.deletePreparedStems(audioFileId);
      await trackDatabase.deletePreparedStems(trackId);
      await this.updateTrackStemFields(trackId, {
        stemPreparationStatus: 'CANCELLED',
        stemPreparationProgress: 0,
        stemPreparationError: undefined,
      });
      if (!this.isStartingNext) {
        void this.startNextInQueue();
      }
      return;
    }

    stemCacheStore.removeTrackCache(trackId);
    stemCacheStore.removeTrackCache(audioFileId);
    await this.updateTrackStemFields(trackId, {
      stemPreparationStatus: 'CANCELLED',
      stemPreparationProgress: 0,
      stemPreparationError: undefined,
    });
  }

  /**
   * Retries preparation for a track that encountered an error or was cancelled.
   */
  public async retryPreparation(trackId: string): Promise<void> {
    this.cancelledTrackIds.delete(trackId);
    stemCacheStore.removeTrackCache(trackId);
    await this.prepareTrack(trackId, true);
  }

  private async startNextInQueue(): Promise<void> {
    if (
      this.activeJob ||
      this.isStartingNext ||
      this.isPaused ||
      this.queue.length === 0
    ) {
      this.emitStatus();
      return;
    }

    const nextTrackId = this.queue.shift()!;
    if (this.cancelledTrackIds.has(nextTrackId)) {
      this.cancelledTrackIds.delete(nextTrackId);
      void this.startNextInQueue();
      return;
    }

    const track = await trackDatabase.getTrack(nextTrackId);
    if (!track) {
      void this.startNextInQueue();
      return;
    }

    this.isStartingNext = true;
    this.startingTrackId = nextTrackId;
    this.currentProgressPercent = 1;
    await this.updateTrackStemFields(nextTrackId, {
      stemPreparationStatus: this.isPaused ? 'PAUSED' : 'PREPARING',
      stemPreparationProgress: 1,
      stemPreparationError: undefined,
      stemModelName: MODEL_NAME,
    });

    try {
      let resolved = await trackDatabase.resolveTrackAudioFile(track);
      if (
        (resolved.isMissing || !resolved.blob) &&
        track.sourceType === 'GOOGLE_DRIVE' &&
        track.driveFileId
      ) {
        const driveBlob = await fetchGoogleDriveAudioBlob(
          track.driveFileId,
          track.mimeType || 'audio/mpeg'
        );
        if (driveBlob) {
          resolved = { blob: driveBlob, isMissing: false };
        }
      }

      if (resolved.isMissing || !resolved.blob) {
        throw new Error('Archivo de audio no disponible para separar pistas.');
      }

      const arrayBuffer = await resolved.blob.arrayBuffer();
      const OfflineCtx =
        window.OfflineAudioContext ||
        (
          window as unknown as {
            webkitOfflineAudioContext: typeof OfflineAudioContext;
          }
        ).webkitOfflineAudioContext;
      const decoderCtx = new OfflineCtx(2, 1, 44100);
      const audioBuffer = await decoderCtx.decodeAudioData(
        arrayBuffer.slice(0)
      );

      // Check if user cancelled this track while decoding was in progress
      if (this.cancelledTrackIds.has(nextTrackId)) {
        this.cancelledTrackIds.delete(nextTrackId);
        this.isStartingNext = false;
        this.startingTrackId = null;
        this.currentProgressPercent = 0;
        await this.updateTrackStemFields(nextTrackId, {
          stemPreparationStatus: 'CANCELLED',
          stemPreparationProgress: 0,
          stemPreparationError: undefined,
        });
        void this.startNextInQueue();
        return;
      }

      const sr = audioBuffer.sampleRate;
      const totalSamples = audioBuffer.length;
      const segmentSamples = sr * SEGMENT_DURATION_SEC;
      const totalSegments = Math.max(
        1,
        Math.ceil(totalSamples / segmentSamples)
      );

      const ch0 = new Float32Array(audioBuffer.getChannelData(0));
      const ch1 =
        audioBuffer.numberOfChannels > 1
          ? new Float32Array(audioBuffer.getChannelData(1))
          : ch0;

      const audioFileId = computeStableAudioFileId(track);
      stemCacheStore.removeTrackCache(nextTrackId);
      stemCacheStore.initTrackCache(
        nextTrackId,
        sr,
        totalSamples,
        segmentSamples,
        MODEL_NAME
      );
      stemCacheStore.registerKeyAlias(audioFileId, nextTrackId);

      this.activeJob = {
        trackId: nextTrackId,
        audioFileId,
        trackTitle: `${track.artist} - ${track.title}`,
        sampleRate: sr,
        totalSamples,
        segmentSamples,
        totalSegments,
        nextSegmentIndex: 0,
        ch0,
        ch1,
      };
      this.isStartingNext = false;
      this.startingTrackId = null;

      if (this.isPaused) {
        await this.updateTrackStemFields(nextTrackId, {
          stemPreparationStatus: 'PAUSED',
          stemPreparationProgress: this.currentProgressPercent,
          stemModelName: MODEL_NAME,
        });
        return;
      }

      this.currentProgressPercent = 2;
      await this.updateTrackStemFields(nextTrackId, {
        stemPreparationStatus: 'PREPARING',
        stemPreparationProgress: 2,
        stemModelName: MODEL_NAME,
      });

      this.dispatchNextSegment();
    } catch (err) {
      this.isStartingNext = false;
      this.startingTrackId = null;
      this.activeJob = null;
      this.currentProgressPercent = 0;
      await this.updateTrackStemFields(nextTrackId, {
        stemPreparationStatus: 'ERROR',
        stemPreparationProgress: 0,
        stemPreparationError:
          (err as Error)?.message || 'Error al preparar separación de pistas.',
      });
      void this.startNextInQueue();
    }
  }

  private dispatchNextSegment(): void {
    this.clearScheduledTimer();
    if (!this.activeJob || this.isPaused || this.isWorkerRunningSegment) {
      return;
    }

    if (!this.worker) {
      this.initWorker();
    }
    if (!this.worker) {
      const failedId = this.activeJob.trackId;
      this.activeJob = null;
      void this.updateTrackStemFields(failedId, {
        stemPreparationStatus: 'ERROR',
        stemPreparationProgress: 0,
        stemPreparationError: 'Worker de separación no disponible.',
      });
      return;
    }

    const job = this.activeJob;
    const segIdx = job.nextSegmentIndex;
    const startSample = segIdx * job.segmentSamples;
    const numSamples = Math.min(
      job.segmentSamples,
      job.totalSamples - startSample
    );

    if (numSamples <= 0 || segIdx >= job.totalSegments) {
      void this.finalizeActiveJob();
      return;
    }

    const sliceL = job.ch0.slice(startSample, startSample + numSamples);
    const sliceR = job.ch1.slice(startSample, startSample + numSamples);

    this.isWorkerRunningSegment = true;
    this.worker.postMessage(
      {
        type: 'SEPARATE_SEGMENT',
        trackKey: job.trackId,
        segmentIndex: segIdx,
        startSample,
        numSamples,
        sampleRate: job.sampleRate,
        inL: sliceL,
        inR: sliceR,
        computeValidation: segIdx === 0,
      },
      [sliceL.buffer, sliceR.buffer]
    );
  }

  private handleWorkerSubProgress(d: {
    trackKey: string;
    segmentIndex: number;
    frameProgress: number;
  }): void {
    if (
      this.isPaused ||
      !this.activeJob ||
      this.activeJob.trackId !== d.trackKey ||
      this.cancelledTrackIds.has(d.trackKey)
    ) {
      return;
    }

    const job = this.activeJob;
    const progress = Math.min(
      99,
      Math.max(
        2,
        Math.round(
          ((d.segmentIndex + Math.max(0, Math.min(1, d.frameProgress))) /
            job.totalSegments) *
            98
        )
      )
    );

    if (progress > this.currentProgressPercent) {
      this.currentProgressPercent = progress;
      void this.updateTrackStemFields(
        job.trackId,
        {
          stemPreparationStatus: 'PREPARING',
          stemPreparationProgress: progress,
          stemModelName: MODEL_NAME,
        },
        false
      );
    }
  }

  private async handleWorkerSegmentCompleted(d: {
    trackKey: string;
    segmentIndex: number;
    startSample: number;
    numSamples: number;
    vocalL: Float32Array;
    vocalR: Float32Array;
    melodyL: Float32Array;
    melodyR: Float32Array;
    bassL: Float32Array;
    bassR: Float32Array;
    drumsL: Float32Array;
    drumsR: Float32Array;
    validationReport?: StemValidationReport | null;
  }): Promise<void> {
    this.isWorkerRunningSegment = false;

    // STRICT STATE MACHINE GUARD:
    // If the job was paused or cancelled, NEVER advance progress or accept late segments.
    if (this.isPaused) {
      return;
    }

    if (
      !this.activeJob ||
      this.activeJob.trackId !== d.trackKey ||
      this.cancelledTrackIds.has(d.trackKey)
    ) {
      if (!this.activeJob && !this.isStartingNext && !this.isPaused) {
        void this.startNextInQueue();
      }
      return;
    }

    const job = this.activeJob;
    const segment: CachedStemSegment = {
      segmentIndex: d.segmentIndex,
      startSample: d.startSample,
      numSamples: d.numSamples,
      vocalL: d.vocalL,
      vocalR: d.vocalR,
      melodyL: d.melodyL,
      melodyR: d.melodyR,
      bassL: d.bassL,
      bassR: d.bassR,
      drumsL: d.drumsL,
      drumsR: d.drumsR,
    };

    stemCacheStore.storeSegment(job.trackId, segment, d.validationReport);
    stemCacheStore.registerKeyAlias(job.audioFileId, job.trackId);
    job.nextSegmentIndex = d.segmentIndex + 1;

    const progress = Math.min(
      99,
      Math.max(2, Math.round((job.nextSegmentIndex / job.totalSegments) * 98))
    );
    this.currentProgressPercent = progress;

    if (job.nextSegmentIndex >= job.totalSegments) {
      await this.finalizeActiveJob();
      return;
    }

    await this.updateTrackStemFields(
      job.trackId,
      {
        stemPreparationStatus: 'PREPARING',
        stemPreparationProgress: progress,
        stemModelName: MODEL_NAME,
      },
      false
    );

    if (!this.isPaused && this.activeJob?.trackId === job.trackId) {
      this.clearScheduledTimer();
      // Cooperative 180ms yield between 10-second segments so live audio playback has absolute priority
      this.scheduledNextSegmentTimer = setTimeout(() => {
        this.scheduledNextSegmentTimer = null;
        this.dispatchNextSegment();
      }, 180);
    }
  }

  private async finalizeActiveJob(): Promise<void> {
    if (!this.activeJob) return;
    const finishedTrackId = this.activeJob.trackId;
    const finishedAudioFileId = this.activeJob.audioFileId;
    const finishedSampleRate = this.activeJob.sampleRate;
    const finishedTotalSegments = this.activeJob.totalSegments;
    this.activeJob = null;
    this.currentProgressPercent = 100;

    try {
      stemCacheStore.registerKeyAlias(finishedAudioFileId, finishedTrackId);
      const preparedRecord =
        await stemCacheStore.exportPreparedRecordAsync(finishedTrackId);
      if (preparedRecord) {
        await trackDatabase.savePreparedStems(preparedRecord);
      }

      await this.updateTrackStemFields(
        finishedTrackId,
        {
          stemPreparationStatus: 'READY',
          stemPreparationProgress: 100,
          stemPreparedAt: Date.now(),
          stemModelName: MODEL_NAME,
          stemPreparationError: undefined,
          stemValidationSummary: preparedRecord?.validationSummary,
        },
        true
      );

      console.info('PREPARATION_COMPLETE', {
        trackId: finishedTrackId,
        audioFileId: finishedAudioFileId,
        separationStatus: 'READY',
        availableStems: 4,
        segmentsLoaded: finishedTotalSegments,
        sampleRate: finishedSampleRate,
      });

      this.readyListeners.forEach((cb) => cb(finishedTrackId));
    } catch (err) {
      await this.updateTrackStemFields(finishedTrackId, {
        stemPreparationStatus: 'ERROR',
        stemPreparationProgress: 0,
        stemPreparationError:
          (err as Error)?.message || 'Error al guardar stems en caché.',
      });
    }

    this.currentProgressPercent = 0;
    this.clearScheduledTimer();
    this.scheduledNextSegmentTimer = setTimeout(() => {
      this.scheduledNextSegmentTimer = null;
      void this.startNextInQueue();
    }, 40);
  }
}

export const stemPreparationQueue = new StemPreparationQueueService();
