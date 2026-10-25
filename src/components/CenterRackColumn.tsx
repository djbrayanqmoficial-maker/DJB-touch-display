import React, { useEffect, useRef } from 'react';
import { MainSection } from '../core/dj/DjEngine';
import { MasterVuMeterState } from '../core/mixer/MixerEngine';
import { realAudioEngine } from '../core/audio/RealAudioEngine';

interface CenterRackColumnProps {
  activeSection: MainSection;
  onSelectSection: (section: MainSection) => void;
  levelA?: number; // 0 - 100
  levelB?: number; // 0 - 100
  masterVu?: MasterVuMeterState;
  musicalKeyLabel?: string;
}

const getPeakLineColor = (peak: number) => {
  if (peak >= 88) return '#EF4444';
  if (peak >= 72) return '#F59E0B';
  return '#E0F2FE';
};

/**
 * High-Performance Decoupled Stereo Master VU Meter.
 * Direct DOM element updating via requestAnimationFrame bypasses React VDOM reconciliation
 * entirely, eliminating main-thread stalls, micro-freezes and audio underruns.
 */
const DecoupledMasterVuMeter: React.FC<{
  fallbackLevelA?: number;
  fallbackLevelB?: number;
  fallbackMasterVu?: MasterVuMeterState;
}> = React.memo(({ fallbackLevelA = 0, fallbackLevelB = 0, fallbackMasterVu }) => {
  const leftFillRef = useRef<HTMLDivElement | null>(null);
  const rightFillRef = useRef<HTMLDivElement | null>(null);
  const peakLeftRef = useRef<HTMLDivElement | null>(null);
  const peakRightRef = useRef<HTMLDivElement | null>(null);
  const clipLeftRef = useRef<HTMLDivElement | null>(null);
  const clipRightRef = useRef<HTMLDivElement | null>(null);
  const labelLRef = useRef<HTMLSpanElement | null>(null);
  const labelRRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    let lastCommitTime = performance.now();

    const tick = (now: number) => {
      // 50 FPS cap for meter updates prevents excessive layout recalcs
      if (now - lastCommitTime < 20) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      lastCommitTime = now;

      const engA = realAudioEngine.deckA;
      const engB = realAudioEngine.deckB;
      const mixer = realAudioEngine.mixerEngine;

      const levelA = engA ? engA.getMeterLevel() : fallbackLevelA;
      const levelB = engB ? engB.getMeterLevel() : fallbackLevelB;
      const masterState = mixer
        ? mixer.getMasterVuState()
        : fallbackMasterVu;

      const leftVal = Math.min(
        100,
        Math.max(0, masterState ? masterState.left : Math.max(levelA, levelB))
      );
      const rightVal = Math.min(
        100,
        Math.max(0, masterState ? masterState.right : Math.max(levelA, levelB))
      );
      const peakLeftVal = Math.min(
        100,
        Math.max(leftVal, masterState ? masterState.peakLeft : leftVal)
      );
      const peakRightVal = Math.min(
        100,
        Math.max(rightVal, masterState ? masterState.peakRight : rightVal)
      );

      const isClipL = peakLeftVal >= 90 || leftVal >= 88;
      const isClipR = peakRightVal >= 90 || rightVal >= 88;

      if (leftFillRef.current) {
        leftFillRef.current.style.height = `${leftVal}%`;
      }
      if (rightFillRef.current) {
        rightFillRef.current.style.height = `${rightVal}%`;
      }

      if (peakLeftRef.current) {
        if (peakLeftVal > 2) {
          peakLeftRef.current.style.display = 'block';
          peakLeftRef.current.style.bottom = `calc(${Math.min(98.5, peakLeftVal)}% - 1px)`;
          peakLeftRef.current.style.backgroundColor = getPeakLineColor(peakLeftVal);
        } else {
          peakLeftRef.current.style.display = 'none';
        }
      }

      if (peakRightRef.current) {
        if (peakRightVal > 2) {
          peakRightRef.current.style.display = 'block';
          peakRightRef.current.style.bottom = `calc(${Math.min(98.5, peakRightVal)}% - 1px)`;
          peakRightRef.current.style.backgroundColor = getPeakLineColor(peakRightVal);
        } else {
          peakRightRef.current.style.display = 'none';
        }
      }

      if (clipLeftRef.current) {
        clipLeftRef.current.className = `h-[4px] flex-1 rounded-[1px] transition-colors duration-75 ${
          isClipL ? 'bg-[#FF1E1E]' : 'bg-[#221316]'
        }`;
      }
      if (clipRightRef.current) {
        clipRightRef.current.className = `h-[4px] flex-1 rounded-[1px] transition-colors duration-75 ${
          isClipR ? 'bg-[#FF1E1E]' : 'bg-[#221316]'
        }`;
      }

      if (labelLRef.current) {
        labelLRef.current.className = isClipL
          ? 'text-[#EF4444]'
          : leftVal > 2
          ? 'text-[#38BDF8]'
          : 'text-[#6B7280]';
      }
      if (labelRRef.current) {
        labelRRef.current.className = isClipR
          ? 'text-[#EF4444]'
          : rightVal > 2
          ? 'text-[#38BDF8]'
          : 'text-[#6B7280]';
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [fallbackLevelA, fallbackLevelB, fallbackMasterVu]);

  return (
    <div
      className="flex-1 w-full my-1.5 flex items-center justify-center min-h-[135px]"
      title="MASTER Stereo VU Meter (L: Master Left · R: Master Right · Peak & Clip Detection)"
    >
      <div className="w-[46px] h-full min-h-[135px] bg-[#060709] border border-[#2F3542] rounded-sm px-[5px] py-[4px] flex flex-col justify-between">
        {/* Top Overload / Clipping Indicators (L & R) */}
        <div className="w-full flex items-center justify-between gap-1 pb-[3px] border-b border-[#1A1E26] shrink-0">
          <div
            ref={clipLeftRef}
            className="h-[4px] flex-1 rounded-[1px] transition-colors duration-75 bg-[#221316]"
          />
          <span className="text-[6px] font-mono leading-none text-[#6B7280] select-none">
            PK
          </span>
          <div
            ref={clipRightRef}
            className="h-[4px] flex-1 rounded-[1px] transition-colors duration-75 bg-[#221316]"
          />
        </div>

        {/* Main Tall Stereo Bar Area: MASTER LEFT (L) | Scale Ticks | MASTER RIGHT (R) */}
        <div className="flex-1 w-full flex items-stretch justify-between gap-[3px] my-[3px] min-h-[100px]">
          {/* MASTER LEFT (L) Vertical Meter Column */}
          <div className="relative flex-1 h-full bg-[#0E1116] rounded-[1px] overflow-hidden border border-[#1B202A]">
            {/* Unlit background segment grid */}
            <div
              className="absolute inset-0 opacity-35 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to top, #181C24 0px, #181C24 3px, #090B0E 3px, #090B0E 4.5px)',
              }}
            />

            {/* Active Real-Time Level Fill */}
            <div
              ref={leftFillRef}
              className="absolute inset-x-0 bottom-0 overflow-hidden"
              style={{ height: '0%' }}
            >
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  background:
                    'linear-gradient(to top, #059669 0%, #0099DB 32%, #38BDF8 64%, #F59E0B 80%, #EF4444 92%, #FF1E1E 100%)',
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to top, transparent 0px, transparent 3px, rgba(6,7,9,0.72) 3px, rgba(6,7,9,0.72) 4.5px)',
                }}
              />
            </div>

            {/* Floating Peak-Hold Indicator Line (MASTER LEFT) */}
            <div
              ref={peakLeftRef}
              className="absolute inset-x-0 h-[2.5px] pointer-events-none hidden"
              style={{ bottom: '0px' }}
            />
          </div>

          {/* Center dB Calibration Tick Marks (0, -3, -6, -12, -24 dB) */}
          <div className="w-[4px] h-full flex flex-col justify-between py-[2px] items-center pointer-events-none">
            <div className="w-[3px] h-[1.5px] bg-[#EF4444]" />
            <div className="w-[2.5px] h-[1px] bg-[#F59E0B]" />
            <div className="w-[3px] h-[1px] bg-[#38BDF8]" />
            <div className="w-[2.5px] h-[1px] bg-[#4B5563]" />
            <div className="w-[2.5px] h-[1px] bg-[#4B5563]" />
            <div className="w-[3px] h-[1px] bg-[#374151]" />
          </div>

          {/* MASTER RIGHT (R) Vertical Meter Column */}
          <div className="relative flex-1 h-full bg-[#0E1116] rounded-[1px] overflow-hidden border border-[#1B202A]">
            {/* Unlit background segment grid */}
            <div
              className="absolute inset-0 opacity-35 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to top, #181C24 0px, #181C24 3px, #090B0E 3px, #090B0E 4.5px)',
              }}
            />

            {/* Active Real-Time Level Fill */}
            <div
              ref={rightFillRef}
              className="absolute inset-x-0 bottom-0 overflow-hidden"
              style={{ height: '0%' }}
            >
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  background:
                    'linear-gradient(to top, #059669 0%, #0099DB 32%, #38BDF8 64%, #F59E0B 80%, #EF4444 92%, #FF1E1E 100%)',
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to top, transparent 0px, transparent 3px, rgba(6,7,9,0.72) 3px, rgba(6,7,9,0.72) 4.5px)',
                }}
              />
            </div>

            {/* Floating Peak-Hold Indicator Line (MASTER RIGHT) */}
            <div
              ref={peakRightRef}
              className="absolute inset-x-0 h-[2.5px] pointer-events-none hidden"
              style={{ bottom: '0px' }}
            />
          </div>
        </div>

        {/* Bottom L / R Stereo Channel Labels */}
        <div className="w-full flex items-center justify-between px-[1px] pt-[2px] border-t border-[#1A1E26] text-[8px] font-mono font-bold leading-none shrink-0">
          <span ref={labelLRef} className="text-[#6B7280]">
            L
          </span>
          <span className="text-[6px] text-[#4B5563]">MST</span>
          <span ref={labelRRef} className="text-[#6B7280]">
            R
          </span>
        </div>
      </div>
    </div>
  );
});

