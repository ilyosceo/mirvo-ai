import React, { useMemo } from 'react';
import katex from 'katex';
import { compile } from 'mathjs';

interface KaTeXBlockProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export const KaTeXBlock: React.FC<KaTeXBlockProps> = ({
  latex,
  displayMode = true,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return latex;
    }
  }, [latex, displayMode]);

  return (
    <div
      className={`overflow-visible text-slate-900 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface LiveFormulaItem {
  label: string;
  latex_lhs: string;
  expr: string;
  unit?: string;
}

interface LiveFormulaListProps {
  items: LiveFormulaItem[];
  sliderValues: Record<string, number>;
}

export const LiveFormulaList: React.FC<LiveFormulaListProps> = ({
  items,
  sliderValues,
}) => {
  const computed = useMemo(() => {
    return items.map((item) => {
      let resultText = '—';
      try {
        const val = Number(compile(item.expr).evaluate({ ...sliderValues, pi: Math.PI }));
        if (Number.isFinite(val)) {
          resultText = Number.isInteger(val) ? String(val) : val.toFixed(2);
        }
      } catch {
        resultText = '—';
      }
      const latex = `${item.latex_lhs} = ${resultText}${item.unit ? `\\,\\text{${item.unit}}` : ''}`;
      return { ...item, latex };
    });
  }, [items, sliderValues]);

  if (computed.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {computed.map((item, idx) => (
        <div
          key={`${item.label}-${idx}`}
          className="bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-0.5 inline-flex items-center gap-1.5"
        >
          <span className="text-[11px] text-slate-500">{item.label}:</span>
          <KaTeXBlock latex={item.latex} displayMode={false} className="text-xs font-semibold text-blue-700" />
        </div>
      ))}
    </div>
  );
};
