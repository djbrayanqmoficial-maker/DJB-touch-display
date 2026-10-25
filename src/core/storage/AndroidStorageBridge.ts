/**
 * DJ Core — Android Native APK & Web Storage Permission / Volume Bridge
 *
 * Strictly separates:
 * 1. Installed Android APK runtime (uses native Android StorageManager, MediaStore.Audio,
 *    SAF ACTION_OPEN_DOCUMENT_TREE, and runtime permissions READ_MEDIA_AUDIO / READ_EXTERNAL_STORAGE).
 * 2. Web / AI Studio Preview runtime (uses standard File System Access API / Directory Picker
 *    without inventing fake folders, fake permissions, or synthetic files).
 */

export type RuntimeStorageEnvironment = 'ANDROID_APK' | 'WEB_BROWSER';

export type StorageVolumeKind =
  | 'INTERNAL'
  | 'SD_CARD'
  | 'USB_OTG'
  | 'EXTERNAL_HDD';

export type StoragePermissionState =
  | 'GRANTED'
  | 'PROMPT_REQUIRED'
  | 'DENIED'
  | 'WEB_MANUAL_PICKER';

export interface MountedStorageVolume {
  id: string;
  label: string;
  kind: StorageVolumeKind;
  rootPath: string;
  isRemovable: boolean;
  isAccessible: boolean;
}

export interface NativeBridgeAudioEntry {
  uri: string;
  fileName: string;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  durationSec: number;
  sizeBytes: number;
  mimeType: string;
  relativePath: string;
  volumeKind: StorageVolumeKind;
  volumeLabel: string;
}

interface AndroidNativeStorageInterface {
  hasAudioPermission?: () => boolean;
  requestAudioPermission?: () => boolean | Promise<boolean>;
  getMountedVolumesJson?: () => string;
  scanAllAudioFilesJson?: () => string;
  openDocumentTreePicker?: (volumeKind?: string) => string | Promise<string>;
}

