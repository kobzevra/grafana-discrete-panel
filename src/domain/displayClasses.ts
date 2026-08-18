import type { DisplayInterval, FocusResult, VisibleInterval } from '../types.ts';

const FIXED_STATES = new Set(['offline','idle','setup','ready','queued','paused','blocked','error','maintenance','unknown','gap','stale']);
const RESERVED_HINTS = new Set(['gap', 'stale', 'unknown', 'offline']);
const normalize = (value: string | undefined) => (value ?? '').trim().toLowerCase();

export function classifyInterval(row: VisibleInterval): DisplayInterval {
  const hint = normalize(row.displayClassHint);
  if (RESERVED_HINTS.has(hint)) return { ...row, displayClass: hint, displayKind: 'state', displayLabel: hint };
  const state = normalize(row.state);
  const job = row.job?.trim();
  if (state === 'running') {
    if (job) return { ...row, job, displayClass: `job:${job}`, displayKind: 'job', displayLabel: job };
    return { ...row, displayClass: 'running-unresolved', displayKind: 'state', displayLabel: 'running-unresolved' };
  }
  const fixed = FIXED_STATES.has(state) ? state : 'unknown';
  return { ...row, displayClass: fixed, displayKind: 'state', displayLabel: fixed };
}

export const classifyIntervals = (rows: readonly VisibleInterval[]) => rows.map(classifyInterval);

export function applyJobFocus(rows: readonly DisplayInterval[], selectedJob?: string): FocusResult {
  const selected = selectedJob?.trim();
  if (!selected) return { intervals: [...rows] };
  return { selectedJob: selected, intervals: rows.map((row) => {
    if (row.displayKind !== 'job') return row;
    if (row.job?.trim() === selected) return { ...row, displayClass: 'selected-job', displayKind: 'selected-job' as const, displayLabel: selected };
    return { ...row, displayClass: 'other-jobs', displayKind: 'other-jobs' as const, displayLabel: 'Other jobs' };
  }) };
}
