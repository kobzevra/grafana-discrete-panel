import type { NormalizedInterval, PanelDiagnostic, ValidationResult } from '../types.ts';

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableObject(child)])
    );
  }
  return value;
}

function identityKey(row: NormalizedInterval): string {
  return JSON.stringify(
    stableObject({
      machineId: row.machineId,
      machineType: row.machineType ?? null,
      state: row.state,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      originalDurationMs: row.originalDurationMs,
      job: row.job ?? null,
      runId: row.runId ?? null,
      displayClassHint: row.displayClassHint ?? null,
      dimensions: row.dimensions,
      quality: row.quality ?? null,
      details: row.details ?? null,
    })
  );
}

function isValid(row: NormalizedInterval): boolean {
  if (!row.machineId || !Number.isFinite(row.startedAt)) {
    return false;
  }
  if (row.endedAt !== null && (!Number.isFinite(row.endedAt) || row.endedAt <= row.startedAt)) {
    return false;
  }
  if (row.originalDurationMs !== null && (!Number.isFinite(row.originalDurationMs) || row.originalDurationMs < 0)) {
    return false;
  }
  return true;
}

export function validateIntervals(rows: readonly NormalizedInterval[]): ValidationResult {
  const diagnostics: PanelDiagnostic[] = [];
  const unique: NormalizedInterval[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!isValid(row)) {
      diagnostics.push({
        code: 'invalid-interval',
        severity: 'warning',
        message: `Invalid interval for machine ${row.machineId || '<missing>'}`,
        machineId: row.machineId || undefined,
      });
      continue;
    }
    const key = identityKey(row);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }

  const byMachine = new Map<string, NormalizedInterval[]>();
  for (const row of unique) {
    const group = byMachine.get(row.machineId) ?? [];
    group.push(row);
    byMachine.set(row.machineId, group);
  }

  let hasConflicts = false;
  for (const [machineId, group] of byMachine) {
    group.sort(
      (a, b) =>
        a.startedAt - b.startedAt ||
        (a.endedAt ?? Number.POSITIVE_INFINITY) - (b.endedAt ?? Number.POSITIVE_INFINITY)
    );
    let activeEnd = Number.NEGATIVE_INFINITY;
    for (const row of group) {
      if (row.startedAt < activeEnd) {
        hasConflicts = true;
        diagnostics.push({
          code: 'conflicting-overlap',
          severity: 'error',
          message: `Conflicting overlapping intervals for machine ${machineId}`,
          machineId,
        });
      }
      activeEnd = Math.max(activeEnd, row.endedAt ?? Number.POSITIVE_INFINITY);
    }
  }

  return { intervals: unique, diagnostics, hasConflicts };
}
