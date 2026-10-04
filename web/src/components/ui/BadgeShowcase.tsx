import React from 'react';
import { Award, CheckCircle, Lock, Download, Star, Flame, Trophy, CalendarCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { InfoTooltip } from './InfoTooltip';

export interface TraineeBadgeItem {
  type: string;
  name: string;
  description: string;
  isEarned: boolean;
  awardedAt: string | null;
}

interface BadgeShowcaseProps {
  traineeName: string;
  batchName: string;
  badges: TraineeBadgeItem[];
  programCompleted?: boolean;
}

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({
  traineeName,
  batchName,
  badges,
  programCompleted = false,
}) => {
  const earnedCount = badges.filter((b) => b.isEarned).length;

  const getBadgeIcon = (type: string, isEarned: boolean) => {
    const className = `w-6 h-6 ${isEarned ? 'text-amber-500' : 'text-slate-400 dark:text-slate-600'}`;
    switch (type) {
      case 'FIRST_SESSION':
        return <Star className={className} />;
      case 'PASS_STREAK_5':
        return <Flame className={className} />;
      case 'ALL_TOPICS':
        return <Trophy className={className} />;
      case 'MOST_IMPROVED':
        return <Award className={className} />;
      case 'PERFECT_ATTENDANCE':
        return <CalendarCheck className={className} />;
      default:
        return <Award className={className} />;
    }
  };

  const handleDownloadCertificate = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Outer decorative border
    doc.setDrawColor(29, 78, 216); // primary blue
    doc.setLineWidth(4);
    doc.rect(20, 20, pageWidth - 40, pageHeight - 40);

    // Inner thin border
    doc.setDrawColor(219, 227, 240);
    doc.setLineWidth(1);
    doc.rect(28, 28, pageWidth - 56, pageHeight - 56);

    // Title Header
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 78, 216);
    doc.setFontSize(26);
    doc.text('forma ACADEMY', pageWidth / 2, 80, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(85, 99, 125);
    doc.setFontSize(14);
    doc.text('CERTIFICATE OF TRAINING ACHIEVEMENT', pageWidth / 2, 105, { align: 'center' });

    // Decorative line
    doc.setDrawColor(29, 78, 216);
    doc.setLineWidth(2);
    doc.line(pageWidth / 2 - 120, 120, pageWidth / 2 + 120, 120);

    // Presentation text
    doc.setFontSize(13);
    doc.setTextColor(15, 27, 51);
    doc.text('This is to certify that', pageWidth / 2, 160, { align: 'center' });

    // Trainee Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(29, 78, 216);
    doc.text(traineeName, pageWidth / 2, 200, { align: 'center' });

    // Cohort text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(85, 99, 125);
    doc.text(
      `has successfully demonstrated curriculum competency in`,
      pageWidth / 2,
      240,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 27, 51);
    doc.text(`${batchName} Program`, pageWidth / 2, 265, { align: 'center' });

    // Badges Achieved summary
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(85, 99, 125);
    doc.text(
      `Earned ${earnedCount} Performance Milestone Badges • Evaluated via forma Precision Analytics`,
      pageWidth / 2,
      305,
      { align: 'center' }
    );

    // Signatures / Dates
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc.setFontSize(11);
    doc.setTextColor(15, 27, 51);
    doc.text(`Issued on: ${today}`, 80, 360);
    doc.text('Academic Director: Dr. Julian Vance', pageWidth - 260, 360);

    doc.setDrawColor(180, 190, 205);
    doc.line(80, 345, 200, 345);
    doc.line(pageWidth - 260, 345, pageWidth - 80, 345);

    // Save PDF
    doc.save(`forma_Certificate_${traineeName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="card-flat p-4 sm:p-5 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-semibold text-[var(--text-main)]">
            Milestone Badges ({earnedCount}/{badges.length} Unlocked)
          </h3>
          <InfoTooltip
            title="Milestone Badges"
            content="Idempotently awarded when trainees reach key thresholds: completing their first session, logging 5 consecutive scores above pass mark, completing all curriculum topics, achieving +10 pt growth, or maintaining 100% attendance."
          />
        </div>

        <button
          type="button"
          onClick={handleDownloadCertificate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
          title="Export achievement certificate PDF"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Certificate</span>
        </button>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {badges.map((b) => (
          <div
            key={b.type}
            className={`p-3.5 rounded-lg border transition-all ${
              b.isEarned
                ? 'bg-[var(--surface)] border-amber-300 dark:border-amber-700/60 shadow-xs'
                : 'bg-[var(--background)]/60 border-[var(--border-main)] opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="p-2 rounded-full bg-[var(--background)] border border-[var(--border-main)] shrink-0">
                {getBadgeIcon(b.type, b.isEarned)}
              </div>
              {b.isEarned ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  <span>Awarded</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] bg-[var(--background)] px-2 py-0.5 rounded-full border border-[var(--border-main)]">
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </span>
              )}
            </div>

            <div className="mt-2.5">
              <p className="text-xs font-bold text-[var(--text-main)]">{b.name}</p>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-1">
                {b.description}
              </p>
              {b.awardedAt && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-2">
                  Earned {new Date(b.awardedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
