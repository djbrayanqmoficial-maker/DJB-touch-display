import React from 'react';
import { DeckState, formatTimeCode } from '../core/dj/DjEngine';
import { WaveformCanvas } from './WaveformCanvas';

interface DeckModuleCardProps {
  deck: DeckState;
  compact?: boolean;
  onTogglePlay: () => void;
  onTriggerCue: () => void;
  onToggleSync: () => void;
  onChangePitch: (pitchPercent: number) => void;
  onTriggerHotCue: (index: number) => void;
  onClearHotCue: (index: number) => void;
  onToggleLoop: () => void;
  onSetLoopLength: (beats: number) => void;
  onSeek: (seconds: number) => void;
  onNudgeJog: (deltaDeg: number) => void;
}

export const DeckModuleCard: React.FC<DeckModuleCardProps> = React.memo(({
  deck,
  compact = false,
  onTogglePlay,
  onTriggerCue,
  onToggleSync,
  onChangePitch,
  onTriggerHotCue,
  onClearHotCue,
  onToggleLoop,
  onSetLoopLength,
  onSeek,
  onNudgeJog,
}) => {
  const remainingSec = Math.max(0, deck.durationSec - deck.positionSec);

  return (
    <section className="flex flex-col justify-between bg-[#101317] border border-[#232830] rounded-xl p-3.5 h-full select-none">
      {/* Top Deck Header: Deck Identifier, Track Info, BPM & Timecode */}
      <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-[#1E232B]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-base shrink-0 border ${
              deck.id === 'A'
                ? 'bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]'
                : 'bg-[#F4F6F8]/10 text-[#F4F6F8] border-[#F4F6F8]'
            }`}
          >
            {deck.id}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#F4F6F8] truncate">
              {deck.title}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-[#949CA8] truncate">
              <span className="truncate">{deck.artist}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[#00F0FF]">Key {deck.key}</span>
            </div>
          </div>
        </div>

        {/* High-Contrast Telemetry Readout */}
        <div className="flex items-center gap-4 shrink-0 text-right font-mono tabular-nums">
          <div>
            <div className="text-[10px] text-[#949CA8]">TEMPO</div>
            <div className="text-xs text-[#F4F6F8]">
              {deck.pitchPercent >= 0 ? `+${deck.pitchPercent.toFixed(2)}%` : `${deck.pitchPercent.toFixed(2)}%`}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#949CA8]">BPM</div>
            <div className="text-lg font-bold text-[#00F0FF] leading-tight">
              {deck.currentBpm.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#949CA8]">REMAIN</div>
            <div className="text-sm font-semibold text-[#F4F6F8] leading-tight">
              -{formatTimeCode(remainingSec)}
            </div>
          </div>
        </div>
      </div>

      {/* Deck Local Waveform Strip */}
      <div className="my-2">
        <WaveformCanvas
          trackId={deck.trackId}
          deckId={deck.id}
          positionSec={deck.positionSec}
          durationSec={deck.durationSec}
          bpm={deck.currentBpm}
          isPlaying={deck.isPlaying}
          hotCues={deck.hotCues}
          loop={deck.loop}
          height={compact ? 54 : 68}
          onSeek={onSeek}
        />
      </div>

      {/* Platter + Pitch Fader Row */}
      <div className="grid grid-cols-12 gap-3 items-center my-1">
        {/* Touch Jog Platter */}
        <div className="col-span-7 flex flex-col items-center justify-center">
          <div
            onClick={() => onNudgeJog(18)}
            title="Toque para nudge de fase (+18°)"
            className={`relative ${
              compact ? 'w-32 h-32' : 'w-40 h-40'
            } rounded-full bg-[#07080A] border-2 flex items-center justify-center cursor-pointer transition-shadow ${
              deck.isPlaying
                ? 'border-[#00F0FF] shadow-[0_0_22px_rgba(0,240,255,0.22)]'
                : 'border-[#2A303A]'
            }`}
          >
            {/* Rotating position marker ring */}
            <div
              style={{ transform: `rotate(${deck.jogAngleDeg}deg)` }}
              className="absolute inset-2 rounded-full border border-dashed border-[#2B323C] flex justify-center items-start"
            >
              <span className="w-2 h-4 rounded-sm bg-[#00F0FF] -mt-1 shadow-[0_0_8px_#00F0FF]" />
            </div>

            {/* Inner Display Core */}
            <div className="w-20 h-20 rounded-full bg-[#101317] border border-[#232830] flex flex-col items-center justify-center text-center px-1">
              <span className="text-[10px] font-mono text-[#949CA8]">
                DECK {deck.id}
              </span>
              <span className="text-xs font-mono font-bold text-[#F4F6F8] tabular-nums mt-0.5">
                {formatTimeCode(deck.positionSec)}
              </span>
              <span className="text-[10px] font-mono text-[#00F0FF] mt-0.5">
                {deck.isPlaying ? 'PLAYING' : 'PAUSED'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => onNudgeJog(-12)}
              className="min-h-[36px] px-3 rounded-lg bg-[#161A20] border border-[#232830] text-xs font-mono text-[#F4F6F8] hover:border-[#00F0FF] active:scale-95 transition"
            >
              - BEND
            </button>
            <button
              type="button"
              onClick={() => onNudgeJog(12)}
              className="min-h-[36px] px-3 rounded-lg bg-[#161A20] border border-[#232830] text-xs font-mono text-[#F4F6F8] hover:border-[#00F0FF] active:scale-95 transition"
            >
              + BEND
            </button>
          </div>
        </div>

        {/* Pitch Controls & Quick Loop Row */}
        <div className="col-span-5 flex flex-col justify-between gap-2.5 bg-[#0B0D10] border border-[#1E232B] rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#949CA8]">
              PITCH (±{deck.pitchRange}%)
            </span>
            <button
              type="button"
              onClick={() => onChangePitch(0)}
              className="px-2 py-0.5 rounded bg-[#161A20] border border-[#2A303A] text-[10px] font-mono text-[#00F0FF] hover:bg-[#1E242D]"
            >
              RESET 0%
            </button>
          </div>

          <input
            type="range"
            min={-deck.pitchRange}
            max={deck.pitchRange}
            step={0.05}
            value={deck.pitchPercent}
            onChange={(e) => onChangePitch(parseFloat(e.target.value))}
            className="w-full djb-fader my-1"
          />

          {/* Quick Auto-Loop Controls */}
          <div className="pt-1 border-t border-[#1E232B]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-[#949CA8]">AUTO LOOP</span>
              <button
                type="button"
                onClick={onToggleLoop}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition ${
                  deck.loop.active
                    ? 'bg-[#00F0FF] text-[#07080A] border-[#00F0FF]'
                    : 'bg-[#161A20] text-[#949CA8] border-[#2A303A]'
                }`}
              >
                {deck.loop.active ? `ACTIVE ${deck.loop.lengthBeats}B` : 'LOOP OFF'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 4, 8].map((beats) => (
                <button
                  key={beats}
                  type="button"
                  onClick={() => onSetLoopLength(beats)}
                  className={`min-h-[36px] rounded font-mono text-xs font-semibold border transition ${
                    deck.loop.active && deck.loop.lengthBeats === beats
                      ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]'
                      : 'bg-[#14181E] text-[#F4F6F8] border-[#232830] hover:border-[#949CA8]'
                  }`}
                >
                  {beats}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Performance Hot Cue Pads */}
      <div className="grid grid-cols-4 gap-2 my-2">
        {deck.hotCues.slice(0, 4).map((cue) => (
          <button
            key={cue.index}
            type="button"
            onClick={() => onTriggerHotCue(cue.index)}
            onContextMenu={(e) => {
              e.preventDefault();
              onClearHotCue(cue.index);
            }}
            className={`min-h-[46px] rounded-lg px-2 py-1.5 flex flex-col justify-between text-left border transition active:scale-[0.98] ${
              cue.active
                ? 'bg-[#151920] border-[#00F0FF] text-[#F4F6F8] shadow-[inset_0_0_10px_rgba(0,240,255,0.12)]'
                : 'bg-[#0B0D10] border-[#1F242C] text-[#949CA8] hover:border-[#2E3642]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-mono font-bold text-[#00F0FF]">
                CUE {cue.index}
              </span>
              {cue.positionSec !== null && (
                <span className="text-[10px] font-mono tabular-nums text-[#949CA8]">
                  {formatTimeCode(cue.positionSec)}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold truncate w-full">
              {cue.active ? cue.label : 'SET CUE'}
            </span>
          </button>
        ))}
      </div>

      {/* Primary Tactile Transport Bar (SYNC / CUE / PLAY-PAUSE) */}
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        <button
          type="button"
          onClick={onToggleSync}
          className={`min-h-[48px] rounded-lg font-display font-bold text-xs tracking-wider border transition active:scale-[0.98] ${
            deck.isSyncActive
              ? 'bg-[#162329] text-[#00F0FF] border-[#00F0FF]'
              : 'bg-[#15191F] text-[#949CA8] border-[#262C35] hover:text-[#F4F6F8]'
          }`}
        >
          SYNC
        </button>

        <button
          type="button"
          onClick={onTriggerCue}
          className="min-h-[48px] rounded-lg font-display font-bold text-xs tracking-wider bg-[#15191F] text-[#F4F6F8] border border-[#2E3540] hover:border-[#F4F6F8] active:bg-[#F4F6F8] active:text-[#07080A] transition"
        >
          CUE
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className={`min-h-[48px] rounded-lg font-display font-bold text-xs tracking-wider border transition active:scale-[0.98] ${
            deck.isPlaying
              ? 'bg-[#00F0FF] text-[#07080A] border-[#00F0FF] shadow-[0_0_16px_rgba(0,240,255,0.35)]'
              : 'bg-[#F4F6F8] text-[#07080A] border-[#F4F6F8] hover:bg-[#00F0FF]'
          }`}
        >
          {deck.isPlaying ? 'PAUSE' : 'PLAY'}
        </button>
      </div>
    </section>
  );
});
