import { buildTimelineModel } from './pipeline';

const M = 60_000;
const range = { from: 0, to: 60 * M };
const mappings = { machineId: 'machine_id', state: 'state', startedAt: 'started_at', endedAt: 'ended_at', job: 'job', runId: 'run_id', operator: 'operator' };
function frame(rows: Array<Record<string, unknown>>) {
  const names = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { fields: names.map((name) => ({ name, type: name.endsWith('_at') ? 'time' : typeof rows.find((r) => r[name] != null)?.[name] === 'number' ? 'number' : 'string', values: rows.map((r) => r[name] ?? null) })), length: rows.length };
}

test('pipeline uses machine selection before coverage and focus after filters', () => {
  const data = frame([
    { machine_id: 'M1', state: 'running', started_at: 0, ended_at: 20*M, job: 'A', run_id: 'r1', operator: 'Alice' },
    { machine_id: 'M1', state: 'paused', started_at: 20*M, ended_at: 30*M, run_id: 'r1' },
    { machine_id: 'M1', state: 'running', started_at: 30*M, ended_at: 50*M, job: 'B', run_id: 'r2' },
    { machine_id: 'M2', state: 'idle', started_at: 0, ended_at: 60*M },
  ]);
  const model = buildTimelineModel({ frames: [data], mappings, range, nowMs: range.to, dimensionFilters: { machine: ['M1'] }, durationRules: {}, focusJob: 'A' });
  expect(model.machineIds).toEqual(['M1']);
  expect(model.noData.map((x) => [x.start, x.end])).toEqual([[50*M, 60*M]]);
  expect(model.intervals.some((x) => x.displayKind === 'selected-job')).toBe(true);
  expect(model.intervals.some((x) => x.displayKind === 'other-jobs')).toBe(true);
  expect(model.intervals.some((x) => x.displayClass === 'paused')).toBe(true);
});

test('pipeline refuses exact totals for conflicting overlaps', () => {
  const data = frame([{ machine_id: 'M1', state: 'idle', started_at: 0, ended_at: 30*M }, { machine_id: 'M1', state: 'setup', started_at: 20*M, ended_at: 40*M }]);
  const model = buildTimelineModel({ frames: [data], mappings, range, nowMs: range.to, dimensionFilters: {}, durationRules: {} });
  expect(model.blocked).toBe(true); expect(model.legend).toBeNull();
});

test('selected machine with no source row is rendered as full-range no-data', () => {
  const data = frame([{ machine_id: 'M1', state: 'idle', started_at: 0, ended_at: 60*M }]);
  const model = buildTimelineModel({
    frames: [data], mappings, range, nowMs: range.to,
    dimensionFilters: { machine: ['M2'] }, durationRules: {},
  });
  expect(model.machineIds).toEqual(['M2']);
  expect(model.noData).toEqual([{ machineId: 'M2', start: range.from, end: range.to, durationMs: range.to - range.from }]);
});

test('requested machine remains visible as no-data when no source intervals overlap range', () => {
  const outside = frame([{ machine_id: 'M1', state: 'idle', started_at: 120*M, ended_at: 180*M }]);
  const model = buildTimelineModel({
    frames: [outside], mappings, range, nowMs: range.to,
    dimensionFilters: { machine: ['M2'] }, durationRules: {},
  });
  expect(model.machineIds).toEqual(['M2']);
  expect(model.noData).toEqual([{ machineId: 'M2', start: range.from, end: range.to, durationMs: range.to - range.from }]);
  expect(model.diagnostics.some((diagnostic) => diagnostic.code === 'no-source-data')).toBe(true);
});
