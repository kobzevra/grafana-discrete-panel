import { adaptDataFrames } from './dataFrameAdapter';

const mappings = { machineId: 'machine_id', state: 'state', startedAt: 'started_at', endedAt: 'ended_at', originalDuration: 'duration_ms', job: 'job', colorProfile: 'color_profile' };
const frame = (fields: Array<{ name: string; type: string; values: unknown[] }>) => ({ fields, length: fields[0]?.values.length ?? 0 });

test('maps public Grafana DataFrame-shaped fields by configured names', () => {
  const result = adaptDataFrames([frame([
    { name: 'machine_id', type: 'string', values: ['P1'] }, { name: 'state', type: 'string', values: ['running'] },
    { name: 'started_at', type: 'time', values: [1000] }, { name: 'ended_at', type: 'time', values: [2000] },
    { name: 'duration_ms', type: 'number', values: [1000] }, { name: 'job', type: 'string', values: ['A'] },
    { name: 'color_profile', type: 'string', values: ['ISO'] },
  ])], mappings);
  expect(result.intervals[0]).toMatchObject({ machineId: 'P1', startedAt: 1000, endedAt: 2000, originalDurationMs: 1000, job: 'A' });
  expect(result.intervals[0].dimensions.color_profile).toBe('ISO');
});

test('does not guess number fields to be timestamps', () => {
  const result = adaptDataFrames([frame([
    { name: 'machine_id', type: 'string', values: ['P1'] }, { name: 'state', type: 'string', values: ['idle'] },
    { name: 'started_at', type: 'number', values: [1000] }, { name: 'ended_at', type: 'number', values: [2000] },
  ])], mappings);
  expect(result.intervals).toHaveLength(0); expect(result.diagnostics.some((x) => x.code === 'invalid-timestamp')).toBe(true);
});
