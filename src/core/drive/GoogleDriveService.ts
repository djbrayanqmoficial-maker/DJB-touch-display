/**
 * DJ Core — Google Drive Audio Source & Folder Explorer Service
 *
 * Implements:
 * - Client-side Firebase Auth with GoogleAuthProvider (`drive.readonly` scope)
 * - In-memory access token caching (never stored in localStorage/sessionStorage)
 * - Full navigation of:
 *   1. Mi unidad (My Drive + subfolders)
 *   2. Compartidos conmigo (Shared with me + subfolders)
 *   3. Unidades compartidas (Shared drives + subfolders)
 * - Filters strictly to Folders and Compatible Audio Files
 * - On-demand streaming / ephemeral in-memory LRU Blob cache (never downloads entire Drive library)
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { isSupportedAudioFile } from '../database/TrackDatabase';

export const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
let activeSignInPromise: Promise<{
  user: User;
  accessToken: string;
} | null> | null = null;
// Cache the access token strictly in memory.
let cachedAccessToken: string | null = null;

export type GoogleDriveSection =
  | 'MY_DRIVE'
  | 'SHARED_WITH_ME'
  | 'SHARED_DRIVES';

export interface GoogleDriveBreadcrumb {
  id: string;
  name: string;
  driveId?: string;
}

export interface GoogleDriveFolderItem {
  id: string;
  name: string;
  driveId?: string;
  isSharedDriveRoot?: boolean;
  modifiedTime?: string;
}

export interface GoogleDriveAudioFileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  modifiedTime?: string;
  driveId?: string;
  folderPathDisplay: string;
}

export interface GoogleDriveListingResult {
  folders: GoogleDriveFolderItem[];
  audioFiles: GoogleDriveAudioFileItem[];
}

// Ephemeral LRU in-memory cache of streamed Google Drive audio Blobs (max 6 tracks in RAM)
const MAX_EPHEMERAL_DRIVE_BLOBS = 6;
const ephemeralDriveBlobCache = new Map<string, Blob>();

function rememberEphemeralDriveBlob(fileId: string, blob: Blob): void {
  if (ephemeralDriveBlobCache.has(fileId)) {
    ephemeralDriveBlobCache.delete(fileId);
  }
  ephemeralDriveBlobCache.set(fileId, blob);
  if (ephemeralDriveBlobCache.size > MAX_EPHEMERAL_DRIVE_BLOBS) {
    const oldestKey = ephemeralDriveBlobCache.keys().next().value;
    if (oldestKey) {
      ephemeralDriveBlobCache.delete(oldestKey);
    }
  }
}

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInToGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  activeSignInPromise = (async () => {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('No se pudo obtener el token de acceso de Google Drive.');
      }

      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      // Gracefully handle user cancellation, popup closed, or concurrent duplicate request
      const isCancellation =
        error?.code === 'auth/cancelled-popup-request' ||
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/popup-blocked' ||
        (typeof error?.message === 'string' &&
          (error.message.includes('cancelled-popup-request') ||
            error.message.includes('popup-closed-by-user') ||
            error.message.includes('popup-blocked')));

      if (isCancellation) {
        console.warn('Google Drive sign-in was cancelled or closed by user.');
        return null;
      }
      console.error('Google Drive sign in error:', error);
      throw error;
    } finally {
      isSigningIn = false;
      activeSignInPromise = null;
    }
  })();

  return activeSignInPromise;
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getCurrentDriveUser = (): User | null => {
  return auth.currentUser;
};

export const signOutFromGoogleDrive = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
  ephemeralDriveBlobCache.clear();
};

/**
 * Lists folders and compatible audio files inside the specified Google Drive section & folder.
 */
