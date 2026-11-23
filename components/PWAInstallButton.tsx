import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Mirvo AI ilovasini o‘rnatish"
        className={`h-9 px-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,113,227,0.24)] apple-transition cursor-pointer whitespace-nowrap shrink-0 ${className}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden md:inline' : ''}>O‘rnatish</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="iPhone yoki iPadga o‘rnatish"
          className={`h-9 px-3 rounded-full bg-white/85 hover:bg-white border border-black/[0.06] text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap shrink-0 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
          <span className={compact ? 'hidden md:inline' : ''}>O‘rnatish</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white border border-black/[0.06] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)] space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3
                  className="text-base font-semibold tracking-[-0.02em] text-[#1D1D1F]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  iPhone / iPad ga o‘rnatish
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Yopish"
                  className="w-8 h-8 rounded-full bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-[#6E6E73] leading-relaxed">
                1. Safari panelidagi <strong className="text-[#1D1D1F] inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 text-[#0071E3]" /> Ulashish</strong> tugmasini bosing.
                <br />
                2. Pastga surib <strong className="text-[#1D1D1F]">Bosh ekranga qo‘shish</strong> bandini tanlang.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full h-10 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium apple-transition cursor-pointer"
              >
                Tushunarli
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
