import type { DimensionFilters, DimensionKey, DurationRules, VisibleInterval } from '../types.ts';
import { matchesDurationRule } from './intervals.ts';

function valueFor(row: VisibleInterval, key: DimensionKey): unknown {
  switch (key) {
    case 'machine': return row.machineId;
    case 'job': return row.job;
    default: return row.dimensions[key];
  }
}

export function applyDimensionFilters(rows: readonly VisibleInterval[], filters: DimensionFilters): VisibleInterval[] {
  const active = Object.entries(filters).filter(([, selected]) => selected && selected.length > 0) as Array<[DimensionKey, readonly string[]]>;
  if (active.length === 0) return [...rows];
  return rows.filter((row) => active.every(([key, selected]) => {
    const value = valueFor(row, key);
    if (value === undefined || value === null) return false;
    return selected.includes(String(value));
  }));
}

export function applyDurationRules(rows: readonly VisibleInterval[], rules: DurationRules): VisibleInterval[] {
  return rows.filter((row) => matchesDurationRule(row, rules[row.state.trim().toLowerCase()]));
}
