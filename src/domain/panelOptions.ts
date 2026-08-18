import type {
  DimensionFilters,
  DurationRules,
  FieldFilterRule,
  PanelDiagnostic,
  ProductionTimelineOptions,
} from '../types.ts';
import { parseFilterBinding, resolveFilterBindings } from './bindings.ts';

export const DEFAULT_OPTIONS: ProductionTimelineOptions = {
  fields: {
    machineId: 'machine_id',
    machineType: 'machine_type',
    state: 'state',
    startedAt: 'started_at',
    endedAt: 'ended_at',
    originalDuration: '',
    job: 'job',
    runId: 'run_id',
    displayClass: 'display_class',
    operator: 'operator',
    material: 'material',
    customer: 'customer',
    manager: 'manager',
    colorProfile: 'color_profile',
    printMode: 'print_mode',
    dropSize: 'drop_size',
    tool: 'tool',
    preset: 'preset',
    commandedSpeed: 'commanded_speed',
    quality: 'quality',
    details: 'details',
  },
  rowHeight: 28,
  showAxis: true,
  showLegend: true,
  stateColors: {},
  colorMappings: [],
  jobMode: 'none',
  filters: {
    machine: '', job: '', operator: '', material: '', customer: '', manager: '',
    color_profile: '', print_mode: '', drop_size: '', tool: '', preset: '', commanded_speed: '',
  },
  filterRows: [],
  duration: {},
  durationRules: [],
  interactions: {
    dragPan: true,
    segmentZoom: true,
    wheelPan: true,
    ctrlWheelZoom: true,
    shiftWheelPan: true,
  },
};

export function normalizeOptions(options: Partial<ProductionTimelineOptions> | undefined): ProductionTimelineOptions {
  const input = options ?? {};
  return {
    ...DEFAULT_OPTIONS,
    ...input,
    fields: { ...DEFAULT_OPTIONS.fields, ...(input.fields ?? {}) },
    filters: { ...DEFAULT_OPTIONS.filters, ...(input.filters ?? {}) },
    filterRows: [...(input.filterRows ?? DEFAULT_OPTIONS.filterRows)],
    duration: { ...DEFAULT_OPTIONS.duration, ...(input.duration ?? {}) },
    durationRules: [...(input.durationRules ?? DEFAULT_OPTIONS.durationRules)],
    stateColors: { ...DEFAULT_OPTIONS.stateColors, ...(input.stateColors ?? {}) },
    colorMappings: [...(input.colorMappings ?? DEFAULT_OPTIONS.colorMappings)],
    interactions: { ...DEFAULT_OPTIONS.interactions, ...(input.interactions ?? {}) },
  };
}

function secondsToMs(value: number | undefined): number | undefined {
  return value === undefined || !Number.isFinite(value) || value < 0 ? undefined : value * 1000;
}

function compactRule(minMs: number | undefined, maxMs: number | undefined) {
  if (minMs === undefined && maxMs === undefined) {
    return undefined;
  }
  return { ...(minMs !== undefined ? { minMs } : {}), ...(maxMs !== undefined ? { maxMs } : {}) };
}

function resolveFieldFilters(rows: readonly FieldFilterRule[], interpolate: (value: string) => string): FieldFilterRule[] {
  return rows
    .map((row) => ({
      field: row.field.trim(),
      values: row.values.flatMap((value) => parseFilterBinding(interpolate(value))).filter(Boolean),
    }))
    .filter((row) => row.field && row.values.length > 0);
}

export function resolvePanelBehavior(
  options: ProductionTimelineOptions,
  interpolate: (value: string) => string
): {
  dimensionFilters: DimensionFilters;
  fieldFilters: FieldFilterRule[];
  durationRules: DurationRules;
  focusJob?: string;
  diagnostics: PanelDiagnostic[];
} {
  const diagnostics: PanelDiagnostic[] = [];
  const dimensionFilters = resolveFilterBindings(options.filters, interpolate);
  let fieldFilters = resolveFieldFilters(options.filterRows, interpolate);
  let focusJob: string | undefined;

  if (options.filterRows.length > 0) {
    // Dynamic rows supersede legacy fixed bindings, avoiding duplicate filtering.
    for (const key of Object.keys(dimensionFilters)) {
      delete dimensionFilters[key as keyof DimensionFilters];
    }
  }

  if (options.jobMode === 'none') {
    delete dimensionFilters.job;
  } else if (options.jobMode === 'focus') {
    const jobField = options.fields.job?.trim();
    const rowIndex = fieldFilters.findIndex((row) => row.field === jobField || row.field === 'job');
    const dynamicSelected = rowIndex >= 0 ? fieldFilters[rowIndex].values : [];
    const legacySelected = dimensionFilters.job ?? [];
    const selected = dynamicSelected.length ? dynamicSelected : legacySelected;
    delete dimensionFilters.job;
    if (rowIndex >= 0) {
      fieldFilters = fieldFilters.filter((_, index) => index !== rowIndex);
    }
    if (selected.length === 1) {
      focusJob = selected[0];
    } else if (selected.length > 1) {
      diagnostics.push({ code: 'job-focus-ambiguous', severity: 'warning', message: 'Job focus requires exactly one selected job' });
    }
  }

  const durationRules: DurationRules = {};
  if (options.durationRules.length > 0) {
    for (const row of options.durationRules) {
      const state = row.state.trim().toLowerCase();
      if (!state) {
        continue;
      }
      const rule = compactRule(secondsToMs(row.minSeconds), secondsToMs(row.maxSeconds));
      if (rule) {
        durationRules[state] = rule;
      }
    }
  } else {
    const idle = compactRule(secondsToMs(options.duration.idleMinSeconds), secondsToMs(options.duration.idleMaxSeconds));
    const setup = compactRule(secondsToMs(options.duration.setupMinSeconds), secondsToMs(options.duration.setupMaxSeconds));
    if (idle) {
      durationRules.idle = idle;
    }
    if (setup) {
      durationRules.setup = setup;
    }
  }

  return { dimensionFilters, fieldFilters, durationRules, focusJob, diagnostics };
}
