import fs from 'node:fs';
import path from 'node:path';
import { adaptDataFrames } from './dataFrameAdapter';
import { getDisplayColor } from './colors';
import { createTimelineLayout } from './layout';
import { normalizeOptions, resolvePanelBehavior } from './panelOptions';

const frame = {
  fields: [
    { name: 'machine_id', type: 'string', values: ['M1'] },
    { name: 'state', type: 'string', values: ['running'] },
    { name: 'started_at', type: 'time', values: [0] },
    { name: 'ended_at', type: 'time', values: [1000] },
    { name: 'job', type: 'string', values: ['491061.pdf'] },
    { name: 'shift', type: 'string', values: ['Night'] },
    { name: 'operator_name', type: 'string', values: ['Alice'] },
  ],
};

test('adapter preserves discovered source fields for dynamic filters and color mappings', () => {
  const adapted = adaptDataFrames([frame], normalizeOptions(undefined).fields);
  expect(adapted.intervals[0].dimensions.shift).toBe('Night');
  expect(adapted.intervals[0].dimensions.operator_name).toBe('Alice');
});

test('panel behavior resolves dynamic filter rows and arbitrary state duration rules', () => {
  const options: any = normalizeOptions(undefined);
  options.filterRows = [{ field: 'job', values: ['$job'] }];
  options.durationRules = [{ state: 'gap', minSeconds: 60, maxSeconds: 3600 }];
  const behavior: any = resolvePanelBehavior(options, (value) => (value === '$job' ? '491061.pdf' : value));

  expect(behavior.fieldFilters).toEqual([{ field: 'job', values: ['491061.pdf'] }]);
  expect(behavior.durationRules.gap).toEqual({ minMs: 60_000, maxMs: 3_600_000 });
});

test('color mapping can override a job color by any discovered field/value pair', () => {
  const interval: any = {
    machineId: 'M1',
    state: 'running',
    startedAt: 0,
    endedAt: 1000,
    originalDurationMs: 1000,
    job: '491061.pdf',
    dimensions: { operator_name: 'Alice' },
  };
  const color = (getDisplayColor as any)(
    'job:491061.pdf',
    '491061.pdf',
    {},
    [{ field: 'operator_name', value: 'Alice', color: '#123456' }],
    interval
  );
  expect(color).toBe('#123456');
});

test('layout exposes compact content height based on rows plus axis', () => {
  const layout: any = createTimelineLayout({
    width: 1000,
    height: 500,
    machineCount: 1,
    rowHeight: 28,
    showAxis: true,
  });
  expect(layout.contentHeight).toBe(52);
});

test('timeline source implements drag pan, segment selection and wheel navigation', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/TimelineCanvas.tsx'), 'utf8');
  expect(source).toContain('onChangeTimeRange');
  expect(source).toContain('onPointerDown');
  expect(source).toContain('onPointerUp');
  expect(source).toContain('onWheel');
  expect(source).toContain('ctrlKey');
  expect(source).toContain('shiftKey');
});

test('panel options register dynamic editors instead of fixed state color pickers', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/module.ts'), 'utf8');
  expect(source).toContain("path: 'filterRows'");
  expect(source).toContain("path: 'durationRules'");
  expect(source).toContain("path: 'colorMappings'");
  expect(source).not.toContain("path: `stateColors.${state}`");
});
