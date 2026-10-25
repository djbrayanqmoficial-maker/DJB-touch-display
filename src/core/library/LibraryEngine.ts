/**
 * DJB Core — Library Module
 * Manages track metadata, music folders, local storage sources, and crate filtering.
 */

export interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  durationSec: number;
  genre: string;
  folder: string;
  bitrateKbps: number;
  analyzed: boolean;
}

export interface MusicFolderConfig {
  id: string;
  path: string;
  trackCount: number;
  storageType: 'INTERNAL_STORAGE' | 'SD_CARD' | 'USB_OTG';
  autoScanOnLaunch: boolean;
}

export const INITIAL_MUSIC_FOLDERS: MusicFolderConfig[] = [
  {
    id: 'fld-1',
    path: '/storage/emulated/0/Music/DJB_Master_Crates',
    trackCount: 142,
    storageType: 'INTERNAL_STORAGE',
    autoScanOnLaunch: true,
  },
  {
    id: 'fld-2',
    path: '/storage/emulated/0/DJB_Touch/Club_Edits_2026',
    trackCount: 64,
    storageType: 'INTERNAL_STORAGE',
    autoScanOnLaunch: true,
  },
  {
    id: 'fld-3',
    path: '/mnt/media_rw/USB_OTG/Rekord_Exports',
    trackCount: 88,
    storageType: 'USB_OTG',
    autoScanOnLaunch: false,
  },
];

export const INITIAL_LIBRARY_TRACKS: LibraryTrack[] = [
  {
    id: 'trk-01',
    title: 'Night Drive Protocol (Club Mix)',
    artist: 'DJ Brayan · Industrial Dub',
    bpm: 126.0,
    key: '8A',
    durationSec: 348,
    genre: 'Tech House',
    folder: 'DJB_Master_Crates',
    bitrateKbps: 320,
    analyzed: true,
  },
  {
    id: 'trk-02',
    title: 'Cybernetic Subhorizon (Extended)',
    artist: 'Klangwerk · Peak Time',
    bpm: 128.0,
    key: '8A',
    durationSec: 372,
    genre: 'Techno',
    folder: 'DJB_Master_Crates',
    bitrateKbps: 320,
    analyzed: true,
  },
  {
    id: 'trk-03',
    title: 'Obsidian Groove (Original Mix)',
    artist: 'Vortex & Brayan',
    bpm: 125.0,
    key: '9A',
    durationSec: 315,
    genre: 'Minimal Deep',
    folder: 'Club_Edits_2026',
    bitrateKbps: 320,
    analyzed: true,
  },
  {
    id: 'trk-04',
    title: 'Monolith Warehouse Tool',
    artist: 'Klangwerk',
    bpm: 130.0,
    key: '5A',
    durationSec: 390,
    genre: 'Hard Groove',
    folder: 'DJB_Master_Crates',
    bitrateKbps: 320,
    analyzed: true,
  },
  {
    id: 'trk-05',
    title: 'Frecuencia Nocturna (VIP Edit)',
    artist: 'DJ Brayan',
    bpm: 124.0,
    key: '7A',
    durationSec: 294,
    genre: 'Latin Tech',
    folder: 'Club_Edits_2026',
    bitrateKbps: 320,
    analyzed: true,
  },
  {
    id: 'trk-06',
    title: 'Pulse Generator 909',
    artist: 'Analog Sector',
    bpm: 127.0,
    key: '10A',
    durationSec: 336,
    genre: 'Electro Tech',
    folder: 'Rekord_Exports',
    bitrateKbps: 320,
    analyzed: false,
  },
  {
    id: 'trk-07',
    title: 'Subbass Architecture (Dub)',
    artist: 'Modulare',
    bpm: 126.0,
    key: '8B',
    durationSec: 360,
    genre: 'Minimal Tech',
    folder: 'DJB_Master_Crates',
    bitrateKbps: 320,
    analyzed: true,
  },
  {
    id: 'trk-08',
    title: 'Kinetic Impulse (VIP Intro)',
    artist: 'DJ Brayan',
    bpm: 128.0,
    key: '6A',
    durationSec: 310,
    genre: 'Peak Techno',
    folder: 'Club_Edits_2026',
    bitrateKbps: 320,
    analyzed: true,
  },
];
