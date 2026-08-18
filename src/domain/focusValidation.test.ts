import { buildTimelineModel } from './pipeline';

const M = 60_000;
const range = { from: 0, to: 60 * M };
const mappings = {
  machineId: 'machine_id',
  state: 'state',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  job: 'job',
};

test('job focus blocks exact output when the mapped job field is unavailable', () => {
  const frame = {
    fields: [
      { name: 'machine_id', type: 'string', values: ['M1'] },
      { name: 'state', type: 'string', values: ['running'] },
      { name: 'started_at', type: 'time', values: [0] },
      { name: 'ended_at', type: 'time', values: [10 * M] },
    ],
    length: 1,
  };
  const model = buildTimelineModel({
    frames: [frame],
    mappings,
    range,
    nowMs: range.to,
    dimensionFilters: {},
    durationRules: {},
    focusJob: 'Job A',
  });

  expect(model.blocked).toBe(true);
  expect(model.diagnostics.some((diagnostic) => diagnostic.code === 'job-focus-field-absent')).toBe(true);
});
