import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
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
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label="Mirvo AI ilovasini o‘rnatish"
        className={`h-9 px-3 rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-[0_2px_10px_rgba(29,78,216,0.28)] transition-all cursor-pointer whitespace-nowrap shrink-0 ${className}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden md:inline' : ''}>O‘rnatish</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 border"
            style={{
              background: 'var(--surface, #FFFFFF)',
              color: 'var(--ink, #0B1220)',
              borderColor: 'var(--line-strong, rgba(11,18,32,0.14))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#1D4ED8]" />
                <h3
                  className="text-base font-bold tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Mirvo AI ilovasini o‘rnatish
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Yopish"
                className="w-8 h-8 rounded-full inline-flex items-center justify-center cursor-pointer"
                style={{ background: 'var(--surface-2, #EEF1F7)', color: 'var(--muted, #55637A)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                1. Safari pastidagi{' '}
                <strong style={{ color: 'var(--ink)' }} className="inline-flex items-center gap-1">
                  <Share className="w-3.5 h-3.5 text-[#1D4ED8]" /> Ulashish
                </strong>{' '}
                tugmasini bosing.
                <br />
                2. Pastga surib{' '}
                <strong style={{ color: 'var(--ink)' }}>Bosh ekranga qo‘shish</strong> bandini
                tanlang.
              </p>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                1. Brauzer manzil satri o‘ngidagi{' '}
                <strong style={{ color: 'var(--ink)' }}>Ilovani o‘rnatish (⊕)</strong> belgisini
                yoki menyudan{' '}
                <strong style={{ color: 'var(--ink)' }}>Ilova sifatida o‘rnatish</strong> bandini
                bosing.
                <br />
                2. Mirvo AI oflayn va to‘liq ekran rejimida alohida ilova bo‘lib ochiladi.
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full h-10 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </>
  );
};