export const CenterRackColumn: React.FC<CenterRackColumnProps> = React.memo(({
  activeSection,
  onSelectSection,
  levelA,
  levelB,
  masterVu,
  musicalKeyLabel,
}) => {
  const toggleOrSelect = (target: MainSection) => {
    if (activeSection === target) {
      onSelectSection(MainSection.DECKS);
    } else {
      onSelectSection(target);
    }
  };

  return (
    <div className="w-[154px] h-full self-stretch shrink-0 flex flex-col items-center justify-between py-1 select-none touch-none">
      {/* Top 3 Circular Mode Buttons: Loops/HotCues | Mixer/EQ | FX */}
      <div className="flex items-center gap-2 touch-none shrink-0">
        {/* Loops / Hot Cues Button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            toggleOrSelect(MainSection.LOOPS_HOTCUES);
          }}
          title="Loops & Hot Cues"
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition touch-none ${
            activeSection === MainSection.LOOPS_HOTCUES
              ? 'bg-[#3A3E46] border-white text-white'
              : 'bg-[#25282F] border-[#525761] text-[#E5E7EB] hover:border-white'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-none stroke-current stroke-2"
          >
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11v-1a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v1a4 4 0 01-4 4H3" />
          </svg>
        </button>

        {/* Mixer / EQ Faders Button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            toggleOrSelect(MainSection.MIXER_EQ);
          }}
          title="Mixer / EQ"
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition touch-none ${
            activeSection === MainSection.MIXER_EQ
              ? 'bg-[#3A3E46] border-white text-white'
              : 'bg-[#25282F] border-[#525761] text-[#E5E7EB] hover:border-white'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-none stroke-current stroke-2"
          >
            <line x1="8" y1="4" x2="8" y2="20" />
            <line x1="16" y1="4" x2="16" y2="20" />
            <line x1="5" y1="9" x2="11" y2="9" />
            <line x1="13" y1="15" x2="19" y2="15" />
          </svg>
        </button>

        {/* FX Button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            toggleOrSelect(MainSection.FX);
          }}
          title="FX Touch Pads"
          className={`w-11 h-11 rounded-full flex items-center justify-center border font-bold italic text-sm transition touch-none ${
            activeSection === MainSection.FX
              ? 'bg-[#3A3E46] border-white text-white'
              : 'bg-[#25282F] border-[#525761] text-[#E5E7EB] hover:border-white'
          }`}
        >
          FX
        </button>
      </div>

      {/* Tall Professional Stereo MASTER VU Meter (Decoupled, Zero-Re-Render) */}
      <DecoupledMasterVuMeter
        fallbackLevelA={levelA}
        fallbackLevelB={levelB}
        fallbackMasterVu={masterVu}
      />

      {/* Bottom Circular PERFORMANCE PADS Button + Harmonic Key */}
      <div className="relative flex items-center justify-center w-full touch-none shrink-0">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            toggleOrSelect(MainSection.PERFORMANCE);
          }}
          title="PERFORMANCE PADS (Hot Cues · Beat Jump · Stems · Sampler)"
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition touch-none ${
            activeSection === MainSection.PERFORMANCE
              ? 'bg-[#3A3E46] border-white text-white'
              : 'bg-[#25282F] border-[#525761] text-[#E5E7EB] hover:border-white'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <rect x="4" y="4" width="4" height="4" />
            <rect x="10" y="4" width="4" height="4" />
            <rect x="16" y="4" width="4" height="4" />
            <rect x="4" y="10" width="4" height="4" />
            <rect x="10" y="10" width="4" height="4" />
            <rect x="16" y="10" width="4" height="4" />
            <rect x="4" y="16" width="4" height="4" />
            <rect x="10" y="16" width="4" height="4" />
            <rect x="16" y="16" width="4" height="4" />
          </svg>
        </button>

        {musicalKeyLabel && (
          <span className="absolute right-1 text-xs font-mono text-[#0099DB]">
            ♪{musicalKeyLabel}
          </span>
        )}
      </div>
    </div>
  );
});
