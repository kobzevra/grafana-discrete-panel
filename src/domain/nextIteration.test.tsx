import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { adaptDataFrames } from './dataFrameAdapter';
import { getDisplayColor } from './colors';
import { createTimelineLayout } from './layout';
import { normalizeOptions, resolvePanelBehavior } from './panelOptions';
import { TimelineCanvas } from '../components/TimelineCanvas';
import { plugin } from '../module';

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

function canvasContextStub() {
  return {
    setTransform: jest.fn(), clearRect: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
    stroke: jest.fn(), fillText: jest.fn(), fillRect: jest.fn(), save: jest.fn(), rect: jest.fn(), clip: jest.fn(),
    restore: jest.fn(), strokeRect: jest.fn(),
    font: '', textBaseline: '', strokeStyle: '', fillStyle: '', textAlign: '', globalAlpha: 1,
  } as any;
}

test('mouse wheel pans the dashboard time range', () => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: jest.fn(() => canvasContextStub()),
  });
  const onChangeTimeRange = jest.fn();
  const interval: any = {
    machineId: 'M1', state: 'running', startedAt: 0, endedAt: 1000, originalDurationMs: 1000,
    job: 'A', dimensions: {}, visibleStart: 0, visibleEnd: 1000, visibleDurationMs: 1000,
    effectiveOriginalDurationMs: 1000, isOpen: false, displayClass: 'job:A', displayKind: 'job', displayLabel: 'A',
  };
  const { getByRole } = render(
    React.createElement(TimelineCanvas as any, {
      intervals: [interval], noData: [], machineIds: ['M1'], range: { from: 0, to: 1000 },
      width: 500, height: 52, rowHeight: 28, showAxis: true, timeZone: 'utc', stateColors: {},
      onChangeTimeRange,
    })
  );

  fireEvent.wheel(getByRole('img'), { deltaY: 100, clientX: 300 });
  expect(onChangeTimeRange).toHaveBeenCalled();
});

test('dragging a segment selects and zooms the dashboard range', () => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: jest.fn(() => canvasContextStub()),
  });
  const onChangeTimeRange = jest.fn();
  const interval: any = {
    machineId: 'M1', state: 'running', startedAt: 0, endedAt: 1000, originalDurationMs: 1000,
    job: 'A', dimensions: {}, visibleStart: 0, visibleEnd: 1000, visibleDurationMs: 1000,
    effectiveOriginalDurationMs: 1000, isOpen: false, displayClass: 'job:A', displayKind: 'job', displayLabel: 'A',
  };
  const { getByRole } = render(
    React.createElement(TimelineCanvas as any, {
      intervals: [interval], noData: [], machineIds: ['M1'], range: { from: 0, to: 1000 },
      width: 500, height: 52, rowHeight: 28, showAxis: true, timeZone: 'utc', stateColors: {},
      onChangeTimeRange,
    })
  );
  const canvas = getByRole('img');
  fireEvent.pointerDown(canvas, { clientX: 200, clientY: 10, pointerId: 1, button: 0 });
  fireEvent.pointerMove(canvas, { clientX: 350, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 350, clientY: 10, pointerId: 1 });
  expect(onChangeTimeRange).toHaveBeenCalled();
});

test('panel options register dynamic editors instead of fixed state color pickers', () => {
  const calls: string[] = [];
  const builder: any = {};
  for (const method of ['addTextInput', 'addNumberInput', 'addBooleanSwitch', 'addRadio', 'addColorPicker', 'addCustomEditor']) {
    builder[method] = jest.fn((config: any) => {
      calls.push(`${method}:${config.path}`);
      return builder;
    });
  }

  plugin.getPanelOptionsSupplier()(builder, { data: [] } as any);

  expect(calls).toContain('addCustomEditor:filterRows');
  expect(calls).toContain('addCustomEditor:durationRules');
  expect(calls).toContain('addCustomEditor:colorMappings');
  expect(calls.filter((entry) => entry.startsWith('addColorPicker:stateColors.'))).toHaveLength(0);
});
