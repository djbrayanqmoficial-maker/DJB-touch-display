import React, { useRef } from 'react';

interface TouchKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  unit?: string;
  accentCyan?: boolean;
  compact?: boolean;
  onChange: (newValue: number) => void;
}

export const TouchKnob: React.FC<TouchKnobProps> = React.memo(({
  label,
  value,
  min,
  max,
  defaultValue = 0,
  unit = '',
  compact = false,
  onChange,
}) => {
  const activePointerIdRef = useRef<number | null>(null);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);

  const normalized = Math.min(1, Math.max(0, (value - min) / (max - min))); // 0 to 1
  const angleDeg = -135 + normalized * 270; // -135deg to +135deg

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture error
    }
    activePointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startValRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const deltaY = startYRef.current - e.clientY;
    const deltaX = e.clientX - startXRef.current;
    // Combine vertical + horizontal finger drag so sliding in either axis smoothly turns the knob
    const combinedDelta = deltaY + deltaX * 0.75;
    const range = max - min;
    const sensitivity = 105;
    const nextVal = Math.min(
      max,
      Math.max(min, startValRef.current + (combinedDelta / sensitivity) * range)
    );
    onChange(Math.round(nextVal));
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
    <div
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={() => onChange(defaultValue)}
      title="Toque y arrastre (vertical u horizontalmente) · Doble toque para centrar"
      className="flex items-center gap-2.5 select-none touch-none cursor-ns-resize py-1 px-1.5 rounded hover:bg-white/[0.02]"
    >
      <div
        className={`relative ${
          compact ? 'w-10 h-10' : 'w-11 h-11'
        } rounded-full bg-[#262930] border-[2.5px] border-[#3E434D] flex items-center justify-center pointer-events-none`}
      >
        {/* Rotary indicator line */}
        <div
          style={{ transform: `rotate(${angleDeg}deg)` }}
          className="w-full h-full flex justify-center items-start pt-1"
        >
          <span className="w-[2px] h-3 bg-[#0099DB]" />
        </div>
      </div>

      <div className="flex flex-col pointer-events-none">
        <span className="text-[11px] font-medium text-[#8C939E] uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-8 h-[2px] bg-[#3E434D] relative">
            <span
              style={{ left: `${normalized * 100}%` }}
              className="absolute -top-[2px] -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0099DB]"
            />
          </div>
          <span className="text-[10px] font-mono tabular-nums text-[#9CA3AF]">
            {value}
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
});