export async function listGoogleDriveContents(params: {
  section: GoogleDriveSection;
  folderId: string | null; // null means root of that section
  driveId?: string;
  folderPathDisplay: string;
  searchQuery?: string;
}): Promise<GoogleDriveListingResult> {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const { section, folderId, driveId, folderPathDisplay, searchQuery = '' } =
    params;
  const cleanSearch = searchQuery.trim().replace(/'/g, "\\'");

  // Case 1: Root of "Unidades compartidas" (Shared Drives list)
  if (section === 'SHARED_DRIVES' && !folderId) {
    const url = new URL('https://www.googleapis.com/drive/v3/drives');
    url.searchParams.set('pageSize', '50');
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      cachedAccessToken = null;
      throw new Error('AUTH_REQUIRED');
    }
    if (!res.ok) {
      return { folders: [], audioFiles: [] };
    }
    const data = await res.json();
    const drives: Array<{ id: string; name: string }> = data.drives || [];
    const folders: GoogleDriveFolderItem[] = drives
      .filter(
        (d) =>
          !cleanSearch ||
          d.name.toLowerCase().includes(cleanSearch.toLowerCase())
      )
      .map((d) => ({
        id: d.id,
        name: d.name,
        driveId: d.id,
        isSharedDriveRoot: true,
      }));
    return { folders, audioFiles: [] };
  }

  // Build Drive v3 query for folders and files at current level
  const qParts: string[] = ['trashed = false'];
  if (cleanSearch) {
    qParts.push(`name contains '${cleanSearch}'`);
  } else if (section === 'MY_DRIVE') {
    const targetParent = folderId || 'root';
    qParts.push(`'${targetParent}' in parents`);
  } else if (section === 'SHARED_WITH_ME') {
    if (!folderId) {
      qParts.push('sharedWithMe = true');
    } else {
      qParts.push(`'${folderId}' in parents`);
    }
  } else if (section === 'SHARED_DRIVES') {
    const targetParent = folderId || driveId || 'root';
    qParts.push(`'${targetParent}' in parents`);
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', qParts.join(' and '));
  url.searchParams.set(
    'fields',
    'files(id,name,mimeType,size,modifiedTime,driveId)'
  );
  url.searchParams.set('pageSize', '200');
  url.searchParams.set('orderBy', 'folder,name_natural');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  if (section === 'SHARED_DRIVES' && driveId) {
    url.searchParams.set('corpora', 'drive');
    url.searchParams.set('driveId', driveId);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    throw new Error(`Error al consultar Google Drive (${res.status})`);
  }

  const data = await res.json();
  const rawFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    driveId?: string;
  }> = data.files || [];

  const folders: GoogleDriveFolderItem[] = [];
  const audioFiles: GoogleDriveAudioFileItem[] = [];

  for (const item of rawFiles) {
    if (!item.id || !item.name) continue;

    if (item.mimeType === 'application/vnd.google-apps.folder') {
      folders.push({
        id: item.id,
        name: item.name,
        driveId: item.driveId || driveId,
        modifiedTime: item.modifiedTime,
      });
      continue;
    }

    // Ignore Google Docs/Sheets/Slides virtual files
    if (item.mimeType?.startsWith('application/vnd.google-apps.')) {
      continue;
    }

    const sizeBytes = Number(item.size || 0);
    if (
      isSupportedAudioFile({
        name: item.name,
        type: item.mimeType || '',
        size: sizeBytes > 0 ? sizeBytes : 1024,
      })
    ) {
      audioFiles.push({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType || 'audio/*',
        sizeBytes,
        modifiedTime: item.modifiedTime,
        driveId: item.driveId || driveId,
        folderPathDisplay,
      });
    }
  }

  return { folders, audioFiles };
}

/**
 * Streams / downloads a single Google Drive audio file into the ephemeral in-memory LRU cache
 * so it can be played and analyzed without permanently copying files to the phone storage.
 */
export async function fetchGoogleDriveAudioBlob(
  fileId: string,
  mimeType = 'audio/mpeg'
): Promise<Blob> {
  const existing = ephemeralDriveBlobCache.get(fileId);
  if (existing && existing.size > 0) {
    return existing;
  }

  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}?alt=media&supportsAllDrives=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    throw new Error(
      `No se pudo transmitir el archivo de Google Drive (${res.status})`
    );
  }

  const rawBlob = await res.blob();
  const typedBlob =
    rawBlob.type && rawBlob.type !== 'application/octet-stream'
      ? rawBlob
      : new Blob([rawBlob], { type: mimeType || 'audio/mpeg' });

  rememberEphemeralDriveBlob(fileId, typedBlob);
  return typedBlob;
}
