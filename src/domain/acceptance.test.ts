import { clipInterval, clipIntervals, computeCoverage, matchesDurationRule } from './intervals';
import { applyDimensionFilters } from './filters';
import { classifyIntervals, applyJobFocus } from './displayClasses';
import { getJobColor } from './colors';
import { buildLegend } from './legend';

const M = 60_000;
const H = 60 * M;
const range = { from: 8 * H + 45 * M, to: 10 * H + 30 * M };
const t = (hour: number, minute: number) => hour * H + minute * M;
const row = (start: number, end: number | null, state: string, job?: string, runId?: string) => ({
  machineId: 'M1', state, startedAt: start, endedAt: end,
  originalDurationMs: end == null ? null : end - start, job, runId, dimensions: {},
});

const base = classifyIntervals(clipIntervals([
  row(t(8, 30), t(9, 20), 'running', 'Job A', 'run-a'),
  row(t(9, 20), t(9, 35), 'paused', undefined, 'run-a'),
  row(t(9, 35), t(10, 10), 'running', 'Job A', 'run-a'),
  row(t(10, 10), t(11, 0), 'running', 'Job B', 'run-b'),
], range, range.to));

describe('Production Timeline T01-T14 acceptance semantics', () => {
  test('T01 range starts inside job', () => {
    const v = clipInterval(row(t(8, 30), t(9, 20), 'running', 'Job A'), range, range.to)!;
    expect(v.visibleStart).toBe(range.from); expect(v.visibleDurationMs).toBe(35 * M);
  });
  test('T02 range ends inside job', () => {
    const v = clipInterval(row(t(10, 10), t(11, 0), 'running', 'Job B'), range, range.to)!;
    expect(v.visibleEnd).toBe(range.to); expect(v.visibleDurationMs).toBe(20 * M);
  });
  test('T03 crosses both boundaries', () => {
    const v = clipInterval(row(t(6, 0), t(18, 0), 'idle'), range, range.to)!;
    expect(v.visibleDurationMs).toBe(range.to - range.from); expect(v.effectiveOriginalDurationMs).toBe(12 * H);
  });
  test('T04 interrupted job remains separate with same job identity', () => {
    expect(base.map((x) => x.displayLabel)).toEqual(['Job A', 'paused', 'Job A', 'Job B']);
    expect(base[0].displayClass).toBe(base[2].displayClass);
  });
  test('T05 focus keeps states and groups other jobs', () => {
    const f = applyJobFocus(base, 'Job A').intervals;
    expect(f.map((x) => x.displayKind)).toEqual(['selected-job', 'state', 'selected-job', 'other-jobs']);
  });
  test('T06 focus legend separates selected and Other jobs', () => {
    const l = buildLegend(applyJobFocus(base, 'Job A').intervals, range, ['M1']);
    expect(l.jobs.find((x) => x.kind === 'selected-job')?.visibleDurationMs).toBe(70 * M);
    expect(l.jobs.find((x) => x.kind === 'other-jobs')?.visibleDurationMs).toBe(20 * M);
  });
  test('T07 duration filter uses original duration, legend contribution remains visible', () => {
    const shortRange = { from: t(8, 35), to: t(8, 45) };
    const v = clipInterval(row(t(8, 0), t(8, 40), 'idle'), shortRange, shortRange.to)!;
    expect(matchesDurationRule(v, { minMs: 30 * M })).toBe(true); expect(v.visibleDurationMs).toBe(5 * M);
  });
  test('T08 common dimensions filter', () => {
    const rows = clipIntervals([{ ...row(0, 10 * M, 'running', 'A'), dimensions: { operator: 'Alice', material: 'Vinyl', customer: 'C', manager: 'M' } }], { from: 0, to: 20 * M }, 20 * M);
    expect(applyDimensionFilters(rows, { operator: ['Alice'], material: ['Vinyl'], customer: ['C'], manager: ['M'] })).toHaveLength(1);
  });
  test('T09 printer dimensions filter', () => {
    const rows = clipIntervals([{ ...row(0, 10 * M, 'running', 'A'), dimensions: { color_profile: 'ISO', print_mode: 'Quality', drop_size: '7pl' } }], { from: 0, to: 20 * M }, 20 * M);
    expect(applyDimensionFilters(rows, { color_profile: ['ISO'], print_mode: ['Quality'], drop_size: ['7pl'] })).toHaveLength(1);
  });
  test('T10 cutter dimensions filter', () => {
    const rows = clipIntervals([{ ...row(0, 10 * M, 'running', 'A'), dimensions: { tool: 'Knife', preset: 'Fast', commanded_speed: 500 } }], { from: 0, to: 20 * M }, 20 * M);
    expect(applyDimensionFilters(rows, { tool: ['Knife'], preset: ['Fast'], commanded_speed: ['500'] })).toHaveLength(1);
  });
  test('T11 stable deterministic job colors', () => { expect(getJobColor('Job A')).toBe(getJobColor('Job A')); });
  test('T12 legend equals visible geometry', () => {
    const l = buildLegend(base, range, ['M1']);
    const total = [...l.jobs, ...l.states].reduce((sum, x) => sum + x.visibleDurationMs, 0);
    expect(total).toBe(range.to - range.from);
  });
  test('T13 gap is not Idle', () => {
    const g = classifyIntervals(clipIntervals([row(t(9, 0), t(9, 5), 'gap')], range, range.to));
    expect(g[0].displayClass).toBe('gap');
  });
  test('T14 reload semantics are stable', () => {
    const a = buildLegend(classifyIntervals(clipIntervals(base, range, range.to)), range, ['M1']);
    const b = buildLegend(classifyIntervals(clipIntervals(base, range, range.to)), range, ['M1']);
    expect(b).toEqual(a); expect(getJobColor('Job A')).toBe(getJobColor('Job A'));
  });
});

test('source no-data is computed before non-machine filters', () => {
  const r = { from: 0, to: 60 * M };
  const source = clipIntervals([row(0, 30 * M, 'idle')], r, r.to);
  expect(computeCoverage(source, ['M1'], r)).toEqual([{ machineId: 'M1', start: 30 * M, end: 60 * M, durationMs: 30 * M }]);
});
