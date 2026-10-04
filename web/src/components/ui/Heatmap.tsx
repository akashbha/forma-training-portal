import React, { useState } from 'react';
import { cn, formatScore } from '../../lib/utils';
import { HeatmapData } from '../../types/api';

export interface HeatmapProps {
  data: HeatmapData;
  className?: string;
  onCellClick?: (traineeId: string, sessionId: string) => void;
}

export const Heatmap: React.FC<HeatmapProps> = ({ data, className, onCellClick }) => {
  const [activeCell, setActiveCell] = useState<{
    traineeName: string;
    sessionTitle: string;
    score: number | null;
    status: string;
  } | null>(null);

  const { sessions, matrix } = data;

  return (
    <div className={cn('card-flat p-4 overflow-hidden flex flex-col', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[var(--border-main)]">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-main)]">
            Trainee × Session Performance Heatmap
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            Navigate with keyboard tabs or click cells to view session scores.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] flex-wrap">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-emerald-100 border border-emerald-300 inline-block" />
            <span>&ge; 70% (On Track)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-amber-100 border border-amber-300 inline-block" />
            <span>50–69% (Needs Support)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-orange-100 border border-orange-300 inline-block" />
            <span>&lt; 50% (At Risk)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-slate-100 border border-slate-200 inline-block" />
            <span>Not recorded</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" role="grid" aria-label="Performance Heatmap Table">
          <thead>
            <tr>
              <th
                scope="col"
                className="py-2.5 px-3 text-xs font-semibold text-[var(--text-muted)] bg-slate-50 border-b border-[var(--border-main)] sticky left-0 z-10 w-48 min-w-[180px]"
              >
                Trainee
              </th>
              {sessions.map((s, idx) => (
                <th
                  key={s.id}
                  scope="col"
                  className="py-2.5 px-2 text-center text-xs font-medium text-[var(--text-muted)] bg-slate-50 border-b border-[var(--border-main)] min-w-[72px]"
                  title={s.title}
                >
                  S{idx + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)]">
            {matrix.map((row) => (
              <tr key={row.traineeId} className="hover:bg-slate-50/50 transition-colors">
                <th
                  scope="row"
                  className="py-2 px-3 text-xs font-medium text-[var(--text-main)] whitespace-nowrap sticky left-0 bg-[var(--surface)] border-r border-[var(--border-main)]"
                >
                  {row.name}
                </th>
                {sessions.map((s) => {
                  const scoreObj = row.scores[s.id];
                  const hasScore = scoreObj !== null && scoreObj !== undefined;
                  const score = hasScore ? scoreObj.score : null;

                  let cellBg = 'bg-slate-100 text-slate-400 border-slate-200';
                  let statusDesc = 'No result';

                  if (hasScore && score !== null) {
                    if (score >= 70) {
                      cellBg = 'bg-emerald-100 text-[var(--success)] border-emerald-300 font-semibold';
                      statusDesc = `${formatScore(score)} - On Track`;
                    } else if (score >= 50) {
                      cellBg = 'bg-amber-100 text-[var(--warning)] border-amber-300 font-semibold';
                      statusDesc = `${formatScore(score)} - Needs Support`;
                    } else {
                      cellBg = 'bg-orange-100 text-[var(--danger)] border-orange-300 font-semibold';
                      statusDesc = `${formatScore(score)} - At Risk`;
                    }
                  }

                  const ariaLabel = `${row.name}, ${s.title}: ${statusDesc}`;

                  return (
                    <td key={s.id} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onCellClick?.(row.traineeId, s.id);
                          setActiveCell({
                            traineeName: row.name,
                            sessionTitle: s.title,
                            score,
                            status: statusDesc,
                          });
                        }}
                        onFocus={() => {
                          setActiveCell({
                            traineeName: row.name,
                            sessionTitle: s.title,
                            score,
                            status: statusDesc,
                          });
                        }}
                        aria-label={ariaLabel}
                        className={cn(
                          'w-full h-8 rounded-[4px] border text-xs flex items-center justify-center transition-all cursor-pointer',
                          'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none',
                          cellBg
                        )}
                      >
                        {hasScore ? formatScore(score, false) : '—'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeCell && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 p-2 bg-[var(--primary-soft)] text-[var(--text-main)] text-xs rounded-[6px] border border-blue-100 flex items-center justify-between"
        >
          <div>
            <span className="font-semibold">{activeCell.traineeName}</span> &middot; {activeCell.sessionTitle}
          </div>
          <div className="font-semibold">{activeCell.status}</div>
        </div>
      )}
    </div>
  );
};
