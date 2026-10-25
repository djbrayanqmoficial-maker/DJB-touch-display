import React, { useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../core/pwa/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isFullscreen,
    install,
    toggleLandscapeFullscreen,
  } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Fullscreen + Horizontal Lock Toggle */}
        <button
          type="button"
          onClick={toggleLandscapeFullscreen}
          title={
            isFullscreen
              ? 'Salir de pantalla completa'
              : 'Pantalla completa horizontal (Landscape)'
          }
          className={
            compact
              ? `px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1 ${
                  isFullscreen
                    ? 'bg-[#0099DB]/20 border-[#0099DB] text-[#0099DB]'
                    : 'bg-[#181B20] border-[#32363F] text-[#D1D5DB] hover:border-[#0099DB] hover:text-white'
                }`
              : `px-3 py-1.5 rounded text-xs font-mono border transition flex items-center gap-1.5 ${
                  isFullscreen
                    ? 'bg-[#0099DB]/20 border-[#0099DB] text-[#0099DB]'
                    : 'bg-[#1C1F24] border-[#32363F] text-[#F3F4F6] hover:border-[#0099DB]'
                }`
          }
        >
          <svg
            className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          <span>{compact ? 'FULL' : 'PANTALLA COMPLETA'}</span>
        </button>

        {/* Native Chromium / Android Install Prompt Button */}
        {!isInstalled && isInstallable && (
          <button
            type="button"
            onClick={install}
            title="Instalar aplicación DJB Touch Display en tu dispositivo (Offline + Horizontal Automático)"
            className={
              compact
                ? 'px-2 py-1 rounded bg-[#0099DB] hover:bg-[#19B2F5] text-[#0B0C0E] font-bold text-[10px] font-mono transition flex items-center gap-1'
                : 'px-3.5 py-1.5 rounded bg-[#0099DB] hover:bg-[#19B2F5] text-[#0B0C0E] font-bold text-xs font-mono transition flex items-center gap-1.5 shadow-sm'
            }
          >
            <svg
              className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>{compact ? 'INSTALAR' : 'INSTALAR APP (OFFLINE)'}</span>
          </button>
        )}

        {/* Fallback Install Guide Button when inside preview iframe or iOS Safari */}
        {!isInstalled && !isInstallable && (
          <button
            type="button"
            onClick={() => setShowInstallGuide(true)}
            title="Cómo instalar DJB Touch Display como App en Android / iOS"
            className={
              compact
                ? 'px-2 py-1 rounded bg-[#181B20] border border-[#0099DB]/60 hover:border-[#0099DB] text-[#0099DB] font-semibold text-[10px] font-mono transition flex items-center gap-1'
                : 'px-3 py-1.5 rounded bg-[#1C1F24] border border-[#0099DB] hover:bg-[#0099DB] hover:text-[#0B0C0E] text-[#0099DB] font-semibold text-xs font-mono transition flex items-center gap-1.5'
            }
          >
            <svg
              className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>{compact ? 'APP' : isIOS ? 'INSTALAR EN iOS' : 'INSTALAR APP'}</span>
          </button>
        )}
      </div>

      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 select-none">
          <div className="w-full max-w-md rounded-lg bg-[#16191E] border border-[#32363F] p-5 shadow-2xl text-[#F3F4F6]">
            <div className="flex items-center justify-between pb-3 border-b border-[#262930]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-4 bg-[#0099DB] rounded-xs" />
                <h3 className="text-sm font-bold tracking-wide uppercase">
                  Instalar DJB Touch Display (PWA Offline)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="text-xs font-mono text-[#9CA3AF] hover:text-white px-2 py-0.5"
              >
                ✕
              </button>
            </div>

            {isIOS ? (
              <div className="mt-3 space-y-2 text-xs text-[#D1D5DB] leading-relaxed">
                <p>
                  1. Abre el enlace directo de la aplicación en <strong>Safari</strong>.
                </p>
                <p>
                  2. Toca el botón <strong>Compartir</strong> en la barra de Safari.
                </p>
                <p>
                  3. Selecciona <strong>«Agregar a pantalla de inicio»</strong>.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5 text-xs text-[#D1D5DB] leading-relaxed">
                <p>
                  Para instalar <strong>DJB Touch Display</strong> a{' '}
                  <strong className="text-[#0099DB]">
                    pantalla completa en horizontal automático y con soporte Offline
                  </strong>{' '}
                  en tu teléfono Android:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-[#E5E7EB]">
                  <li>
                    Abre el enlace público de la app (<strong>Shared App URL</strong>) directamente en{' '}
                    <strong>Google Chrome</strong> en tu Android (fuera del visor de vista previa).
                  </li>
                  <li>
                    Pulsa el botón azul <strong>«INSTALAR APP (OFFLINE)»</strong> arriba a la derecha o abre el menú de Chrome (<strong>⋮</strong>) y toca{' '}
                    <strong>«Instalar aplicación»</strong>.
                  </li>
                  <li>
                    Ábrela desde el icono <strong>DJB Display</strong> en tu pantalla de inicio: se iniciará a pantalla completa en modo horizontal y guardará tus pistas locales para mezclar sin internet.
                  </li>
                </ol>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#262930] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  toggleLandscapeFullscreen();
                  setShowInstallGuide(false);
                }}
                className="px-3 py-1.5 rounded bg-[#23272E] border border-[#383D47] hover:border-[#0099DB] text-xs font-mono text-[#F3F4F6]"
              >
                PROBAR PANTALLA COMPLETA AHORA
              </button>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="px-4 py-1.5 rounded bg-[#0099DB] text-[#0B0C0E] font-bold text-xs font-mono"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-12 left-3 z-50 flex items-center gap-2 rounded bg-[#181B20]/95 border border-[#F59F00] px-2.5 py-1 text-[10px] font-mono text-[#F3F4F6] shadow-lg pointer-events-none">
      <span className="h-2 w-2 rounded-full bg-[#F59F00] animate-pulse" />
      <span>OFFLINE MODE · BIBLIOTECA LOCAL Y MOTOR AUDIO ACTIVOS</span>
    </div>
  );
};
