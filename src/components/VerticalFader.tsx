import React, { useRef } from 'react';

interface VerticalFaderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  capStyle?: 'light' | 'dark' | 'tempo';
  showDualFillLine?: boolean;
  bottomCaption?: string;
  onChange: (newValue: number) => void;
}

export const VerticalFader: React.FC<VerticalFaderProps> = React.memo(({
  label,
  value,
  min,
  max,
  defaultValue,
  step = 1,
  capStyle = 'light',
  showDualFillLine = false,
  bottomCaption,
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const normalized = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const topPercent = (1 - normalized) * 100;

  const updateFromClientY = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const padPx = 12;
    const usableHeight = Math.max(1, rect.height - padPx * 2);
    const relY = Math.min(
      usableHeight,
      Math.max(0, clientY - (rect.top + padPx))
    );
    const ratio = 1 - relY / usableHeight;
    const raw = min + ratio * (max - min);
    const stepped =
      step < 1
        ? Number((Math.round(raw / step) * step).toFixed(2))
        : Math.round(raw);
    onChange(Math.min(max, Math.max(min, stepped)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture error
    }
    activePointerIdRef.current = e.pointerId;
    updateFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    updateFromClientY(e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release error
    }
  };

  return (
    <div className="flex flex-col items-center h-full select-none touch-none">
      <div
        ref={trackRef}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={() => onChange(defaultValue)}
        title="Toque y deslice verticalmente · Doble toque para restablecer"
        className="relative flex-1 w-14 flex justify-center cursor-ns-resize py-3 touch-none"
      >
        {/* Vertical Recessed Track Slot */}
        <div className="relative w-2.5 h-full rounded-full bg-[#0C0E11] border border-[#1E2128] overflow-hidden flex justify-center pointer-events-none">
          {showDualFillLine && normalized > 0.02 && (
            <div
              style={{ height: `${normalized * 100}%` }}
              className="absolute bottom-0 inset-x-0.5 flex justify-between px-[1px]"
            >
              <span className="w-[2px] h-full bg-[#0099DB]" />
              <span className="w-[2px] h-full bg-[#0099DB]" />
            </div>
          )}
        </div>

        {/* Center zero-detent tick for Tempo fader */}
        {capStyle === 'tempo' && (
          <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#0099DB] pointer-events-none" />
        )}

        {/* Rectangular Hardware Fader Cap with Embedded Label */}
        <div
          style={{
            top: `calc(12px + (100% - 24px) * ${topPercent / 100})`,
          }}
          className={`absolute -translate-y-1/2 flex items-center justify-center rounded-[4px] shadow-md pointer-events-none ${
            capStyle === 'tempo'
              ? 'w-12 h-6 bg-[#DCDEE2] text-[#4A4F57] text-[10px] font-mono font-semibold border border-[#B8BCC4]'
              : capStyle === 'dark'
              ? 'w-14 h-8 bg-[#595E67] text-[#F3F4F6] text-xs font-medium tracking-wide border border-[#6C727C]'
              : 'w-14 h-8 bg-[#DCDEE2] text-[#555A62] text-xs font-medium tracking-wide border border-[#C4C8D0]'
          }`}
        >
          {label}
        </div>
      </div>

      {bottomCaption && (
        <span className="mt-1 text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase pointer-events-none">
          {bottomCaption}
        </span>
      )}
    </div>
  );
});
