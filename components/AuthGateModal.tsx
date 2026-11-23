import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Lock, Mail, User, X } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface AuthGateModalProps {
  open: boolean;
  pendingLabel?: string;
  onClose: () => void;
  onAuthenticated: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/operation-not-allowed') {
    return "Firebase Console'da Email/Parol usuli hali yoqilmagan. Hozircha pastdagi 'Google hisob orqali kirish' tugmasidan foydalaning.";
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return "Email yoki parol noto‘g‘ri kiritildi. Qaytadan tekshirib ko‘ring.";
  }
  if (code === 'auth/user-not-found') {
    return "Bu email bilan hisob topilmadi. 'Ro‘yxatdan o‘tish' bo‘limidan yangi hisob oching.";
  }
  if (code === 'auth/email-already-in-use') {
    return "Bu email allaqachon ro‘yxatdan o‘tgan. 'Kirish' bo‘limiga o‘ting.";
  }
  if (code === 'auth/weak-password') {
    return "Parol kamida 6 ta belgidan iborat bo‘lishi kerak.";
  }
  if (code === 'auth/popup-closed-by-user') {
    return "Kirish oynasi yopildi. Davom etish uchun qaytadan urinib ko‘ring.";
  }
  if (code === 'auth/too-many-requests') {
    return "Juda ko‘p urinish bo‘ldi. Bir necha daqiqadan so‘ng qayta urinib ko‘ring.";
  }
  return msg.length > 140 ? "Tizimga kirishda xatolik yuz berdi. Qayta urinib ko‘ring." : msg;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({
  open,
  pendingLabel,
  onClose,
  onAuthenticated,
}) => {
  const { signInWithGoogle, signInWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);

  if (!open) return null;

  const handleGoogleContinue = async () => {
    setErrorText(null);
    setInfoText(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      onAuthenticated();
    } catch (err) {
      setErrorText(mapFirebaseAuthError(err));
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setInfoText(null);

    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setErrorText("To‘g‘ri email manzilini kiriting (masalan: ism@gmail.com).");
      return;
    }
    if (password.length < 6) {
      setErrorText("Parol kamida 6 ta belgidan iborat bo‘lishi kerak.");
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(trimmedEmail, password, displayName);
        setInfoText(
          "Hisob yaratildi va tasdiqlash xati yuborildi. Darsga kirilmoqda..."
        );
      } else {
        await signInWithEmail(trimmedEmail, password);
      }
      onAuthenticated();
    } catch (err) {
      setErrorText(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      <div
        className="w-full max-w-md bg-white border border-black/[0.06] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.14)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-[#F5F5F7]/75 border-b border-black/[0.06] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono-tabular text-[11px] font-medium text-[#6E6E73]">
              Mirvo hisob · Sinxronizatsiya
            </div>
            <h2
              id="auth-gate-title"
              className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-[-0.02em] truncate"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Email bilan hisobga kiring
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Oynani yopish"
            className="w-9 h-9 rounded-full border border-black/[0.06] bg-white hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {pendingLabel && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-xs text-slate-700">
              <span className="font-semibold text-blue-700">Tanlangan dars: </span>
              <span className="font-medium text-slate-900">{pendingLabel}</span>
            </div>
          )}

          {/* Primary instant Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleContinue}
            disabled={googleBusy || busy}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-sm font-medium inline-flex items-center justify-center gap-2.5 apple-transition cursor-pointer disabled:opacity-60"
          >
            {googleBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
            )}
            <span>Google orqali tezkor kirish</span>
          </button>

          <div className="flex items-center gap-3 text-[11px] text-[#6E6E73] font-medium">
            <div className="h-px flex-1 bg-black/[0.06]" />
            <span>yoki email va parol bilan</span>
            <div className="h-px flex-1 bg-black/[0.06]" />
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F5F7] rounded-full">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorText(null);
              }}
              className={`min-h-[36px] rounded-full text-xs font-medium apple-transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#1D1D1F] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Kirish
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorText(null);
              }}
              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ro‘yxatdan o‘tish
            </button>
          </div>

          {errorText && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 leading-relaxed">
              {errorText}
            </div>
          )}

          {infoText && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{infoText}</span>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'register' && (
              <div className="space-y-1">
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ismingiz
                </label>
                <div className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 flex items-center gap-2 transition-colors">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    id="auth-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Masalan: Jasurbek"
                    maxLength={100}
                    className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="auth-email-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Email manzil
              </label>
              <div className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 flex items-center gap-2 transition-colors">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sizning@email.uz"
                  maxLength={160}
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="auth-password-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Parol
              </label>
              <div className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 flex items-center gap-2 transition-colors">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  id="auth-password-input"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kamida 6 ta belgi"
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || googleBusy}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium inline-flex items-center justify-center gap-2 apple-transition cursor-pointer disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'register'
                      ? 'Hisob yaratish va saqlash'
                      : 'Hisobga kirish'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Kirish orqali darslar tarixingiz va shaxsiy progresingiz xavfsiz saqlanadi.
          </p>
        </div>
      </div>
    </div>
  );
};
