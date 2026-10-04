import React, { useState } from 'react';
import { Sparkles, Copy, Check, X, ShieldAlert, Edit3 } from 'lucide-react';
import { api } from '../../lib/api';

interface AiFeedbackModalProps {
  traineeId: string;
  traineeName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AiFeedbackModal: React.FC<AiFeedbackModalProps> = ({
  traineeId,
  traineeName,
  isOpen,
  onClose,
}) => {
  const [draftText, setDraftText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateDraft = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<{
        data: {
          draftText: string;
          provider: 'gemini' | 'rule_based_template';
          isAiGenerated: boolean;
          disclaimer: string;
        };
      }>('/api/v1/ai/feedback-draft', { traineeId });

      setDraftText(res.data.draftText);
      setProvider(res.data.provider);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate feedback draft');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      generateDraft();
    } else {
      setDraftText('');
      setCopied(false);
      setError(null);
    }
  }, [isOpen, traineeId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-draft-title"
    >
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border-main)] rounded-xl shadow-2xl overflow-hidden flex flex-col space-y-4 p-5 animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="ai-draft-title" className="text-sm font-bold text-[var(--text-main)]">
                Feedback Draft for {traineeName}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Generated strictly from anonymized metrics & scores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mandatory Label Badge */}
        <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3 py-2 rounded-lg text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold">AI draft: review before sharing</span>
          </div>
          <span className="text-[10px] text-amber-700 dark:text-amber-400 capitalize">
            Engine: {provider === 'gemini' ? 'Gemini 3.8 Flash' : 'Deterministic Template'}
          </span>
        </div>

        {/* Body / Editable textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-main)] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Editable Trainer Feedback</span>
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {draftText.length} characters
            </span>
          </label>

          {isLoading ? (
            <div className="h-36 flex flex-col items-center justify-center space-y-2 bg-[var(--background)] rounded-lg border border-[var(--border-main)]">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--text-muted)]">
                Computing performance trajectory and synthesizing feedback...
              </span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs">{error}</div>
          ) : (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={5}
              className="w-full text-xs font-medium leading-relaxed bg-[var(--background)] text-[var(--text-main)] border border-[var(--border-main)] rounded-lg p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] resize-y"
              placeholder="Feedback content..."
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)]">
          <button
            type="button"
            onClick={generateDraft}
            disabled={isLoading}
            className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-50"
          >
            Regenerate Draft
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--background)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={isLoading || !draftText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Feedback</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
