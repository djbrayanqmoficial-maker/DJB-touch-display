import React from 'react';
import { DeckState, formatTimeCode, OperatingMode } from '../core/dj/DjEngine';
import { CachedWaveformRecord } from '../core/database/TrackDatabase';
import { WaveformCanvas } from './WaveformCanvas';
import { PWAInstallButton } from './PWAInstallButton';

interface TopDeckHeaderBarProps {
  deckA: DeckState;
  deckB: DeckState;
  cuePointA?: number;
  cuePointB?: number;
  cachedWaveformA?: CachedWaveformRecord | null;
  cachedWaveformB?: CachedWaveformRecord | null;
  operatingMode: OperatingMode;
  isRecording: boolean;
  onToggleRecording: () => void;
  onOpenLibraryForDeck: (deckId: 'A' | 'B') => void;
  onSeekDeckA: (sec: number) => void;
  onSeekDeckB: (sec: number) => void;
  onOpenModeSelector: () => void;
  onTogglePflA?: () => void;
  onTogglePflB?: () => void;
  vinylModeA?: boolean;
  vinylModeB?: boolean;
  onToggleVinylA?: () => void;
  onToggleVinylB?: () => void;
}

export const TopDeckHeaderBar: React.FC<TopDeckHeaderBarProps> = React.memo(({
  deckA,
  deckB,
  cuePointA = 0,
  cuePointB = 0,
  cachedWaveformA,
  cachedWaveformB,
  operatingMode,
  isRecording,
  onToggleRecording,
  onOpenLibraryForDeck,
  onSeekDeckA,
  onSeekDeckB,
  onOpenModeSelector,
  onTogglePflA,
  onTogglePflB,
  vinylModeA = true,
  vinylModeB = true,
  onToggleVinylA,
  onToggleVinylB,
}) => {
  const remainA = Math.max(0, deckA.durationSec - deckA.positionSec);
  const remainB = Math.max(0, deckB.durationSec - deckB.positionSec);

  return (
    <header className="h-[68px] shrink-0 bg-[#0B0C0E] border-b border-[#252830] px-3 flex items-center justify-between gap-3 select-none">
      {/* DECK A: Load (+) Button + Track Metadata + Full Overview Waveform */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onOpenLibraryForDeck('A')}
          title="Cargar pista en Deck A"
          className="w-12 h-12 rounded-full bg-[#1C1F24] border border-[#9CA3AF] hover:border-white flex items-center justify-center shrink-0 active:scale-95 transition"
        >
          <span className="text-2xl font-light text-[#0099DB] leading-none">+</span>
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-baseline gap-2 text-xs truncate mb-1">
            <span className="font-mono tabular-nums text-[#0099DB] shrink-0">
              -{formatTimeCode(remainA).slice(0, 4)}
            </span>
            <span className="font-bold text-[#F3F4F6] truncate">
              {deckA.title}
            </span>
            <span className="text-[#9CA3AF] text-[11px] truncate shrink-0">
              {deckA.artist}
            </span>
            <span className="font-mono text-[10px] text-[#0099DB] shrink-0">
              {deckA.key}
            </span>
            <button
              type="button"
              onClick={onTogglePflA}
              title="PFL / Preescucha Auriculares Deck A (Sincronizado con LED PFL Numark DJ2GO)"
              className={`px-1.5 py-0.5 rounded-xs font-mono text-[9px] font-bold border shrink-0 transition ${
                deckA.pflHeadphoneCue
                  ? 'bg-[#0099DB] text-[#0B0C0E] border-[#28B5F4]'
                  : 'bg-[#15181C] text-[#9CA3AF] border-[#383D47] hover:text-white'
              }`}
            >
              PFL
            </button>
            <button
              type="button"
              onClick={onToggleVinylA}
              title="Alternar Modo Scratch/Vinyl vs Pitch Bend Normal en Deck A"
              className={`px-1.5 py-0.5 rounded-xs font-mono text-[9px] font-bold border shrink-0 transition ${
                vinylModeA
                  ? 'bg-[#1D2833] text-[#0099DB] border-[#0099DB]'
                  : 'bg-[#15181C] text-[#9CA3AF] border-[#383D47] hover:text-white'
              }`}
            >
              {vinylModeA ? 'VINYL' : 'BEND'}
            </button>
          </div>

          <WaveformCanvas
            trackId={deckA.trackId}
            deckId="A"
            positionSec={deckA.positionSec}
            durationSec={deckA.durationSec}
            bpm={deckA.currentBpm}
            isPlaying={deckA.isPlaying}
            hotCues={deckA.hotCues}
            loop={deckA.loop}
            cuePointSec={cuePointA}
            cachedWaveform={cachedWaveformA}
            height={34}
            variant="overview"
            onSeek={onSeekDeckA}
          />
        </div>
      </div>

      {/* CENTER: Beatgrid Indicator + REC + Mode Status + PWA Fullscreen/Install */}
      <div className="flex flex-col items-center justify-center shrink-0 px-1 gap-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenModeSelector}
            title="Cambiar entre Standalone Mode y VirtualDJ Mode"
            className="w-7 h-7 rounded-full bg-[#15181C] border border-[#383D47] flex items-center justify-center hover:border-[#0099DB] transition"
          >
            <div className="flex items-center gap-[2px]">
              <span className="w-[2px] h-2.5 bg-[#F3F4F6]" />
              <span className="w-[2px] h-3 bg-[#0099DB]" />
              <span className="w-[2px] h-2.5 bg-[#F3F4F6]" />
              <span className="w-[2px] h-2.5 bg-[#F3F4F6]" />
            </div>
          </button>
          <PWAInstallButton compact />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleRecording}
            className="flex items-center gap-1 text-[11px] font-medium text-[#D1D5DB] hover:text-white"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRecording ? 'bg-[#E03131] animate-pulse' : 'bg-[#991B1B]'
              }`}
            />
            <span>REC</span>
          </button>
          <button
            type="button"
            onClick={onOpenModeSelector}
            className="text-[10px] font-mono text-[#9CA3AF] hover:text-white"
          >
            {operatingMode === OperatingMode.VIRTUALDJ
              ? 'VDJ'
              : operatingMode === OperatingMode.MOBILE_ONLY
              ? 'CEL'
              : 'STD'}
          </button>
        </div>
      </div>

      {/* DECK B: Track Metadata + Full Overview Waveform + Load (+) Button */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-baseline justify-end gap-2 text-xs truncate mb-1">
            <button
              type="button"
              onClick={onToggleVinylB}
              title="Alternar Modo Scratch/Vinyl vs Pitch Bend Normal en Deck B"
              className={`px-1.5 py-0.5 rounded-xs font-mono text-[9px] font-bold border shrink-0 transition ${
                vinylModeB
                  ? 'bg-[#1D2833] text-[#0099DB] border-[#0099DB]'
                  : 'bg-[#15181C] text-[#9CA3AF] border-[#383D47] hover:text-white'
              }`}
            >
              {vinylModeB ? 'VINYL' : 'BEND'}
            </button>
            <button
              type="button"
              onClick={onTogglePflB}
              title="PFL / Preescucha Auriculares Deck B (Sincronizado con LED PFL Numark DJ2GO)"
              className={`px-1.5 py-0.5 rounded-xs font-mono text-[9px] font-bold border shrink-0 transition ${
                deckB.pflHeadphoneCue
                  ? 'bg-[#0099DB] text-[#0B0C0E] border-[#28B5F4]'
                  : 'bg-[#15181C] text-[#9CA3AF] border-[#383D47] hover:text-white'
              }`}
            >
              PFL
            </button>
            <span className="font-mono text-[10px] text-[#0099DB] shrink-0">
              {deckB.key}
            </span>
            <span className="text-[#9CA3AF] text-[11px] truncate shrink-0">
              {deckB.artist}
            </span>
            <span className="font-bold text-[#F3F4F6] truncate">
              {deckB.title}
            </span>
            <span className="font-mono tabular-nums text-[#0099DB] shrink-0">
              -{formatTimeCode(remainB).slice(0, 4)}
            </span>
          </div>

          <WaveformCanvas
            trackId={deckB.trackId}
            deckId="B"
            positionSec={deckB.positionSec}
            durationSec={deckB.durationSec}
            bpm={deckB.currentBpm}
            isPlaying={deckB.isPlaying}
            hotCues={deckB.hotCues}
            loop={deckB.loop}
            cuePointSec={cuePointB}
            cachedWaveform={cachedWaveformB}
            height={34}
            variant="overview"
            onSeek={onSeekDeckB}
          />
        </div>

        <button
          type="button"
          onClick={() => onOpenLibraryForDeck('B')}
          title="Cargar pista en Deck B"
          className="w-12 h-12 rounded-full bg-[#1C1F24] border border-[#9CA3AF] hover:border-white flex items-center justify-center shrink-0 active:scale-95 transition"
        >
          <span className="text-2xl font-light text-[#0099DB] leading-none">+</span>
        </button>
      </div>
    </header>
  );
});
