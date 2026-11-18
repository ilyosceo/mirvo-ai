import React, { useEffect, useRef, useState } from 'react';
import { Cloud, LogOut } from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

interface GoogleAuthButtonProps {
  compact?: boolean;
}

export const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ compact = false }) => {
  const { user, authReady, isSigningIn, signInWithGoogle, signOutGoogle, cloudLessons } =
    useFirebaseAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [user?.photoURL]);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  if (!authReady) {
    return (
      <div className="h-9 w-24 rounded-xl bg-slate-100 animate-pulse shrink-0" aria-hidden="true" />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={isSigningIn}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-400 text-slate-800 font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
          compact ? 'h-9 px-2.5 text-xs' : 'h-10 px-3.5 text-xs sm:text-sm'
        }`}
      >
        <GoogleGIcon className="w-4 h-4 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>
          {isSigningIn ? 'Kirilmoqda...' : 'Gmail bilan kirish'}
        </span>
      </button>
    );
  }

  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Foydalanuvchi';
  const firstName = displayName.split(/\s+/)[0];
  const initial = (displayName[0] || 'U').toUpperCase();

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-label="Gmail hisob menyusi"
        className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs ${
          compact ? 'h-9 pl-1.5 pr-2.5' : 'h-10 pl-1.5 pr-3'
        }`}
      >
        {user.photoURL && !imgFailed ? (
          <img
            src={user.photoURL}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-6 h-6 rounded-lg object-cover shrink-0 border border-slate-200"
          />
        ) : (
          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0">
            {initial}
          </span>
        )}
        <span className="text-xs font-semibold text-slate-800 max-w-[96px] truncate hidden sm:inline">
          {firstName}
        </span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 z-50 space-y-2.5">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
            {user.photoURL && !imgFailed ? (
              <img
                src={user.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <span className="w-9 h-9 rounded-xl bg-blue-600 text-white text-sm font-bold inline-flex items-center justify-center shrink-0">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">{displayName}</div>
              <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-700 px-1">
            <Cloud className="w-3.5 h-3.5 shrink-0" />
            <span>Bulutda {cloudLessons.length} ta dars saqlangan</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void signOutGoogle();
            }}
            className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Hisobdan chiqish</span>
          </button>
        </div>
      )}
    </div>
  );
};
