import type {
  DimensionFilters,
  DurationRules,
  PanelDiagnostic,
  ProductionTimelineOptions,
} from '../types.ts';
import { resolveFilterBindings } from './bindings.ts';

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
  jobMode: 'none',
  filters: {
    machine: '', job: '', operator: '', material: '', customer: '', manager: '',
    color_profile: '', print_mode: '', drop_size: '', tool: '', preset: '', commanded_speed: '',
  },
  duration: {},
};

export function normalizeOptions(options: Partial<ProductionTimelineOptions> | undefined): ProductionTimelineOptions {
  const input = options ?? {};
  return {
    ...DEFAULT_OPTIONS,
    ...input,
    fields: { ...DEFAULT_OPTIONS.fields, ...(input.fields ?? {}) },
    filters: { ...DEFAULT_OPTIONS.filters, ...(input.filters ?? {}) },
    duration: { ...DEFAULT_OPTIONS.duration, ...(input.duration ?? {}) },
    stateColors: { ...DEFAULT_OPTIONS.stateColors, ...(input.stateColors ?? {}) },
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

export function resolvePanelBehavior(
  options: ProductionTimelineOptions,
  interpolate: (value: string) => string
): { dimensionFilters: DimensionFilters; durationRules: DurationRules; focusJob?: string; diagnostics: PanelDiagnostic[] } {
  const diagnostics: PanelDiagnostic[] = [];
  const dimensionFilters = resolveFilterBindings(options.filters, interpolate);
  let focusJob: string | undefined;

  if (options.jobMode === 'none') {
    delete dimensionFilters.job;
  } else if (options.jobMode === 'focus') {
    const selected = dimensionFilters.job ?? [];
    delete dimensionFilters.job;
    if (selected.length === 1) {
      focusJob = selected[0];
    } else if (selected.length > 1) {
      diagnostics.push({
        code: 'job-focus-ambiguous', severity: 'warning',
        message: 'Job focus requires exactly one selected job',
      });
    }
  }

  const idle = compactRule(secondsToMs(options.duration.idleMinSeconds), secondsToMs(options.duration.idleMaxSeconds));
  const setup = compactRule(secondsToMs(options.duration.setupMinSeconds), secondsToMs(options.duration.setupMaxSeconds));
  const durationRules: DurationRules = {};
  if (idle) {
    durationRules.idle = idle;
  }
  if (setup) {
    durationRules.setup = setup;
  }

  return { dimensionFilters, durationRules, focusJob, diagnostics };
}
