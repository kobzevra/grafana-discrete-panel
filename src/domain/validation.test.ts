import { validateIntervals } from './validation';

const row = (overrides: Record<string, unknown> = {}) => ({ machineId: 'M1', state: 'idle', startedAt: 1000, endedAt: 2000, originalDurationMs: 1000, dimensions: { operator: 'Alice' }, ...overrides });

test('deduplicates exact rows but not different original durations', () => {
  expect(validateIntervals([row(), row()]).intervals).toHaveLength(1);
  const different = validateIntervals([row(), row({ originalDurationMs: 999 })]);
  expect(different.hasConflicts).toBe(true);
});

test('blocks non-identical overlapping primary intervals', () => {
  const result = validateIntervals([row(), row({ startedAt: 1500, endedAt: 2500, state: 'setup' })]);
  expect(result.hasConflicts).toBe(true);
  expect(result.diagnostics.some((x) => x.code === 'conflicting-overlap')).toBe(true);
});
