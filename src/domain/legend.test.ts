import { buildLegend } from './legend';
import { applyJobFocus, classifyIntervals } from './displayClasses';
import { clipIntervals } from './intervals';

const M = 60_000;
const range = { from: 0, to: 60 * M };

function row(start: number, end: number, state: string, job?: string, runId?: string) {
  return {
    machineId: 'M1',
    state,
    startedAt: start,
    endedAt: end,
    originalDurationMs: end - start,
    job,
    runId,
    dimensions: {},
  };
}

test('focus legend explicitly retains Selected and Other jobs buckets even when one is zero', () => {
  const focused = applyJobFocus(
    classifyIntervals(clipIntervals([row(0, 20 * M, 'running', 'Job A', 'run-a')], range, range.to)),
    'Job A'
  ).intervals;
  const legend = buildLegend(focused, range, ['M1'], 'Job A');
  const selected = legend.jobs.find((entry) => entry.kind === 'selected-job');
  const other = legend.jobs.find((entry) => entry.kind === 'other-jobs');

  expect(selected?.visibleDurationMs).toBe(20 * M);
  expect(other?.visibleDurationMs).toBe(0);
  expect(other?.segmentCount).toBe(0);
});
