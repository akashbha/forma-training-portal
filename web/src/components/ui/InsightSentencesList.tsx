import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

export interface InsightSentenceItem {
  id: string;
  category: 'IMPROVEMENT' | 'WEAK_TOPIC' | 'AT_RISK' | 'CONSISTENCY' | 'BENCHMARK';
  text: string;
  linkUrl: string;
  linkText: string;
  priority: number;
}

interface InsightSentencesListProps {
  sentences: InsightSentenceItem[];
  isLoading?: boolean;
}

export const InsightSentencesList: React.FC<InsightSentencesListProps> = ({
  sentences,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="card-flat p-4 animate-pulse space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (!sentences || sentences.length === 0) {
    return null;
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'AT_RISK':
        return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
      case 'IMPROVEMENT':
        return <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'CONSISTENCY':
        return <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />;
    }
  };

  return (
    <div className="card-flat p-4 sm:p-5 space-y-3 bg-gradient-to-r from-[var(--surface)] to-[var(--background)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--primary)]" />
          <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
            Academy Intelligence & Highlights
          </h3>
          <InfoTooltip
            title="Data-Grounded Insights"
            content="Template-based sentences generated purely from computed mathematical indicators (trend slopes, consistency scales, and topic averages). Cohorts with fewer than 5 sample points are strictly excluded."
          />
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          {sentences.length} Key Insights
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {sentences.map((sentence) => (
          <div
            key={sentence.id}
            className="p-3 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5">{getCategoryIcon(sentence.category)}</div>
              <p className="text-[var(--text-main)] leading-relaxed font-medium">
                {sentence.text}
              </p>
            </div>

            <Link
              to={sentence.linkUrl}
              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] hover:underline whitespace-nowrap self-end sm:self-center"
            >
              <span>{sentence.linkText}</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
