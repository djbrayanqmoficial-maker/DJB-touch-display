import React, { useEffect, useRef } from 'react';

interface TurntablePlatterProps {
  deckId: 'A' | 'B';
  angleDeg: number;
  isPlaying: boolean;
  showPitchBendArrows?: boolean;
  onNudge: (deltaDeg: number) => void;
  onReleasePlatter?: () => void;
  onPitchBendStep?: (deltaDeg: number) => void;
}

export const TurntablePlatter: React.FC<TurntablePlatterProps> = React.memo(({
  angleDeg,
  isPlaying,
  showPitchBendArrows = false,
  onNudge,
  onReleasePlatter,
  onPitchBendStep,
}) => {
  const activePointerIdRef = useRef<number | null>(null);
  const lastYRef = useRef<number | null>(null);
  const lastXRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const currentAngleRef = useRef(angleDeg);

  useEffect(() => {
    currentAngleRef.current = angleDeg;
    if (barRef.current && (activePointerIdRef.current !== null || !isPlaying)) {
      barRef.current.style.transform = `rotate(${angleDeg}deg)`;
    }
  }, [angleDeg, isPlaying]);

  // Smooth 60 FPS hardware-accelerated platter rotation without React render cascades
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      if (isPlaying && activePointerIdRef.current === null) {
        currentAngleRef.current = (currentAngleRef.current + 200 * dt) % 360;
        if (barRef.current) {
          barRef.current.style.transform = `rotate(${currentAngleRef.current}deg)`;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(tick);
    } else if (barRef.current) {
      barRef.current.style.transform = `rotate(${currentAngleRef.current}deg)`;
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture error
    }
    activePointerIdRef.current = e.pointerId;
    lastYRef.current = e.clientY;
    lastXRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      activePointerIdRef.current !== e.pointerId ||
      lastYRef.current === null ||
      lastXRef.current === null
    ) {
      return;
    }
    e.preventDefault();
    const deltaY = lastYRef.current - e.clientY;
    const deltaX = e.clientX - lastXRef.current;
    lastYRef.current = e.clientY;
    lastXRef.current = e.clientX;
    const delta = deltaY + deltaX * 0.55;
    if (Math.abs(delta) > 0.2) {
      currentAngleRef.current = (currentAngleRef.current + delta * 1.45) % 360;
      if (barRef.current) {
        barRef.current.style.transform = `rotate(${currentAngleRef.current}deg)`;
      }
      onNudge(delta * 1.45);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    lastYRef.current = null;
    lastXRef.current = null;
    onReleasePlatter?.();
  };

  return (
    <div className="flex-1 h-full flex items-center justify-center p-1 select-none touch-none">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        title="Arrastre el plato para scratch / ajuste de fase"
        style={{
          touchAction: 'none',
          backgroundImage:
            'repeating-radial-gradient(circle at center, #0099DB 0px, #0099DB 3px, #007DB5 3.5px, #0099DB 5px)',
        }}
        className="relative aspect-square h-[92%] max-h-[310px] rounded-full border-[4px] border-[#07080A] shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden touch-none"
      >
        {/* Rotating Radial Position Bar */}
        <div
          ref={barRef}
          style={{ transform: `rotate(${angleDeg}deg)` }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-1/2 h-4 bg-[#1B313E] ml-[50%]" />
        </div>

        {/* Center Dark Hub / Vinyl Label */}
        <div className="relative z-10 w-[36%] h-[36%] rounded-full bg-[#1B313E] border-[3px] border-[#152631] flex items-center justify-center gap-3">
          {showPitchBendArrows && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onPitchBendStep) onPitchBendStep(-6);
                else onNudge(-6);
              }}
              className="text-[#F3F4F6]/80 hover:text-white p-1"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M15 6l-6 6 6 6z" />
              </svg>
            </button>
          )}

          {/* Center Spindle Pin */}
          <span className="w-3.5 h-3.5 rounded-full bg-[#6C737F]" />

          {showPitchBendArrows && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onPitchBendStep) onPitchBendStep(6);
                else onNudge(6);
              }}
              className="text-[#F3F4F6]/80 hover:text-white p-1"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M9 6l6 6-6 6z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
