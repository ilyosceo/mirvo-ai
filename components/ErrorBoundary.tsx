import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'Kutilmagan xatolik yuz berdi.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && typeof parsed.error === 'string') {
        readable = `Ma’lumotlar bazasi xatoligi (${parsed.operationType || 'read'}): ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Mirvo AI UI ErrorBoundary:', error, info);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-center">
          <div className="mx-auto w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Ilovada texnik uzilish yuz berdi
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed break-words">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Sahifani yangilash
          </button>
        </div>
      </div>
    );
  }
}
