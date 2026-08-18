import type { CoverageRegion, DurationRule, NormalizedInterval, TimelineRange, VisibleInterval } from '../types.ts';

export function clipInterval(
  row: NormalizedInterval,
  range: TimelineRange,
  nowMs: number
): VisibleInterval | null {
  const isOpen = row.endedAt === null;
  const effectiveEnd = isOpen ? Math.min(range.to, nowMs) : row.endedAt;

  if (effectiveEnd === null || row.startedAt >= range.to || effectiveEnd <= range.from) {
    return null;
  }

  const visibleStart = Math.max(row.startedAt, range.from);
  const visibleEnd = Math.min(effectiveEnd, range.to);
  if (visibleEnd <= visibleStart) {
    return null;
  }

  const effectiveOriginalDurationMs =
    row.originalDurationMs !== null && row.originalDurationMs >= 0
      ? row.originalDurationMs
      : Math.max(0, effectiveEnd - row.startedAt);

  return {
    ...row,
    visibleStart,
    visibleEnd,
    visibleDurationMs: visibleEnd - visibleStart,
    effectiveOriginalDurationMs,
    isOpen,
  };
}

export function clipIntervals(
  rows: readonly NormalizedInterval[],
  range: TimelineRange,
  nowMs: number
): VisibleInterval[] {
  const result: VisibleInterval[] = [];
  for (const row of rows) {
    const clipped = clipInterval(row, range, nowMs);
    if (clipped) {
      result.push(clipped);
    }
  }
  return result;
}

export function matchesDurationRule(row: VisibleInterval, rule?: DurationRule): boolean {
  if (!rule) {
    return true;
  }
  if (rule.minMs !== undefined && row.effectiveOriginalDurationMs < rule.minMs) {
    return false;
  }
  if (rule.maxMs !== undefined && row.effectiveOriginalDurationMs > rule.maxMs) {
    return false;
  }
  return true;
}

export function computeCoverage(
  rows: readonly VisibleInterval[],
  machineIds: readonly string[],
  range: TimelineRange
): CoverageRegion[] {
  const gaps: CoverageRegion[] = [];
  for (const machineId of machineIds) {
    const spans = rows
      .filter((row) => row.machineId === machineId)
      .map((row) => [Math.max(range.from, row.visibleStart), Math.min(range.to, row.visibleEnd)] as const)
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    let cursor = range.from;
    for (const [start, end] of spans) {
      if (start > cursor) {
        gaps.push({ machineId, start: cursor, end: start, durationMs: start - cursor });
      }
      cursor = Math.max(cursor, end);
      if (cursor >= range.to) {
        break;
      }
    }
    if (cursor < range.to) {
      gaps.push({ machineId, start: cursor, end: range.to, durationMs: range.to - cursor });
    }
  }
  return gaps;
}