declare global {
  interface Window {
    DjbAndroidStorage?: AndroidNativeStorageInterface;
    AndroidBridge?: AndroidNativeStorageInterface;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

/**
 * Excluded directory & file patterns so internal app files, caches, temp files,
 * development files, and UI assets NEVER appear in LOCAL or TODA LA MÚSICA.
 */
const EXCLUDED_FOLDER_NAMES = new Set([
  'android/data',
  'android/obb',
  'android/media',
  '.cache',
  'cache',
  'code_cache',
  'temp',
  'tmp',
  '.thumbnails',
  '.trash',
  '.trashed',
  'lost.dir',
  'system volume information',
  '$recycle.bin',
  'node_modules',
  '.git',
  'dist',
  'dev-dist',
  'build',
  'src',
  'public',
  'assets',
]);

export function isExcludedSystemOrAppPath(
  folderPath: string,
  fileName = ''
): boolean {
  const cleanFile = fileName.trim();
  if (cleanFile.startsWith('.') || cleanFile.startsWith('~$')) {
    return true;
  }
  const lowerFile = cleanFile.toLowerCase();
  if (
    lowerFile.endsWith('.tmp') ||
    lowerFile.endsWith('.temp') ||
    lowerFile.endsWith('.part') ||
    lowerFile.endsWith('.crdownload') ||
    lowerFile.endsWith('.apk') ||
    lowerFile.endsWith('.dex') ||
    lowerFile.endsWith('.json') ||
    lowerFile.endsWith('.js') ||
    lowerFile.endsWith('.ts') ||
    lowerFile.endsWith('.tsx') ||
    lowerFile.endsWith('.css') ||
    lowerFile.endsWith('.html') ||
    lowerFile.endsWith('.png') ||
    lowerFile.endsWith('.jpg') ||
    lowerFile.endsWith('.jpeg') ||
    lowerFile.endsWith('.webp') ||
    lowerFile.endsWith('.svg') ||
    lowerFile.endsWith('.pdf') ||
    lowerFile.endsWith('.zip') ||
    lowerFile.endsWith('.db')
  ) {
    return true;
  }

  const normalized = (folderPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  if (!normalized) return false;

  if (
    normalized.includes('android/data') ||
    normalized.includes('android/obb') ||
    normalized.includes('com.djbrayan.djbtouchdisplay') ||
    normalized.includes('app://synthetic')
  ) {
    return true;
  }

  const segments = normalized.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg.startsWith('.') || EXCLUDED_FOLDER_NAMES.has(seg)) {
      return true;
    }
  }
  return false;
}

export function inferVolumeKindFromName(nameOrPath: string): StorageVolumeKind {
  const lower = (nameOrPath || '').toLowerCase();
  if (
    lower.includes('usb') ||
    lower.includes('otg') ||
    lower.includes('flash') ||
    lower.includes('thumb')
  ) {
    return 'USB_OTG';
  }
  if (
    lower.includes('hdd') ||
    lower.includes('ssd') ||
    lower.includes('external drive') ||
    lower.includes('disco')
  ) {
    return 'EXTERNAL_HDD';
  }
  if (
    lower.includes('sd') ||
    lower.includes('microsd') ||
    lower.includes('mmc') ||
    lower.includes('card') ||
    /^[0-9a-f]{4}-[0-9a-f]{4}$/i.test(lower)
  ) {
    return 'SD_CARD';
  }
  return 'INTERNAL';
}

class AndroidStorageBridgeService {
  private getNativeBridge(): AndroidNativeStorageInterface | null {
    if (typeof window === 'undefined') return null;
    return window.DjbAndroidStorage || window.AndroidBridge || null;
  }

  public getRuntimeEnvironment(): RuntimeStorageEnvironment {
    if (typeof window === 'undefined') return 'WEB_BROWSER';
    if (this.getNativeBridge()) return 'ANDROID_APK';
    if (window.Capacitor?.isNativePlatform?.()) return 'ANDROID_APK';
    return 'WEB_BROWSER';
  }

  public isAndroidApk(): boolean {
    return this.getRuntimeEnvironment() === 'ANDROID_APK';
  }

  public isDirectoryPickerSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof (window as unknown as { showDirectoryPicker?: unknown })
        .showDirectoryPicker === 'function'
    );
  }

  public getPermissionState(
    hasMountedDirectoriesOrTracks: boolean
  ): StoragePermissionState {
    const bridge = this.getNativeBridge();
    if (bridge && typeof bridge.hasAudioPermission === 'function') {
      try {
        return bridge.hasAudioPermission() ? 'GRANTED' : 'PROMPT_REQUIRED';
      } catch {
        return 'PROMPT_REQUIRED';
      }
    }

    if (hasMountedDirectoriesOrTracks) {
      return 'GRANTED';
    }
    return this.isAndroidApk() ? 'PROMPT_REQUIRED' : 'WEB_MANUAL_PICKER';
  }

  public async requestStoragePermission(): Promise<boolean> {
    const bridge = this.getNativeBridge();
    if (bridge && typeof bridge.requestAudioPermission === 'function') {
      try {
        const granted = await bridge.requestAudioPermission();
        return Boolean(granted);
      } catch {
        return false;
      }
    }
    return false;
  }

  public getMountedStorageVolumes(
    registeredVolumeLabels: Array<{
      volumeKind: StorageVolumeKind;
      label: string;
    }> = []
  ): MountedStorageVolume[] {
    const bridge = this.getNativeBridge();
    if (bridge && typeof bridge.getMountedVolumesJson === 'function') {
      try {
        const raw = bridge.getMountedVolumesJson();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => ({
            id: String(v.id || v.label || 'vol'),
            label: String(v.label || 'Almacenamiento'),
            kind: (v.kind as StorageVolumeKind) || 'INTERNAL',
            rootPath: String(v.rootPath || ''),
            isRemovable: Boolean(v.isRemovable),
            isAccessible: true,
          }));
        }
      } catch {
        // Fallback below
      }
    }

    // In Web / AI Studio or when building volume list from user-granted folders,
    // only return volumes that have actually been connected/granted by the user.
    const map = new Map<string, MountedStorageVolume>();
    for (const item of registeredVolumeLabels) {
      const id = `${item.volumeKind}:${item.label}`;
      if (!map.has(id)) {
        map.set(id, {
          id,
          label: item.label,
          kind: item.volumeKind,
          rootPath: item.label,
          isRemovable: item.volumeKind !== 'INTERNAL',
          isAccessible: true,
        });
      }
    }
    return Array.from(map.values());
  }

  public scanNativeApkAudioFiles(): NativeBridgeAudioEntry[] {
    const bridge = this.getNativeBridge();
    if (!bridge || typeof bridge.scanAllAudioFilesJson !== 'function') {
      return [];
    }

    try {
      const raw = bridge.scanAllAudioFilesJson();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const results: NativeBridgeAudioEntry[] = [];
      for (const item of parsed) {
        const fileName = String(item.fileName || '');
        const relPath = String(item.relativePath || '');
        if (!fileName || isExcludedSystemOrAppPath(relPath, fileName)) {
          continue;
        }
        const volName = String(item.volumeName || 'Interno');
        results.push({
          uri: String(item.uri || ''),
          fileName,
          title: String(item.title || fileName),
          artist: String(item.artist || 'Unknown'),
          album: String(item.album || 'Unknown'),
          genre: String(item.genre || 'Unknown'),
          durationSec: Math.max(0, Number(item.durationMs || 0) / 1000),
          sizeBytes: Math.max(0, Number(item.sizeBytes || 0)),
          mimeType: String(item.mimeType || 'audio/*'),
          relativePath: relPath.replace(/^\/+|\/+$/g, ''),
          volumeKind: inferVolumeKindFromName(volName),
          volumeLabel: volName === 'primary' ? 'Almacenamiento Interno' : volName,
        });
      }
      return results;
    } catch {
      return [];
    }
  }
}

export const androidStorageBridge = new AndroidStorageBridgeService();
