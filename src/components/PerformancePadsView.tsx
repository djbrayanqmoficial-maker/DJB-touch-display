import React, { useState } from 'react';
import { DeckState, formatTimeCode, MainSection } from '../core/dj/DjEngine';
import { TrackStemPreparationStatus } from '../core/database/TrackDatabase';
import {
  BEAT_JUMP_PRESETS,
  BeatJumpPresetId,
  buildVdjPadOverrideKey,
  DeckStemPadState,
  PERFORMANCE_PAD_PAGES,
  PerformancePadController,
  PerformancePadPageId,
  SamplerPadSlotState,
  VirtualDjPadOverridesMap,
} from '../core/performance/PerformancePadsEngine';

interface PerformancePadsViewProps {
  deckA: DeckState;
  deckB: DeckState;
  pageA: PerformancePadPageId;
  pageB: PerformancePadPageId;
  onChangePageA: (page: PerformancePadPageId) => void;
  onChangePageB: (page: PerformancePadPageId) => void;
  clearCueModeA: boolean;
  clearCueModeB: boolean;
  onToggleClearCueA: () => void;
  onToggleClearCueB: () => void;
  beatJumpPresetA: BeatJumpPresetId;
  beatJumpPresetB: BeatJumpPresetId;
  onChangeBeatJumpPresetA: (preset: BeatJumpPresetId) => void;
  onChangeBeatJumpPresetB: (preset: BeatJumpPresetId) => void;
  stemsA: DeckStemPadState;
  stemsB: DeckStemPadState;
  samplerPadsA: SamplerPadSlotState[];
  samplerPadsB: SamplerPadSlotState[];
  onTriggerPad: (deck: 'A' | 'B', padIndex: number) => void;
  onStopSamplerPad: (deck: 'A' | 'B', padIndex: number) => void;
  onToggleSamplerPadLoop: (deck: 'A' | 'B', padIndex: number) => void;
  onChangeSamplerPadVolume: (
    deck: 'A' | 'B',
    padIndex: number,
    volume: number
  ) => void;
  samplerGain: number;
  onChangeSamplerGain: (gain: number) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  samplerEditMode: boolean;
  onToggleSamplerEditMode: () => void;
  onSelectSection: (section: MainSection) => void;
  vdjPadOverrides?: VirtualDjPadOverridesMap;
  stemStatusA?: { status: TrackStemPreparationStatus; progress: number };
  stemStatusB?: { status: TrackStemPreparationStatus; progress: number };
  stemNoticeA?: string | null;
  stemNoticeB?: string | null;
  onPrepareDeckStems?: (deck: 'A' | 'B') => void;
}

