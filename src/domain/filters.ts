import type { DimensionFilters, DimensionKey, DurationRules, FieldFilterRule, VisibleInterval } from '../types.ts';
import { matchesDurationRule } from './intervals.ts';

export function valueForField(row: VisibleInterval, key: string): unknown {
  switch (key) {
    case 'machine':
    case 'machine_id':
      return row.machineId;
    case 'state':
      return row.state;
    case 'job':
      return row.job;
    case 'run_id':
      return row.runId;
    case 'machine_type':
      return row.machineType;
    case 'quality':
      return row.quality;
    case 'details':
      return row.details;
    default:
      return row.dimensions[key];
  }
}

function valueFor(row: VisibleInterval, key: DimensionKey): unknown {
  return valueForField(row, key);
}

export function applyDimensionFilters(
  rows: readonly VisibleInterval[],
  filters: DimensionFilters
): VisibleInterval[] {
  const active = Object.entries(filters).filter(([, selected]) => selected && selected.length > 0) as Array<
    [DimensionKey, readonly string[]]
  >;
  if (active.length === 0) {
    return [...rows];
  }

  return rows.filter((row) =>
    active.every(([key, selected]) => {
      const value = valueFor(row, key);
      if (value === undefined || value === null) {
        return false;
      }
      return selected.includes(String(value));
    })
  );
}

export function applyFieldFilters(rows: readonly VisibleInterval[], rules: readonly FieldFilterRule[]): VisibleInterval[] {
  const active = rules.filter((rule) => rule.field.trim() && rule.values.length > 0);
  if (active.length === 0) {
    return [...rows];
  }
  return rows.filter((row) =>
    active.every((rule) => {
      const value = valueForField(row, rule.field.trim());
      return value !== undefined && value !== null && rule.values.includes(String(value));
    })
  );
}

export function applyDurationRules(
  rows: readonly VisibleInterval[],
  rules: DurationRules
): VisibleInterval[] {
  return rows.filter((row) => matchesDurationRule(row, rules[row.state.trim().toLowerCase()]));
}
