import type { DisplayInterval, DisplayKind, LegendEntry, LegendModel, TimelineRange } from '../types.ts';

interface Accumulator {
  key: string;
  label: string;
  kind: DisplayKind;
  duration: number;
  segments: number;
  runIds: Set<string>;
  hasMissingRunId: boolean;
}

export function buildLegend(
  rows: readonly DisplayInterval[],
  range: TimelineRange,
  machineIds: readonly string[],
  focusJob?: string
): LegendModel {
  const denominatorMs = Math.max(0, range.to - range.from) * machineIds.length;
  const map = new Map<string, Accumulator>();

  for (const row of rows) {
    const key = `${row.displayKind}:${row.displayLabel}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        key,
        label: row.displayLabel,
        kind: row.displayKind,
        duration: 0,
        segments: 0,
        runIds: new Set<string>(),
        hasMissingRunId: false,
      };
      map.set(key, acc);
    }

    acc.duration += row.visibleDurationMs;
    acc.segments += 1;
    if (row.runId?.trim()) {
      acc.runIds.add(row.runId.trim());
    } else if (row.displayKind !== 'state') {
      acc.hasMissingRunId = true;
    }
  }

  const toEntry = (acc: Accumulator): LegendEntry => ({
    key: acc.key,
    label: acc.label,
    kind: acc.kind,
    visibleDurationMs: acc.duration,
    percent: denominatorMs > 0 ? (acc.duration / denominatorMs) * 100 : 0,
    segmentCount: acc.segments,
    runCount: acc.kind === 'state' || acc.hasMissingRunId ? null : acc.runIds.size,
  });
  const entries = [...map.values()].map(toEntry);

  if (focusJob) {
    if (!entries.some((entry) => entry.kind === 'selected-job')) {
      entries.push({
        key: `selected-job:${focusJob}`,
        label: focusJob,
        kind: 'selected-job',
        visibleDurationMs: 0,
        percent: 0,
        segmentCount: 0,
        runCount: 0,
      });
    }
    if (!entries.some((entry) => entry.kind === 'other-jobs')) {
      entries.push({
        key: 'other-jobs:Other jobs',
        label: 'Other jobs',
        kind: 'other-jobs',
        visibleDurationMs: 0,
        percent: 0,
        segmentCount: 0,
        runCount: 0,
      });
    }
  }

  return {
    states: entries
      .filter((entry) => entry.kind === 'state')
      .sort((a, b) => b.visibleDurationMs - a.visibleDurationMs || a.label.localeCompare(b.label)),
    jobs: entries
      .filter((entry) => entry.kind !== 'state')
      .sort((a, b) => b.visibleDurationMs - a.visibleDurationMs || a.label.localeCompare(b.label)),
    denominatorMs,
  };
}
