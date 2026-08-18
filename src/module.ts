import { PanelPlugin } from '@grafana/data';
import { ProductionTimelinePanel } from './components/ProductionTimelinePanel';
import type { ProductionTimelineOptions } from './types';
import { DEFAULT_OPTIONS } from './domain/panelOptions';

const fields: Array<[keyof ProductionTimelineOptions['fields'], string, string]> = [
  ['machineId', 'Machine ID', 'machine_id'], ['machineType', 'Machine type', 'machine_type'],
  ['state', 'State', 'state'], ['startedAt', 'Started at', 'started_at'], ['endedAt', 'Ended at', 'ended_at'],
  ['originalDuration', 'Original duration (ms)', 'duration'], ['job', 'Job', 'job'], ['runId', 'Run ID', 'run_id'],
  ['displayClass', 'Display class', 'display_class'], ['operator', 'Operator', 'operator'], ['material', 'Material', 'material'],
  ['customer', 'Customer', 'customer'], ['manager', 'Manager', 'manager'], ['colorProfile', 'Color profile', 'color_profile'],
  ['printMode', 'Print mode', 'print_mode'], ['dropSize', 'Drop size', 'drop_size'], ['tool', 'Tool', 'tool'],
  ['preset', 'Preset', 'preset'], ['commandedSpeed', 'Commanded speed', 'commanded_speed'], ['quality', 'Quality', 'quality'],
  ['details', 'Details', 'details'],
];

const filters: Array<[keyof ProductionTimelineOptions['filters'], string]> = [
  ['machine', 'Machine'], ['job', 'Job'], ['operator', 'Operator'], ['material', 'Material'], ['customer', 'Customer'],
  ['manager', 'Manager'], ['color_profile', 'Color profile'], ['print_mode', 'Print mode'], ['drop_size', 'Drop size'],
  ['tool', 'Tool'], ['preset', 'Preset'], ['commanded_speed', 'Commanded speed'],
];

export const plugin = new PanelPlugin<ProductionTimelineOptions>(ProductionTimelinePanel).setPanelOptions((builder) => {
  for (const [key, label, fallback] of fields) {
    builder.addTextInput({
      path: `fields.${key}`,
      name: label,
      category: ['Field mappings'],
      defaultValue: String(DEFAULT_OPTIONS.fields[key] ?? fallback),
    });
  }

  builder
    .addNumberInput({ path: 'rowHeight', name: 'Row height', category: ['Layout'], defaultValue: DEFAULT_OPTIONS.rowHeight, settings: { min: 8, max: 80 } })
    .addBooleanSwitch({ path: 'showAxis', name: 'Show time axis', category: ['Layout'], defaultValue: DEFAULT_OPTIONS.showAxis })
    .addBooleanSwitch({ path: 'showLegend', name: 'Show legend', category: ['Layout'], defaultValue: DEFAULT_OPTIONS.showLegend })
    .addRadio({
      path: 'jobMode', name: 'Job selection mode', category: ['Filters'], defaultValue: 'none',
      settings: { options: [
        { value: 'none', label: 'None' }, { value: 'filter', label: 'Filter' }, { value: 'focus', label: 'Focus (Selected / Other jobs)' },
      ] },
    });

  for (const [key, label] of filters) {
    builder.addTextInput({
      path: `filters.${key}`,
      name: `${label} binding`,
      description: 'Literal value or Grafana variable; JSON arrays are accepted for multi-select.',
      category: ['Filters'],
      defaultValue: '',
    });
  }

  builder
    .addNumberInput({ path: 'duration.idleMinSeconds', name: 'Idle minimum (s)', category: ['Duration filters'], settings: { min: 0 } })
    .addNumberInput({ path: 'duration.idleMaxSeconds', name: 'Idle maximum (s)', category: ['Duration filters'], settings: { min: 0 } })
    .addNumberInput({ path: 'duration.setupMinSeconds', name: 'Setup minimum (s)', category: ['Duration filters'], settings: { min: 0 } })
    .addNumberInput({ path: 'duration.setupMaxSeconds', name: 'Setup maximum (s)', category: ['Duration filters'], settings: { min: 0 } });

  for (const state of ['offline', 'idle', 'setup', 'ready', 'queued', 'running-unresolved', 'paused', 'blocked', 'error', 'maintenance', 'unknown', 'gap', 'stale']) {
    builder.addColorPicker({ path: `stateColors.${state}`, name: state, category: ['State colors'] });
  }

  return builder;
});
