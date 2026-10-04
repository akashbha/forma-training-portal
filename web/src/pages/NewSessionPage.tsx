import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Clipboard, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { FormField, Input, Select } from '../components/ui/FormField';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Batch, Topic, Trainee, AttendanceStatus } from '../types/api';
import { useAuth } from '../context/AuthContext';

interface TraineeInputRow {
  traineeId: string;
  name: string;
  email: string;
  attendance: AttendanceStatus;
  score: string;
  errors: string;
  minutes: string;
  notes: string;
}

export const NewSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isTrainee } = useAuth();

  // Redirect if Trainee role
  useEffect(() => {
    if (isTrainee) {
      navigate('/');
    }
  }, [isTrainee, navigate]);

  // Session metadata state
  const [batchId, setBatchId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [heldOn, setHeldOn] = useState(new Date().toISOString().slice(0, 10));
  const [passMark, setPassMark] = useState(70);

  // Trainee results & attendance grid state
  const [traineeRows, setTraineeRows] = useState<TraineeInputRow[]>([]);
  const [gridErrors, setGridErrors] = useState<Record<string, { score?: string; errors?: string; minutes?: string }>>({});

  // 1. Fetch Batches
  const { data: batchesData } = useQuery({
    queryKey: ['batches-new-session'],
    queryFn: () => api.get<{ data: Batch[] }>('/api/v1/batches?limit=50'),
  });

  // 2. Fetch Topics
  const { data: topicsData } = useQuery({
    queryKey: ['topics-new-session'],
    queryFn: () => api.get<{ data: Topic[] }>('/api/v1/topics'),
  });

  // 3. Fetch Trainees when batchId changes
  const { data: traineesData, isLoading: isTraineesLoading } = useQuery({
    queryKey: ['batch-trainees', batchId],
    queryFn: () => api.get<{ data: Trainee[] }>(`/api/v1/trainees?batchId=${batchId}&limit=100`),
    enabled: Boolean(batchId),
  });

  const batches = batchesData?.data || [];
  const topics = topicsData?.data || [];

  // Set default batch and topic
  useEffect(() => {
    if (batches.length > 0 && !batchId) {
      setBatchId(batches[0].id);
    }
  }, [batches, batchId]);

  useEffect(() => {
    if (topics.length > 0 && !topicId) {
      setTopicId(topics[0].id);
    }
  }, [topics, topicId]);

  // Initialize trainee rows when trainees are fetched
  useEffect(() => {
    if (traineesData?.data) {
      setTraineeRows(
        traineesData.data.map((t) => ({
          traineeId: t.id,
          name: t.name,
          email: t.email,
          attendance: 'PRESENT' as AttendanceStatus,
          score: '80',
          errors: '2',
          minutes: '35',
          notes: '',
        }))
      );
    }
  }, [traineesData]);

  // Handle cell value changes
  const handleCellChange = (
    traineeId: string,
    field: keyof TraineeInputRow,
    value: string
  ) => {
    setTraineeRows((prev) =>
      prev.map((row) => (row.traineeId === traineeId ? { ...row, [field]: value } : row))
    );

    // Dynamic field validation
    if (field === 'score' || field === 'errors' || field === 'minutes') {
      validateField(traineeId, field, value);
    }
  };

  const validateField = (traineeId: string, field: 'score' | 'errors' | 'minutes', value: string) => {
    setGridErrors((prev) => {
      const current = { ...(prev[traineeId] || {}) };

      if (field === 'score') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 100) {
          current.score = '0–100';
        } else {
          delete current.score;
        }
      }

      if (field === 'errors') {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0) {
          current.errors = '≥0';
        } else {
          delete current.errors;
        }
      }

      if (field === 'minutes') {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          current.minutes = '>0';
        } else {
          delete current.minutes;
        }
      }

      if (Object.keys(current).length === 0) {
        const copy = { ...prev };
        delete copy[traineeId];
        return copy;
      }

      return { ...prev, [traineeId]: current };
    });
  };

  // Spreadsheet paste handler
  const handleSpreadsheetPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const lines = pasteData.trim().split(/\r\n|\n|\r/);
    setTraineeRows((prev) => {
      return prev.map((row, idx) => {
        if (idx >= lines.length) return row;
        const cols = lines[idx].split('\t').map((c) => c.trim());
        if (cols.length === 0) return row;

        return {
          ...row,
          score: cols[0] || row.score,
          errors: cols[1] || row.errors,
          minutes: cols[2] || row.minutes,
          notes: cols[3] || row.notes,
        };
      });
    });

    showToast({ type: 'info', message: `Pasted marks for up to ${lines.length} trainees` });
  };

  // Mutation to create Session + Results + Attendance
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error('Please provide a session title.');
      }
      if (!batchId || !topicId) {
        throw new Error('Please select both a batch and curriculum topic.');
      }

      // 1. Create Session
      const sessionRes = await api.post<{ data: { id: string } }>('/api/v1/sessions', {
        batchId,
        topicId,
        title: title.trim(),
        heldOn: new Date(heldOn).toISOString(),
        passMark: Number(passMark),
      });

      const newSessionId = sessionRes.data.id;

      // 2. Bulk create attendance
      const attendancePayload = traineeRows.map((row) => ({
        traineeId: row.traineeId,
        status: row.attendance,
        notes: row.notes.trim() || null,
      }));

      if (attendancePayload.length > 0) {
        await api.post('/api/v1/attendance/bulk', {
          sessionId: newSessionId,
          attendances: attendancePayload,
        });
      }

      // 3. Bulk create results
      const resultsPayload = traineeRows.map((row) => ({
        traineeId: row.traineeId,
        score: parseFloat(row.score) || 0,
        errors: parseInt(row.errors, 10) || 0,
        timeSeconds: (parseFloat(row.minutes) || 30) * 60,
        notes: row.notes.trim() || null,
      }));

      if (resultsPayload.length > 0) {
        await api.post('/api/v1/results/bulk', {
          sessionId: newSessionId,
          results: resultsPayload,
        });
      }

      return newSessionId;
    },
    onSuccess: (newSessionId) => {
      showToast({ type: 'success', message: 'Session, results, and attendance recorded successfully.' });
      navigate(`/sessions/${newSessionId}`);
    },
    onError: (err: any) => {
      showToast({ type: 'error', message: err?.message || 'Failed to create session.' });
    },
  });

  const hasValidationErrors = Object.keys(gridErrors).length > 0;

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/sessions')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded py-1 px-1 -ml-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sessions
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Record Training Session & Attendance
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Configure session metadata and record attendance and evaluation marks for all enrolled cohort members.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => createSessionMutation.mutate()}
          isLoading={createSessionMutation.isPending}
          disabled={hasValidationErrors || !title.trim() || traineeRows.length === 0}
          className="gap-2 shadow-xs"
        >
          <Save className="w-4 h-4" />
          Save Session & Results
        </Button>
      </div>

      {/* 1. Session Setup Form Card */}
      <div className="card-flat p-6 bg-[var(--surface)] space-y-4">
        <h2 className="text-base font-semibold text-[var(--text-main)] pb-2 border-b border-[var(--border-main)]">
          1. Session Configuration
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Training Batch" required>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Curriculum Topic" required>
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Held On Date" required>
            <Input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="sm:col-span-2">
            <FormField label="Session Title" required hint="e.g. Session 09: System Architecture & Testing">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter descriptive session title..."
              />
            </FormField>
          </div>

          <FormField label="Pass Mark Baseline (%)" required>
            <Input
              type="number"
              min="0"
              max="100"
              value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
            />
          </FormField>
        </div>
      </div>

      {/* 2. Trainee Evaluation & Attendance Grid Card */}
      <div className="card-flat p-6 bg-[var(--surface)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--border-main)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-main)] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--primary)]" />
              2. Trainee Attendance & Evaluation Marks ({traineeRows.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Select attendance status, scores, error counts, and completion durations.
            </p>
          </div>

          {/* Quick Spreadsheet Paste Helper Box */}
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button
                type="button"
                className="text-xs font-medium text-[var(--primary)] bg-[var(--primary-soft)] px-2.5 py-1.5 rounded-[6px] inline-flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Paste from Spreadsheet
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-20 w-72 p-3 bg-[var(--surface)] border border-[var(--border-main)] rounded-[8px] shadow-lg text-xs space-y-2">
                <p className="font-semibold text-[var(--text-main)]">Spreadsheet Paste Box</p>
                <p className="text-[var(--text-muted)] text-[11px]">
                  Copy columns (Score, Errors, Minutes, Notes) from Excel or Sheets and paste below:
                </p>
                <textarea
                  rows={2}
                  onPaste={handleSpreadsheetPaste}
                  placeholder="Paste TSV/CSV text here..."
                  className="w-full text-xs p-2 border border-[var(--border-main)] rounded"
                />
              </div>
            </div>
          </div>
        </div>

        {isTraineesLoading ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            Loading batch trainees...
          </div>
        ) : traineeRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            No trainees found in this batch. Please select another batch.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--border-main)] rounded-[8px]">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-[var(--border-main)] text-xs text-[var(--text-muted)] font-semibold">
                <tr>
                  <th className="py-2.5 px-3 min-w-[160px]">Trainee</th>
                  <th className="py-2.5 px-3 w-32">Attendance</th>
                  <th className="py-2.5 px-3 w-28">Score (0–100)</th>
                  <th className="py-2.5 px-3 w-24">Errors (&ge;0)</th>
                  <th className="py-2.5 px-3 w-28">Duration (min)</th>
                  <th className="py-2.5 px-3">Evaluator Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)] bg-[var(--surface)]">
                {traineeRows.map((row) => {
                  const errs = gridErrors[row.traineeId];
                  return (
                    <tr key={row.traineeId} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-xs text-[var(--text-main)]">{row.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{row.email}</div>
                      </td>

                      <td className="py-2 px-3">
                        <select
                          value={row.attendance}
                          onChange={(e) =>
                            handleCellChange(row.traineeId, 'attendance', e.target.value as AttendanceStatus)
                          }
                          className="w-28 h-8 text-xs font-semibold rounded border border-[var(--border)] px-2 bg-white"
                        >
                          <option value="PRESENT">🟢 Present</option>
                          <option value="LATE">🟡 Late</option>
                          <option value="ABSENT">🔴 Absent</option>
                          <option value="EXCUSED">⚪ Excused</option>
                        </select>
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={row.score}
                          hasError={Boolean(errs?.score)}
                          onChange={(e) => handleCellChange(row.traineeId, 'score', e.target.value)}
                          className="w-24 text-right h-8 text-xs font-mono"
                        />
                        {errs?.score && (
                          <p className="text-[10px] text-[var(--danger)] font-medium mt-0.5">{errs.score}</p>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min="0"
                          value={row.errors}
                          hasError={Boolean(errs?.errors)}
                          onChange={(e) => handleCellChange(row.traineeId, 'errors', e.target.value)}
                          className="w-20 text-right h-8 text-xs font-mono"
                        />
                        {errs?.errors && (
                          <p className="text-[10px] text-[var(--danger)] font-medium mt-0.5">{errs.errors}</p>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min="1"
                          value={row.minutes}
                          hasError={Boolean(errs?.minutes)}
                          onChange={(e) => handleCellChange(row.traineeId, 'minutes', e.target.value)}
                          className="w-24 text-right h-8 text-xs font-mono"
                        />
                        {errs?.minutes && (
                          <p className="text-[10px] text-[var(--danger)] font-medium mt-0.5">{errs.minutes}</p>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="text"
                          value={row.notes}
                          onChange={(e) => handleCellChange(row.traineeId, 'notes', e.target.value)}
                          placeholder="Optional feedback notes..."
                          className="w-full h-8 text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => navigate('/sessions')}
          disabled={createSessionMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => createSessionMutation.mutate()}
          isLoading={createSessionMutation.isPending}
          disabled={hasValidationErrors || !title.trim() || traineeRows.length === 0}
          className="gap-2 shadow-xs"
        >
          <Save className="w-4 h-4" />
          Save Session & Results
        </Button>
      </div>
    </div>
  );
};
