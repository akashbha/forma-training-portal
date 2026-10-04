import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  title?: string;
  content: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, content }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-[var(--text-muted)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] rounded-full p-0.5"
        aria-label={title ? `${title}: ${content}` : content}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900 text-slate-100 text-[11px] leading-relaxed rounded-md shadow-xl border border-slate-800 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
        >
          {title && <div className="font-semibold text-white mb-1 border-b border-slate-800 pb-1">{title}</div>}
          <div>{content}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
