import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

export interface BatchWeakTopic {
  topicId: string;
  topicName: string;
  averageScore: number;
  averageErrors: number;
  totalAttempts: number;
  passRate: number;
  weakRank: number;
}

export interface TraineeTopicStat {
  topicId: string;
  topicName: string;
  averageScore: number;
  averageErrors: number;
  sampleSize: number;
  isWeak: boolean;
}

export interface TraineeTopicRow {
  traineeId: string;
  traineeName: string;
  topicStats: Record<string, TraineeTopicStat>;
}

interface WeakTopicsHeatmapProps {
  rankedWeakest: BatchWeakTopic[];
  topics: { id: string; name: string }[];
  rows: TraineeTopicRow[];
}

export const WeakTopicsHeatmap: React.FC<WeakTopicsHeatmapProps> = ({
  rankedWeakest,
  topics,
  rows,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Ranked Weakest Topics summary cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-main)]">
            Curriculum Weak-Topic Ranking
          </h3>
          <InfoTooltip
            title="Weak Topic Analysis"
            content="Topics ranked in ascending order by average evaluated score across all trainees. Highlights curriculum areas that may require supplemental workshops or modified instruction."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rankedWeakest.slice(0, 6).map((topic) => {
            const isCritical = topic.averageScore < 70;
            return (
              <div
                key={topic.topicId}
                className={`card-flat p-3.5 border-l-4 ${
                  isCritical ? 'border-l-red-500' : 'border-l-amber-500'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-[var(--text-main)] truncate mr-2">
                    #{topic.weakRank} {topic.topicName}
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                      isCritical
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    Avg: {topic.averageScore}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-2">
                  <span>Pass Rate: {topic.passRate}%</span>
                  <span>{topic.totalAttempts} total submissions</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Trainee x Topic Matrix Heatmap */}
      <div className="card-flat p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">
              Trainee × Topic Proficiency Heatmap
            </h3>
            <InfoTooltip
              title="Matrix Cell Info"
              content="Each cell indicates the trainee's average score and sample size (n) for that curriculum subject. Green indicates passing score (>=70), and Red indicates below pass mark."
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Pass (≥70)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>Below Pass (&lt;70)</span>
            </span>
          </div>
        </div>

        <div className="table-responsive-container max-h-[420px] border border-[var(--border-main)] rounded-lg">
          <table className="w-full text-left text-xs table-sticky-col border-collapse">
            <thead className="bg-[var(--background)] border-b border-[var(--border-main)] text-[var(--text-muted)]">
              <tr>
                <th className="px-3.5 py-2.5 font-semibold text-[var(--text-main)] min-w-[160px]">
                  Trainee Name
                </th>
                {topics.map((t) => (
                  <th key={t.id} className="px-3 py-2.5 font-medium min-w-[120px] text-center">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]">
              {rows.map((row) => (
                <tr key={row.traineeId} className="hover:bg-[var(--background)]/60 transition-colors">
                  <td className="px-3.5 py-2.5 font-medium text-[var(--text-main)] truncate max-w-[180px]">
                    {row.traineeName}
                  </td>
                  {topics.map((t) => {
                    const stat = row.topicStats[t.id];
                    if (!stat) {
                      return (
                        <td key={t.id} className="px-3 py-2.5 text-center text-[var(--text-muted)] font-mono text-[11px]">
                          —
                        </td>
                      );
                    }

                    const isPass = stat.averageScore >= 70;
                    return (
                      <td key={t.id} className="px-2 py-2 text-center">
                        <div
                          className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded min-w-[70px] ${
                            isPass
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                              : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/40'
                          }`}
                        >
                          <span className="font-mono font-bold text-xs">{stat.averageScore}</span>
                          <span className="text-[10px] opacity-80">(n={stat.sampleSize})</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
