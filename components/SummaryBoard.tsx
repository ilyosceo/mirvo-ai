import React, { useMemo } from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { SUBJECT_LABELS_UZ, type TutorLesson } from '../types/tutor';
import { KaTeXBlock } from './KaTeXBlock';

interface SummaryBoardProps {
  lesson: TutorLesson;
  isPlaying: boolean;
  activeConceptIndex: number | null;
  onInspectStep: (stepIndex: number) => void;
  onSwitchToDetailed: () => void;
}

function cleanTitle(raw: string): string {
  return raw.replace(/^\d+[\.\)\-\:]\s*/, '').trim();
}

export const SummaryBoard: React.FC<SummaryBoardProps> = ({
  lesson,
  isPlaying,
  activeConceptIndex,
  onInspectStep,
  onSwitchToDetailed,
}) => {
  const { keyFormulas, keyConcepts, keyParts, quizTakeaway } = useMemo(() => {
    const seenFormulas = new Set<string>();
    const formulas: Array<{ latex: string; stepIndex: number; stepTitle: string }> = [];

    const concepts: Array<{
      stepIndex: number;
      title: string;
      explanation: string;
      primaryFormula?: string;
    }> = [];

    const seenParts = new Set<string>();
    const parts: Array<{ label: string; partId: string }> = [];

    let takeaway: string | null = null;

    lesson.steps.forEach((step, idx) => {
      const title = cleanTitle(step.step_title);
      const explanation = (step.explanation_uz || '').trim();
      const stepFormulas = (step.katex_formulas || []).filter((f) => f && f.trim().length > 0);

      for (const rawLatex of stepFormulas) {
        const norm = rawLatex.replace(/\s+/g, '');
        if (!seenFormulas.has(norm)) {
          seenFormulas.add(norm);
          formulas.push({
            latex: rawLatex.trim(),
            stepIndex: idx,
            stepTitle: title,
          });
        }
      }

      if (title || explanation) {
        concepts.push({
          stepIndex: idx,
          title,
          explanation,
          primaryFormula: stepFormulas[0],
        });
      }

      const objParts = step.render_params?.object_parts || [];
      for (const p of objParts) {
        const label = (p.label || '').trim();
        const key = label.toLowerCase();
        if (label && !seenParts.has(key)) {
          seenParts.add(key);
          parts.push({ label, partId: p.partId || `part_${parts.length}` });
        }
      }

      if (step.quiz?.explanation_uz) {
        takeaway = step.quiz.explanation_uz.trim();
      }
    });

    return {
      keyFormulas: formulas,
      keyConcepts: concepts,
      keyParts: parts.slice(0, 6),
      quizTakeaway: takeaway,
    };
  }, [lesson]);

  const animKey = `${lesson.id || lesson.topic_title}-${keyFormulas.length}-${keyConcepts.length}`;

  return (
    <div
      key={animKey}
      className="h-full w-full overflow-y-auto academic-scroll px-5 sm:px-8 pt-16 pb-24"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="pb-4 border-b border-black/[0.06] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6E73] font-medium">
              <span>{SUBJECT_LABELS_UZ[lesson.subject]}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#0071E3] font-semibold">Qisqacha rejim</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {keyFormulas.length} formula · {keyConcepts.length} tushuncha
              </span>
            </div>
            <h2
              className="mt-1 text-lg sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] leading-snug"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {lesson.topic_title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onSwitchToDetailed}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071E3]/[0.08] text-xs font-medium text-[#0071E3] hover:bg-[#0071E3]/[0.14] apple-transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>To‘liq chizma</span>
          </button>
        </header>

        {/* Main 2-Column Blueprint Grid: Core Formulas + Core Concepts */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Core Formulas Column */}
          <section aria-label="Asosiy formulalar" className="xl:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wide text-slate-500">
                Asosiy formulalar
              </h3>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                {keyFormulas.length} ta
              </span>
            </div>

            {keyFormulas.length > 0 ? (
              <div className="space-y-2.5">
                {keyFormulas.map((item, idx) => {
                  const isHighlighted =
                    isPlaying &&
                    activeConceptIndex !== null &&
                    activeConceptIndex === item.stepIndex;

                  return (
                    <button
                      key={`${item.latex}-${idx}`}
                      type="button"
                      onClick={() => onInspectStep(item.stepIndex)}
                      style={{ animationDelay: `${idx * 70}ms` }}
                      className={`mirvo-summary-reveal group w-full text-left rounded-2xl border px-4 py-3 apple-transition cursor-pointer ${
                        isHighlighted
                          ? 'border-[#0071E3] bg-[#0071E3]/[0.05] shadow-xs'
                          : 'border-black/[0.06] bg-white hover:border-[#0071E3]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#6E6E73] font-mono-tabular mb-1.5">
                        <span className="truncate">
                          {String(item.stepIndex + 1).padStart(2, '0')} · {item.stepTitle}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#6E6E73]/50 group-hover:text-[#0071E3] apple-transition shrink-0" />
                      </div>

                      <div className="overflow-x-auto no-scrollbar py-0.5">
                        <KaTeXBlock
                          latex={item.latex}
                          displayMode={false}
                          className="text-sm sm:text-base font-semibold text-[#1D1D1F]"
                        />
                      </div>

                      <svg
                        viewBox="0 0 240 6"
                        className="w-full h-1.5 mt-2 overflow-visible"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M 2 3 Q 65 1, 125 3 T 238 3"
                          fill="none"
                          stroke="#0071E3"
                          strokeWidth="2"
                          strokeLinecap="round"
                          opacity={isHighlighted ? 0.95 : 0.35}
                          className="mirvo-summary-draw"
                          style={
                            {
                              '--mirvo-stroke-len': '242',
                              animationDelay: `${120 + idx * 90}ms`,
                            } as React.CSSProperties
                          }
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-4 text-xs text-slate-500 leading-relaxed">
                Ushbu mavzu asosan tushuncha va vizual tuzilishga tayangan — o‘ng tomondagi asosiy qoidalarni ko‘ring.
              </div>
            )}

            {keyParts.length > 0 && (
              <div className="pt-2 space-y-2">
                <h3 className="text-xs font-bold tracking-wide text-slate-500">
                  Muhim tarkibiy qismlar
                </h3>
                <div className="rounded-2xl border border-slate-200/90 bg-white/95 divide-y divide-slate-100">
                  {keyParts.map((part, pIdx) => (
                    <div
                      key={part.partId}
                      style={{ animationDelay: `${160 + pIdx * 55}ms` }}
                      className="mirvo-summary-reveal flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                    >
                      <span className="font-mono-tabular text-[11px] text-slate-400">
                        {String(pIdx + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 font-semibold text-slate-800">{part.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Core Concepts Timeline Column */}
          <section aria-label="Asosiy tushunchalar" className="xl:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wide text-slate-500">
                Asosiy tushunchalar
              </h3>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                Bosqichma-bosqich xulosa
              </span>
            </div>

            <div className="relative pl-6 space-y-3">
              {/* Drawn vertical blueprint guide line */}
              <svg
                className="pointer-events-none absolute left-2 top-3 bottom-3 w-2 h-[calc(100%-1.5rem)]"
                preserveAspectRatio="none"
                viewBox="0 0 8 400"
                aria-hidden="true"
              >
                <line
                  x1="4"
                  y1="0"
                  x2="4"
                  y2="400"
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="mirvo-summary-draw"
                  style={{ '--mirvo-stroke-len': '400' } as React.CSSProperties}
                />
              </svg>

              {keyConcepts.map((concept, idx) => {
                const isHighlighted =
                  isPlaying &&
                  activeConceptIndex !== null &&
                  activeConceptIndex === concept.stepIndex;

                return (
                  <button
                    key={concept.stepIndex}
                    type="button"
                    onClick={() => onInspectStep(concept.stepIndex)}
                    style={{ animationDelay: `${idx * 85}ms` }}
                    className={`mirvo-summary-reveal group relative w-full text-left rounded-2xl border px-4 py-3 transition-colors cursor-pointer ${
                      isHighlighted
                        ? 'border-blue-500 bg-blue-50/55 shadow-xs'
                        : 'border-slate-200/90 bg-white/95 hover:border-blue-400 hover:bg-blue-50/20'
                    }`}
                  >
                    {/* Blueprint node marker */}
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[22px] top-4 w-3 h-3 rounded-full border-2 border-white transition-colors ${
                        isHighlighted
                          ? 'bg-amber-500 ring-2 ring-amber-400/40'
                          : 'bg-blue-600 group-hover:bg-blue-700'
                      }`}
                    />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono-tabular font-semibold text-blue-700">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {concept.title}
                          </span>
                        </div>
                        {concept.explanation && (
                          <p className="mt-1 text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                            {concept.explanation}
                          </p>
                        )}
                      </div>

                      <span className="text-[11px] font-medium text-slate-400 group-hover:text-blue-600 whitespace-nowrap shrink-0 mt-0.5">
                        Ko‘rish
                      </span>
                    </div>

                    {concept.primaryFormula && (
                      <div className="mt-2 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
                        <KaTeXBlock
                          latex={concept.primaryFormula}
                          displayMode={false}
                          className="text-xs sm:text-sm text-slate-800"
                        />
                      </div>
                    )}
                  </button>
                );
              })}

              {quizTakeaway && (
                <div
                  style={{ animationDelay: `${keyConcepts.length * 85}ms` }}
                  className="mirvo-summary-reveal relative rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -left-[22px] top-4 w-3 h-3 rounded-full border-2 border-white bg-emerald-600"
                  />
                  <div className="text-[11px] font-semibold text-emerald-700 mb-0.5">
                    Yakuniy xulosa
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                    {quizTakeaway}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
