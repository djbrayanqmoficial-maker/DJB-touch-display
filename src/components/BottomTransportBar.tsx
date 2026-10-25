import React, { useRef } from 'react';
import { DeckState } from '../core/dj/DjEngine';

interface BottomTransportBarProps {
  deckA: DeckState;
  deckB: DeckState;
  crossfader: number; // -100 to +100
  onChangeCrossfader: (val: number) => void;
  onCueDownA: () => void;
  onCueUpA: () => void;
  onPlayA: () => void;
  onSyncA: () => void;
  onCueDownB: () => void;
  onCueUpB: () => void;
  onPlayB: () => void;
  onSyncB: () => void;
  cueLedActiveA?: boolean;
  playLedActiveA?: boolean;
  syncLedActiveA?: boolean;
  cueLedActiveB?: boolean;
  playLedActiveB?: boolean;
  syncLedActiveB?: boolean;
}

export const BottomTransportBar: React.FC<BottomTransportBarProps> = React.memo(({
  deckA,
  deckB,
  crossfader,
  onChangeCrossfader,
  onCueDownA,
  onCueUpA,
  onPlayA,
  onSyncA,
  onCueDownB,
  onCueUpB,
  onPlayB,
  onSyncB,
  cueLedActiveA = false,
  playLedActiveA = false,
  syncLedActiveA = false,
  cueLedActiveB = false,
  playLedActiveB = false,
  syncLedActiveB = false,
}) => {
  const xfaderRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const normalizedXfader = (crossfader + 100) / 200; // 0.0 to 1.0

  const updateXfaderFromClientX = (clientX: number) => {
    if (!xfaderRef.current) return;
    const rect = xfaderRef.current.getBoundingClientRect();
    const padPx = 14;
    const usableWidth = Math.max(1, rect.width - padPx * 2);
    const relX = Math.min(
      usableWidth,
      Math.max(0, clientX - (rect.left + padPx))
    );
    const ratio = relX / usableWidth;
    const val = Math.round((ratio * 2 - 1) * 100);
    onChangeCrossfader(val);
  };

  return (
    <footer className="h-[68px] shrink-0 bg-[#1B1D22] border-t border-[#2C3038] px-4 flex items-center justify-between gap-4 select-none">
      {/* LEFT TRANSPORT CLUSTER (DECK A): CUE | PLAY | SYNC + BPM */}
      <div className="flex items-center gap-3 shrink-0 touch-none">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onCueDownA();
          }}
          onPointerUp={onCueUpA}
          onPointerCancel={onCueUpA}
          onPointerLeave={onCueUpA}
          title="CUE Deck A (En reproducción: vuelve al punto Cue y pausa · En pausa: fija nuevo Cue o preescucha al mantener pulsado)"
          className={`w-[88px] h-[52px] rounded-md active:bg-[#0099DB] active:text-[#0B0C0E] border flex items-center justify-center text-lg font-medium shadow-sm transition touch-none ${
            deckA.isCueing
              ? 'bg-[#0099DB] border-[#28B5F4] text-[#0B0C0E]'
              : cueLedActiveA
              ? 'bg-[#4B4F56] hover:bg-[#575C64] border-[#0099DB] text-[#F3F4F6]'
              : 'bg-[#4B4F56] hover:bg-[#575C64] border-[#383C42] text-[#F3F4F6]'
          }`}
        >
          CUE
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onPlayA();
          }}
          aria-label="Deck A Play Pause"
          className={`w-[88px] h-[52px] rounded-md border flex items-center justify-center shadow-sm transition touch-none ${
            deckA.isPlaying
              ? 'bg-[#0099DB] border-[#28B5F4] text-[#0B0C0E]'
              : playLedActiveA
              ? 'bg-[#4B4F56] hover:bg-[#575C64] border-[#0099DB] text-[#F3F4F6]'
              : 'bg-[#4B4F56] hover:bg-[#575C64] border-[#383C42] text-[#F3F4F6]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onSyncA();
          }}
          className={`w-[88px] h-[52px] rounded-md border flex flex-col items-center justify-center leading-tight shadow-sm transition touch-none ${
            deckA.isSyncActive
              ? syncLedActiveA
                ? 'bg-[#0099DB]/25 border-[#28B5F4] shadow-[0_0_8px_rgba(0,153,219,0.45)]'
                : 'bg-[#4B4F56] border-[#0099DB]'
              : syncLedActiveA
              ? 'bg-[#444952] border-[#0099DB]'
              : 'bg-[#3D4148] border-[#32363C]'
          }`}
        >
          <span className="text-sm font-medium text-[#F3F4F6]">SYNC</span>
          <span className="text-sm font-mono tabular-nums text-[#0099DB] font-semibold">
            {deckA.currentBpm.toFixed(1)}
          </span>
        </button>
      </div>

      {/* CENTER HORIZONTAL CROSSFADER WITH DOUBLE VERTICAL CAP */}
      <div className="flex-1 max-w-[360px] flex items-center gap-2 px-2 touch-none">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onChangeCrossfader(-100);
          }}
          title="Corte rápido a Deck A"
          className="text-[#0B0C0E] hover:text-[#9CA3AF] transition touch-none"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M16 5v14l-11-7z" />
          </svg>
        </button>

        <div
          ref={xfaderRef}
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Ignore capture error
            }
            activePointerIdRef.current = e.pointerId;
            updateXfaderFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (activePointerIdRef.current !== e.pointerId) return;
            e.preventDefault();
            updateXfaderFromClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            if (activePointerIdRef.current !== e.pointerId) return;
            activePointerIdRef.current = null;
            try {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            } catch {
              // Ignore release error
            }
          }}
          onPointerCancel={(e) => {
            if (activePointerIdRef.current !== e.pointerId) return;
            activePointerIdRef.current = null;
          }}
          onDoubleClick={() => onChangeCrossfader(0)}
          title="Toque y arrastre el Crossfader (Izquierda: Deck A · Centro: A+B · Derecha: Deck B) · Doble toque para centrar"
          className="relative flex-1 h-14 flex items-center cursor-ew-resize touch-none"
        >
          <div className="w-full h-3 rounded-full bg-[#0B0C0E] border border-[#2C3038] flex items-center px-1 pointer-events-none">
            <div className="w-full h-1.5 rounded-full bg-[#0099DB]" />
          </div>

          <div
            style={{
              left: `calc(14px + (100% - 28px) * ${normalizedXfader})`,
            }}
            className="absolute -translate-x-1/2 flex items-center gap-[3px] h-[50px] pointer-events-none"
          >
            <span className="w-[11px] h-full rounded-[3px] bg-[#DCDEE2] border border-[#A8ACB5] shadow" />
            <span className="w-[11px] h-full rounded-[3px] bg-[#DCDEE2] border border-[#A8ACB5] shadow" />
          </div>
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onChangeCrossfader(100);
          }}
          title="Corte rápido a Deck B"
          className="text-[#0B0C0E] hover:text-[#9CA3AF] transition touch-none"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>

      {/* RIGHT TRANSPORT CLUSTER (DECK B): SYNC + BPM | CUE | PLAY */}
      <div className="flex items-center gap-3 shrink-0 touch-none">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onSyncB();
          }}
          className={`w-[88px] h-[52px] rounded-md border flex flex-col items-center justify-center leading-tight shadow-sm transition touch-none ${
            deckB.isSyncActive
              ? syncLedActiveB
                ? 'bg-[#0099DB]/25 border-[#28B5F4] shadow-[0_0_8px_rgba(0,153,219,0.45)]'
                : 'bg-[#4B4F56] border-[#0099DB]'
              : syncLedActiveB
              ? 'bg-[#444952] border-[#0099DB]'
              : 'bg-[#3D4148] border-[#32363C]'
          }`}
        >
          <span className="text-sm font-medium text-[#F3F4F6]">SYNC</span>
          <span className="text-sm font-mono tabular-nums text-[#0099DB] font-semibold">
            {deckB.currentBpm.toFixed(1)}
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onCueDownB();
          }}
          onPointerUp={onCueUpB}
          onPointerCancel={onCueUpB}
          onPointerLeave={onCueUpB}
          title="CUE Deck B (En reproducción: vuelve al punto Cue y pausa · En pausa: fija nuevo Cue o preescucha al mantener pulsado)"
          className={`w-[88px] h-[52px] rounded-md active:bg-[#0099DB] active:text-[#0B0C0E] border flex items-center justify-center text-lg font-medium shadow-sm transition touch-none ${
            deckB.isCueing
              ? 'bg-[#0099DB] border-[#28B5F4] text-[#0B0C0E]'
              : cueLedActiveB
              ? 'bg-[#4B4F56] hover:bg-[#575C64] border-[#0099DB] text-[#F3F4F6]'
              : 'bg-[#4B4F56] hover:bg-[#575C64] border-[#383C42] text-[#F3F4F6]'
          }`}
        >
          CUE
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onPlayB();
          }}
          aria-label="Deck B Play Pause"
          className={`w-[88px] h-[52px] rounded-md border flex items-center justify-center shadow-sm transition touch-none ${
            deckB.isPlaying
              ? 'bg-[#0099DB] border-[#28B5F4] text-[#0B0C0E]'
              : playLedActiveB
              ? 'bg-[#4B4F56] hover:bg-[#575C64] border-[#0099DB] text-[#F3F4F6]'
              : 'bg-[#4B4F56] hover:bg-[#575C64] border-[#383C42] text-[#F3F4F6]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    </footer>
  );
});
