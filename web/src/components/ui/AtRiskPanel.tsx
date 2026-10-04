import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ShieldAlert } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

export interface AtRiskTraineeItem {
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  batchId: string;
  batchName: string;
  severity: 'HIGH' | 'MEDIUM';
  reasons: string[];
  averageScore: number | null;
  batchAverageScore: number;
  totalSessions: number;
}

interface AtRiskPanelProps {
  trainees: AtRiskTraineeItem[];
  isLoading?: boolean;
}

export const AtRiskPanel: React.FC<AtRiskPanelProps> = ({ trainees, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card-flat p-4 animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  return (
    <div className="card-flat p-4 sm:p-5 border-l-4 border-l-red-500">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="text-sm font-semibold text-[var(--text-main)]">
            At-Risk Trainees ({trainees.length})
          </h3>
          <InfoTooltip
            title="At-Risk Detection Engine"
            content="Rule-based explainable model: Flags trainees when (1) 3 consecutive scores drop by >10 pts, (2) errors surge >30% over prior baseline, (3) score is >15 pts below batch average, or (4) 2+ absences in last 5 sessions. Severity is HIGH if 2+ rules fire."
          />
        </div>
        {trainees.length > 0 && (
          <span className="text-[11px] font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded-full">
            Action Recommended
          </span>
        )}
      </div>

      {trainees.length === 0 ? (
        <div className="py-4 text-center text-xs text-[var(--text-muted)] bg-[var(--background)] rounded-lg">
          🎉 All trainees are currently performing within expected progression parameters.
        </div>
      ) : (
        <div className="space-y-3">
          {trainees.map((t) => (
            <div
              key={t.traineeId}
              className="p-3 rounded-lg border border-[var(--border-main)] bg-[var(--background)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/trainees/${t.traineeId}`}
                    className="text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    {t.traineeName}
                  </Link>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    in {t.batchName}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      t.severity === 'HIGH'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {t.severity} PRIORITY
                  </span>
                </div>

                <ul className="text-xs text-[var(--text-muted)] space-y-0.5">
                  {t.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                <Link
                  to={`/trainees/${t.traineeId}`}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:text-blue-700 bg-[var(--surface)] px-2.5 py-1.5 rounded border border-[var(--border-main)] transition-colors"
                >
                  <span>Review Profile</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
