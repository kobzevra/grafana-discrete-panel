import { PanelPlugin } from '@grafana/data';
import { ProductionTimelinePanel } from './components/ProductionTimelinePanel';
import { ColorMappingsEditor, DurationRulesEditor, FiltersEditor } from './editors/MappingEditors';
import type { ProductionTimelineOptions } from './types';
import { DEFAULT_OPTIONS } from './domain/panelOptions';

const fields: Array<[keyof ProductionTimelineOptions['fields'], string, string]> = [
  ['machineId', 'Machine ID', 'machine_id'], ['machineType', 'Machine type', 'machine_type'],
  ['state', 'State', 'state'], ['startedAt', 'Started at', 'started_at'], ['endedAt', 'Ended at', 'ended_at'],
  ['originalDuration', 'Original duration (ms)', ''], ['job', 'Job', 'job'], ['runId', 'Run ID', 'run_id'],
  ['displayClass', 'Display class', 'display_class'], ['operator', 'Operator', 'operator'], ['material', 'Material', 'material'],
  ['customer', 'Customer', 'customer'], ['manager', 'Manager', 'manager'], ['colorProfile', 'Color profile', 'color_profile'],
  ['printMode', 'Print mode', 'print_mode'], ['dropSize', 'Drop size', 'drop_size'], ['tool', 'Tool', 'tool'],
  ['preset', 'Preset', 'preset'], ['commandedSpeed', 'Commanded speed', 'commanded_speed'], ['quality', 'Quality', 'quality'],
  ['details', 'Details', 'details'],
];

export const plugin = new PanelPlugin<ProductionTimelineOptions>(ProductionTimelinePanel).setPanelOptions((builder) => {
  builder
    .addNumberInput({
      path: 'rowHeight',
      name: 'Row height',
      category: ['Display'],
      defaultValue: DEFAULT_OPTIONS.rowHeight,
      settings: { min: 8, max: 80 },
    })
    .addBooleanSwitch({
      path: 'showAxis',
      name: 'Show time axis',
      category: ['Display'],
      defaultValue: DEFAULT_OPTIONS.showAxis,
    })
    .addBooleanSwitch({
      path: 'interactions.dragPan',
      name: 'Drag empty area to pan',
      category: ['Display'],
      defaultValue: DEFAULT_OPTIONS.interactions.dragPan,
    })
    .addBooleanSwitch({
      path: 'interactions.segmentZoom',
      name: 'Drag segment to select and zoom',
      category: ['Display'],
      defaultValue: DEFAULT_OPTIONS.interactions.segmentZoom,
    })
    .addBooleanSwitch({
      path: 'interactions.wheelPan',
      name: 'Mouse wheel pans time',
      category: ['Display'],
      defaultValue: DEFAULT_OPTIONS.interactions.wheelPan,
    })
    .addBooleanSwitch({
      path: 'interactions.ctrlWheelZoom',
      name: 'Ctrl + wheel zooms at cursor',
      category: ['Display'],
      defaultValue: DEFAULT_OPTIONS.interactions.ctrlWheelZoom,
    })
    .addBooleanSwitch({
      path: 'interactions.shiftWheelPan',
      name: 'Shift + wheel fast pan',
      category: ['Display'],
      defaultValue: DEFAULT_OPTIONS.interactions.shiftWheelPan,
    })
    .addBooleanSwitch({
      path: 'showLegend',
      name: 'Show legend',
      category: ['Legend'],
      defaultValue: DEFAULT_OPTIONS.showLegend,
    })
    .addRadio({
      path: 'jobMode',
      name: 'Job selection mode',
      category: ['Filters'],
      defaultValue: 'none',
      settings: {
        options: [
          { value: 'none', label: 'None' },
          { value: 'filter', label: 'Filter' },
          { value: 'focus', label: 'Focus (Selected / Other jobs)' },
        ],
      },
    });

  builder.addCustomEditor({
    id: 'filterRows',
    path: 'filterRows',
    name: 'Filter mappings',
    description: 'AND between rows; multiple values inside one row are OR. Custom Grafana variables are accepted.',
    category: ['Filters'],
    defaultValue: DEFAULT_OPTIONS.filterRows,
    editor: FiltersEditor,
  });

  builder.addCustomEditor({
    id: 'durationRules',
    path: 'durationRules',
    name: 'Duration rules',
    description: 'Filters by the original full interval duration, not the clipped visible duration.',
    category: ['Duration filters'],
    defaultValue: DEFAULT_OPTIONS.durationRules,
    editor: DurationRulesEditor,
  });

  builder.addCustomEditor({
    id: 'colorMappings',
    path: 'colorMappings',
    name: 'Color mappings',
    description: 'Map a discovered field value to a color. Job colors remain deterministic unless explicitly overridden.',
    category: ['Colors'],
    defaultValue: DEFAULT_OPTIONS.colorMappings,
    editor: ColorMappingsEditor,
  });

  for (const [key, label, fallback] of fields) {
    builder.addTextInput({
      path: `fields.${key}`,
      name: label,
      category: ['Field mappings'],
      defaultValue: String(DEFAULT_OPTIONS.fields[key] ?? fallback),
    });
  }

  return builder;
});