export const PerformancePadsView: React.FC<PerformancePadsViewProps> = React.memo(({
  deckA,
  deckB,
  pageA,
  pageB,
  onChangePageA,
  onChangePageB,
  clearCueModeA,
  clearCueModeB,
  onToggleClearCueA,
  onToggleClearCueB,
  beatJumpPresetA,
  beatJumpPresetB,
  onChangeBeatJumpPresetA,
  onChangeBeatJumpPresetB,
  stemsA,
  stemsB,
  samplerPadsA,
  samplerPadsB,
  onTriggerPad,
  onStopSamplerPad,
  onToggleSamplerPadLoop,
  onChangeSamplerPadVolume,
  samplerGain,
  onChangeSamplerGain,
  isRecording,
  onToggleRecording,
  samplerEditMode,
  onToggleSamplerEditMode,
  onSelectSection,
  vdjPadOverrides = {},
  stemStatusA = { status: 'IDLE', progress: 0 },
  stemStatusB = { status: 'IDLE', progress: 0 },
  stemNoticeA = null,
  stemNoticeB = null,
  onPrepareDeckStems,
}) => {
  const [pressedPadsA, setPressedPadsA] = useState<Record<number, boolean>>({});
  const [pressedPadsB, setPressedPadsB] = useState<Record<number, boolean>>({});
  const samplerSliderRef = React.useRef<HTMLDivElement | null>(null);
  const samplerPointerIdRef = React.useRef<number | null>(null);

  const setPadPressedState = (
    deckId: 'A' | 'B',
    padIndex: number,
    pressed: boolean
  ) => {
    const setter = deckId === 'A' ? setPressedPadsA : setPressedPadsB;
    setter((prev) => {
      if (Boolean(prev[padIndex]) === pressed) return prev;
      return { ...prev, [padIndex]: pressed };
    });
  };

  const updateSamplerGainFromClientY = (clientY: number) => {
    const el = samplerSliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const pct = Math.round((1 - relY / Math.max(1, rect.height)) * 100);
    onChangeSamplerGain(pct);
  };

  const renderDeckPadsBank = (deckId: 'A' | 'B') => {
    const deck = deckId === 'A' ? deckA : deckB;
    const activePage = deckId === 'A' ? pageA : pageB;
    const onChangePage = deckId === 'A' ? onChangePageA : onChangePageB;
    const clearCueMode = deckId === 'A' ? clearCueModeA : clearCueModeB;
    const onToggleClearCue =
      deckId === 'A' ? onToggleClearCueA : onToggleClearCueB;
    const beatJumpPreset =
      deckId === 'A' ? beatJumpPresetA : beatJumpPresetB;
    const onChangeBeatJumpPreset =
      deckId === 'A' ? onChangeBeatJumpPresetA : onChangeBeatJumpPresetB;
    const stems = deckId === 'A' ? stemsA : stemsB;
    const samplerPads = deckId === 'A' ? samplerPadsA : samplerPadsB;
    const pressedPadsMap = deckId === 'A' ? pressedPadsA : pressedPadsB;
    const stemStatus = deckId === 'A' ? stemStatusA : stemStatusB;
    const stemNotice = deckId === 'A' ? stemNoticeA : stemNoticeB;

    const beatJumpSteps = BEAT_JUMP_PRESETS[beatJumpPreset].steps;

    const stemPadDefinitions =
      PerformancePadController.buildStemPadDescriptors(stems);

    return (
      <div
        className={`flex-1 h-full flex flex-col justify-between ${
          deckId === 'A' ? 'pr-2' : 'pl-2'
        } gap-1.5`}
      >
        {/* Top Mode Navigation Bar: 4 Pages in Exact Order (1. HOT CUES | 2. BEAT JUMP | 3. STEMS | 4. SAMPLER) */}
        <div className="h-10 rounded border border-[#454A54] bg-[#25282F] flex items-center justify-between px-1.5 gap-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {PERFORMANCE_PAD_PAGES.map((pg) => {
              const isSelected = activePage === pg.id;
              return (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => onChangePage(pg.id)}
                  title={`Página ${pg.pageNumber}: ${pg.shortLabel} (${pg.vdjPageId})`}
                  className={`flex-1 h-7 rounded text-[10px] font-bold tracking-tight px-1.5 transition truncate ${
                    isSelected
                      ? 'bg-[#0099DB] text-[#0B0C0E] shadow-xs'
                      : 'bg-[#1C1F25] text-[#D1D5DB] hover:bg-[#313640] hover:text-white'
                  }`}
                >
                  {pg.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Contextual Sub-Action for Current Page */}
          {activePage === 'HOT_CUES' && (
            <button
              type="button"
              onClick={onToggleClearCue}
              title="Modo borrar Hot Cue (X)"
              className={`h-7 px-2 rounded text-[10px] font-mono font-bold border transition shrink-0 ${
                clearCueMode
                  ? 'bg-[#991B1B] border-white text-white'
                  : 'bg-[#1C1F25] border-[#454A54] text-[#9CA3AF] hover:text-white'
              }`}
            >
              {clearCueMode ? 'DEL CUE' : 'X'}
            </button>
          )}

          {activePage === 'BEAT_JUMP' && (
            <select
              value={beatJumpPreset}
              onChange={(e) =>
                onChangeBeatJumpPreset(e.target.value as BeatJumpPresetId)
              }
              title="Rango de Beat Jump (sincronizado al Beat Grid)"
              className="h-7 rounded bg-[#1C1F25] border border-[#454A54] text-[10px] font-mono text-[#0099DB] px-1 focus:outline-none cursor-pointer shrink-0"
            >
              {(
                Object.keys(BEAT_JUMP_PRESETS) as Array<BeatJumpPresetId>
              ).map((presetKey) => (
                <option
                  key={presetKey}
                  value={presetKey}
                  className="bg-[#1C1F25] text-white"
                >
                  {BEAT_JUMP_PRESETS[presetKey].label}
                </option>
              ))}
            </select>
          )}

          {activePage === 'STEMS' && (
            <div className="flex items-center gap-1 shrink-0">
              {stemStatus.status === 'READY' ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#112A24] border border-[#10B981] text-[#34D399] font-bold">
                  STEMS LISTOS
                </span>
              ) : stemStatus.status === 'PREPARING' ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#2B2412] border border-[#F59E0B] text-[#FBBF24] font-bold">
                  PREPARANDO {stemStatus.progress}%
                </span>
              ) : stemStatus.status === 'QUEUED' ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1E2530] border border-[#0099DB] text-[#0099DB]">
                  EN COLA
                </span>
              ) : stemStatus.status === 'PAUSED' ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#2B2412] border border-[#F59E0B] text-[#FBBF24]">
                  PAUSADO {stemStatus.progress}%
                </span>
              ) : (
                <>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1C1F25] border border-[#383D47] text-[#9CA3AF]">
                    NO PREPARADO
                  </span>
                  {onPrepareDeckStems && deck.trackId && (
                    <button
                      type="button"
                      onClick={() => onPrepareDeckStems(deckId)}
                      title="Preparar separación de pistas en segundo plano para esta canción"
                      className="h-6 px-1.5 rounded bg-[#0099DB] hover:bg-[#00A8EF] text-[#0B0C0E] text-[9px] font-mono font-bold transition"
                    >
                      PREPARAR
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {activePage === 'SAMPLER' && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1C1F25] border border-[#383D47] text-[#9CA3AF] shrink-0">
              DECK {deckId}
            </span>
          )}
        </div>

        {activePage === 'STEMS' && stemNotice && (
          <div className="px-2 py-1 rounded bg-[#2B2412] border border-[#F59E0B]/60 text-[10px] font-mono text-[#FDE68A] flex items-center justify-between gap-2">
            <span className="truncate">{stemNotice}</span>
            {onPrepareDeckStems &&
              deck.trackId &&
              stemStatus.status !== 'PREPARING' &&
              stemStatus.status !== 'QUEUED' && (
                <button
                  type="button"
                  onClick={() => onPrepareDeckStems(deckId)}
                  className="px-2 py-0.5 rounded bg-[#F59E0B] text-[#0B0C0E] font-bold shrink-0"
                >
                  Preparar ahora
                </button>
              )}
          </div>
        )}

        {/* 8 Performance Pads Grid (4 Columns x 2 Rows) */}
        <div className="flex-1 grid grid-cols-4 grid-rows-2 gap-2">
          {/* PAGE 1: HOT CUES (8 Pads: Cue 1 .. Cue 8) */}
          {activePage === 'HOT_CUES' &&
            Array.from({ length: 8 }, (_, idx) => {
              const padIndex = idx + 1;
              const cueSlot = deck.hotCues[idx] || {
                index: padIndex,
                label: `CUE ${padIndex}`,
                positionSec: null,
                active: false,
              };
              const vdjOverride =
                vdjPadOverrides[
                  buildVdjPadOverrideKey(deckId, 'HOT_CUES', padIndex)
                ];
              const isCueActive =
                vdjOverride?.active !== undefined
                  ? vdjOverride.active
                  : Boolean(cueSlot.active && cueSlot.positionSec !== null);
              const isPressed = Boolean(pressedPadsMap[padIndex]);
              const displayTitle =
                vdjOverride?.label ||
                (cueSlot.active &&
                cueSlot.label &&
                cueSlot.label !== 'EMPTY'
                  ? cueSlot.label
                  : `Cue ${padIndex}`);
              const displayTime =
                vdjOverride?.sublabel ||
                (isCueActive && cueSlot.positionSec !== null
                  ? formatTimeCode(cueSlot.positionSec).slice(0, 6)
                  : ' VACÍO ');

              return (
                <button
                  key={`hc-${deckId}-${padIndex}`}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setPadPressedState(deckId, padIndex, true);
                    onTriggerPad(deckId, padIndex);
                  }}
                  onPointerUp={() => setPadPressedState(deckId, padIndex, false)}
                  onPointerCancel={() =>
                    setPadPressedState(deckId, padIndex, false)
                  }
                  onPointerLeave={() =>
                    setPadPressedState(deckId, padIndex, false)
                  }
                  className={`rounded-md border flex flex-col items-center justify-center relative px-1.5 transition touch-none select-none ${
                    isPressed
                      ? 'bg-[#F3F4F6] text-[#0B0C0E] border-white scale-[0.97]'
                      : clearCueMode && isCueActive
                      ? 'bg-[#451A1A] border-[#EF4444] text-[#FCA5A5]'
                      : isCueActive
                      ? 'bg-[#0099DB] hover:bg-[#00A8EF] text-[#0B0C0E] border-white shadow-sm'
                      : 'bg-[#363A42] hover:bg-[#434852] text-[#E5E7EB] border-[#4E545F]'
                  }`}
                >
                  <span className="absolute top-1 left-1.5 text-[9px] font-mono opacity-80">
                    #{padIndex}
                  </span>
                  <span className="text-xs font-bold tracking-tight truncate max-w-full">
                    {displayTitle}
                  </span>
                  <span
                    className={`text-[10px] font-mono mt-0.5 ${
                      isPressed
                        ? 'text-[#0B0C0E]'
                        : isCueActive
                        ? 'text-[#0B0C0E]/90 font-semibold'
                        : 'text-[#9CA3AF]'
                    }`}
                  >
                    {displayTime}
                  </span>
                </button>
              );
            })}

          {/* PAGE 2: BEAT JUMP (8 Pads locked to Deck Beat Grid) */}
          {activePage === 'BEAT_JUMP' &&
            beatJumpSteps.map((stepBeats, idx) => {
              const padIndex = idx + 1;
              const vdjOverride =
                vdjPadOverrides[
                  buildVdjPadOverrideKey(deckId, 'BEAT_JUMP', padIndex)
                ];
              const isPressed = Boolean(pressedPadsMap[padIndex]);
              const isForward = stepBeats > 0;
              const formattedStep =
                stepBeats === 0.5
                  ? '+1/2'
                  : stepBeats === -0.5
                  ? '-1/2'
                  : stepBeats > 0
                  ? `+${stepBeats}`
                  : `${stepBeats}`;

              return (
                <button
                  key={`bj-${deckId}-${padIndex}`}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setPadPressedState(deckId, padIndex, true);
                    onTriggerPad(deckId, padIndex);
                  }}
                  onPointerUp={() => setPadPressedState(deckId, padIndex, false)}
                  onPointerCancel={() =>
                    setPadPressedState(deckId, padIndex, false)
                  }
                  onPointerLeave={() =>
                    setPadPressedState(deckId, padIndex, false)
                  }
                  className={`rounded-md border flex flex-col items-center justify-center relative px-1.5 transition touch-none select-none ${
                    isPressed
                      ? 'bg-[#F3F4F6] text-[#0B0C0E] border-white scale-[0.97]'
                      : isForward
                      ? 'bg-[#1D3547] hover:bg-[#25445B] border-[#0099DB] text-white'
                      : 'bg-[#2A2E37] hover:bg-[#353A45] border-[#58606E] text-[#F3F4F6]'
                  }`}
                >
                  <span className="text-[9px] font-mono text-[#9CA3AF]">
                    {isForward ? 'JUMP FWD ▸' : '◂ JUMP BACK'}
                  </span>
                  <span className="text-base font-bold font-mono text-[#0099DB] leading-tight">
                    {vdjOverride?.label || formattedStep}
                  </span>
                  <span className="text-[9px] font-mono text-[#D1D5DB]">
                    {vdjOverride?.sublabel || 'BEATS'}
                  </span>
                </button>
              );
            })}

          {/* PAGE 3: STEMS (Pads 1–4: Real Stems VOCAL, MELODY, BASS, DRUMS · Pads 5–8: Serato DJ Pro Red Stem FX) */}
          {activePage === 'STEMS' &&
            stemPadDefinitions.map((stemPad) => {
              const vdjOverride =
                vdjPadOverrides[
                  buildVdjPadOverrideKey(deckId, 'STEMS', stemPad.padIndex)
                ];
              const isPressed = Boolean(pressedPadsMap[stemPad.padIndex]);
              const isActive =
                vdjOverride?.active !== undefined
                  ? vdjOverride.active
                  : stemPad.isActive;

              return (
                <button
                  key={`stem-${deckId}-${stemPad.padIndex}`}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (stemPad.isLocked) return;
                    setPadPressedState(deckId, stemPad.padIndex, true);
                    onTriggerPad(deckId, stemPad.padIndex);
                  }}
                  onPointerUp={() =>
                    setPadPressedState(deckId, stemPad.padIndex, false)
                  }
                  onPointerCancel={() =>
                    setPadPressedState(deckId, stemPad.padIndex, false)
                  }
                  onPointerLeave={() =>
                    setPadPressedState(deckId, stemPad.padIndex, false)
                  }
                  className={`rounded-md border flex flex-col items-center justify-center relative px-1.5 transition touch-none select-none ${
                    isPressed
                      ? stemPad.isSeratoStemFx
                        ? 'bg-[#EF4444] text-white border-white scale-[0.97]'
                        : 'bg-[#F3F4F6] text-[#0B0C0E] border-white scale-[0.97]'
                      : isActive
                      ? stemPad.isSeratoStemFx
                        ? 'bg-[#DC2626] hover:bg-[#EF4444] text-white border-[#FCA5A5] shadow-[0_0_12px_rgba(220,38,38,0.55)] font-bold'
                        : 'bg-[#1D3446] hover:bg-[#244056] text-white border-[#0099DB]'
                      : 'bg-[#25282F] hover:bg-[#2F333C] text-[#9CA3AF] border-[#3E434D]'
                  }`}
                >
                  <span className="absolute top-1 left-1.5 text-[9px] font-mono opacity-75">
                    S{stemPad.padIndex}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-tight leading-tight text-center px-0.5 max-w-full break-words">
                    {vdjOverride?.label || stemPad.defaultLabel}
                  </span>
                  <span
                    className={`text-[9px] font-mono mt-0.5 ${
                      isPressed
                        ? stemPad.isSeratoStemFx
                          ? 'text-white font-semibold'
                          : 'text-[#0B0C0E]'
                        : isActive && stemPad.isSeratoStemFx
                        ? 'text-[#FEE2E2] font-semibold'
                        : isActive
                        ? 'text-[#0099DB]'
                        : 'text-[#686E78]'
                    }`}
                  >
                    {vdjOverride?.sublabel || stemPad.sublabel}
                  </span>
                </button>
              );
            })}

          {/* PAGE 4: SAMPLER (8 Pads per Deck with Trigger, Stop, Loop, Volume & Dynamic Name) */}
          {activePage === 'SAMPLER' &&
            samplerPads.map((slot) => {
              const vdjOverride =
                vdjPadOverrides[
                  buildVdjPadOverrideKey(deckId, 'SAMPLER', slot.padIndex)
                ];
              const isPressed = Boolean(pressedPadsMap[slot.padIndex]);
              const isPlaying =
                vdjOverride?.active !== undefined
                  ? vdjOverride.active
                  : slot.isPlaying;

              return (
                <div
                  key={`smp-${deckId}-${slot.padIndex}`}
                  onPointerDown={(e) => {
                    if (samplerEditMode) return;
                    e.preventDefault();
                    setPadPressedState(deckId, slot.padIndex, true);
                    onTriggerPad(deckId, slot.padIndex);
                  }}
                  onPointerUp={() =>
                    setPadPressedState(deckId, slot.padIndex, false)
                  }
                  onPointerCancel={() =>
                    setPadPressedState(deckId, slot.padIndex, false)
                  }
                  onPointerLeave={() =>
                    setPadPressedState(deckId, slot.padIndex, false)
                  }
                  className={`rounded-md border flex flex-col items-center justify-between p-1.5 relative transition touch-none select-none cursor-pointer ${
                    isPressed || isPlaying
                      ? 'bg-[#F3F4F6] text-[#0B0C0E] border-white scale-[0.98]'
                      : 'bg-[#0099DB] hover:bg-[#00A8EF] text-white border-[#0082BA]'
                  }`}
                >
                  {/* Top Row inside Pad: Pad Index + Loop Toggle / Stop Button */}
                  <div className="w-full flex items-center justify-between text-[9px] font-mono">
                    <span className="opacity-85">P{slot.padIndex}</span>
                    <div
                      className="flex items-center gap-1"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {slot.isPlaying && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStopSamplerPad(deckId, slot.padIndex);
                          }}
                          title="Detener Sample"
                          className="px-1 py-0.2 rounded bg-[#991B1B] text-white font-bold"
                        >
                          ■
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSamplerPadLoop(deckId, slot.padIndex);
                        }}
                        title="Alternar Loop del Sample"
                        className={`px-1 rounded font-bold ${
                          slot.loopEnabled
                            ? 'bg-[#0B0C0E] text-[#0099DB] border border-white/60'
                            : 'bg-black/25 text-white/80 hover:bg-black/40'
                        }`}
                      >
                        ↻
                      </button>
                    </div>
                  </div>

                  {/* Center Pad Name */}
                  <div className="text-xs font-bold text-center truncate w-full my-auto">
                    {vdjOverride?.label || slot.name}
                  </div>

                  {/* Bottom Row: Volume or Edit Slider */}
                  {samplerEditMode ? (
                    <div
                      className="w-full flex items-center gap-1"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={slot.volume}
                        onChange={(e) =>
                          onChangeSamplerPadVolume(
                            deckId,
                            slot.padIndex,
                            Number(e.target.value)
                          )
                        }
                        className="w-full h-1.5 accent-[#0B0C0E] cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between text-[9px] font-mono opacity-90">
                      <span>{slot.loopEnabled ? 'LOOP' : 'ONE-SHOT'}</span>
                      <span>VOL {slot.volume}%</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex items-center justify-between px-3 py-2">
      {/* Left Bank: Deck A 8 Performance Pads */}
      {renderDeckPadsBank('A')}

      {/* Center Rack Column (Preserves exact Cross DJ Pro layout + Master Sampler Gain + REC / EDIT) */}
      <div className="w-[154px] shrink-0 h-full flex flex-col items-center justify-between py-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectSection(MainSection.LOOPS_HOTCUES)}
            title="Loops & Hot Cues"
            className="w-11 h-11 rounded-full bg-[#25282F] border border-[#525761] text-[#E5E7EB] hover:border-white flex items-center justify-center transition"
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
          <button
            type="button"
            onClick={() => onSelectSection(MainSection.MIXER_EQ)}
            title="Mixer / EQ"
            className="w-11 h-11 rounded-full bg-[#25282F] border border-[#525761] text-[#E5E7EB] hover:border-white flex items-center justify-center transition"
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
          <button
            type="button"
            onClick={() => onSelectSection(MainSection.FX)}
            title="FX Touch Pads"
            className="w-11 h-11 rounded-full bg-[#25282F] border border-[#525761] text-[#E5E7EB] hover:border-white font-bold italic text-sm flex items-center justify-center transition"
          >
            FX
          </button>
        </div>

        {/* Center Controls: REC | Sampler Master Volume Fader | EDIT */}
        <div className="flex-1 w-full flex items-end justify-center gap-2 py-2">
          <button
            type="button"
            onClick={onToggleRecording}
            className={`w-10 h-10 rounded-full border text-[10px] font-medium flex items-center justify-center transition ${
              isRecording
                ? 'bg-[#991B1B] border-white text-white'
                : 'bg-[#25282F] border-[#525761] text-[#D1D5DB]'
            }`}
          >
            REC
          </button>

          {/* Continuous Touch-Draggable Master Pad/Sampler Volume Fader */}
          <div
            ref={samplerSliderRef}
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Ignore capture error
              }
              samplerPointerIdRef.current = e.pointerId;
              updateSamplerGainFromClientY(e.clientY);
            }}
            onPointerMove={(e) => {
              if (samplerPointerIdRef.current !== e.pointerId) return;
              e.preventDefault();
              updateSamplerGainFromClientY(e.clientY);
            }}
            onPointerUp={(e) => {
              if (samplerPointerIdRef.current !== e.pointerId) return;
              samplerPointerIdRef.current = null;
            }}
            onPointerCancel={(e) => {
              if (samplerPointerIdRef.current !== e.pointerId) return;
              samplerPointerIdRef.current = null;
            }}
            title="Toque y deslice para ajustar el volumen maestro de Performance Pads / Sampler"
            className="relative w-8 h-full flex justify-center cursor-ns-resize touch-none"
          >
            <div className="relative w-3.5 h-full rounded-full bg-[#090A0C] border border-[#1E2127] flex justify-center pointer-events-none">
              <span
                style={{ top: `${100 - samplerGain}%` }}
                className="absolute -translate-y-1/2 w-4 h-4 rounded-full bg-[#DCDEE2] shadow"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleSamplerEditMode}
            title="Editar volumen individual de cada Sampler Pad"
            className={`w-10 h-10 rounded-full border text-[10px] font-medium flex items-center justify-center transition ${
              samplerEditMode
                ? 'bg-[#3A3E46] border-white text-white'
                : 'bg-[#25282F] border-[#525761] text-[#D1D5DB]'
            }`}
          >
            EDIT
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectSection(MainSection.DECKS)}
          title="PERFORMANCE PADS (Volver a Decks)"
          className="w-11 h-11 rounded-full bg-[#3A3E46] border border-white text-white flex items-center justify-center transition"
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
      </div>

      {/* Right Bank: Deck B 8 Performance Pads */}
      {renderDeckPadsBank('B')}
    </div>
  );
});
