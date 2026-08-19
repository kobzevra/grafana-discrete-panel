import type {
  DataFrameLike,
  DimensionFilters,
  DimensionKey,
  DurationRules,
  FieldFilterRule,
  FieldMappings,
  PanelDiagnostic,
  TimelineModel,
  TimelineRange,
} from '../types.ts';
import { adaptDataFrames } from './dataFrameAdapter.ts';
import { validateIntervals } from './validation.ts';
import { clipIntervals, computeCoverage } from './intervals.ts';
import { applyDimensionFilters, applyDurationRules, applyFieldFilters } from './filters.ts';
import { classifyIntervals, applyJobFocus } from './displayClasses.ts';
import { buildLegend } from './legend.ts';

const FILTER_MAPPING_KEYS: Record<DimensionKey, keyof FieldMappings> = {
  machine: 'machineId',
  job: 'job',
  operator: 'operator',
  material: 'material',
  customer: 'customer',
  manager: 'manager',
  color_profile: 'colorProfile',
  print_mode: 'printMode',
  drop_size: 'dropSize',
  tool: 'tool',
  preset: 'preset',
  commanded_speed: 'commandedSpeed',
};

export interface BuildTimelineModelArgs {
  frames: readonly DataFrameLike[];
  mappings: FieldMappings;
  range: TimelineRange;
  nowMs: number;
  dimensionFilters: DimensionFilters;
  fieldFilters?: readonly FieldFilterRule[];
  durationRules: DurationRules;
  focusJob?: string;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function activeFilters(filters: DimensionFilters): Array<[DimensionKey, readonly string[]]> {
  return Object.entries(filters).filter(([, values]) => values && values.length > 0) as Array<
    [DimensionKey, readonly string[]]
  >;
}

export function buildTimelineModel(args: BuildTimelineModelArgs): TimelineModel {
  const adapted = adaptDataFrames(args.frames, args.mappings);
  const validated = validateIntervals(adapted.intervals);
  const diagnostics: PanelDiagnostic[] = [...adapted.diagnostics, ...validated.diagnostics];

  if (adapted.diagnostics.some((diagnostic) => diagnostic.severity === 'error') || validated.hasConflicts) {
    return { intervals: [], noData: [], legend: null, machineIds: [], diagnostics, blocked: true };
  }

  const clipped = clipIntervals(validated.intervals, args.range, args.nowMs);
  const dynamicFilters = [...(args.fieldFilters ?? [])];
  const machineField = args.mappings.machineId?.trim();
  const dynamicMachineRule = dynamicFilters.find((rule) => rule.field === machineField || rule.field === 'machine' || rule.field === 'machine_id');
  const requestedMachines = uniqueSorted(dynamicMachineRule?.values ?? args.dimensionFilters.machine ?? []);

  if (!clipped.length) {
    diagnostics.push({ code: 'no-source-data', severity: 'info', message: 'No source intervals overlap the selected range' });
    const noData = computeCoverage([], requestedMachines, args.range);
    return {
      intervals: [], noData,
      legend: buildLegend([], args.range, requestedMachines, args.focusJob),
      machineIds: requestedMachines, diagnostics, blocked: false,
    };
  }

  if (args.focusJob && (!args.mappings.job || !adapted.availableLogicalFields.has('job'))) {
    diagnostics.push({ code: 'job-focus-field-absent', severity: 'error', message: 'Job focus requires an available mapped job field' });
  }

  for (const [dimension] of activeFilters(args.dimensionFilters)) {
    const mappingKey = FILTER_MAPPING_KEYS[dimension];
    if (!args.mappings[mappingKey] || !adapted.availableLogicalFields.has(mappingKey)) {
      diagnostics.push({ code: 'configured-filter-field-absent', severity: 'error', message: `Active filter ${dimension} has no available mapped field` });
    }
  }
  for (const rule of dynamicFilters) {
    const field = rule.field.trim();
    const special = field === 'machine' || field === 'job' || field === 'state';
    if (field && !special && !adapted.availableSourceFields.has(field)) {
      diagnostics.push({ code: 'configured-filter-field-absent', severity: 'error', message: `Active filter ${field} is not present in source data` });
    }
  }
  if (diagnostics.some((diagnostic) => diagnostic.code === 'configured-filter-field-absent' || diagnostic.code === 'job-focus-field-absent')) {
    return { intervals: [], noData: [], legend: null, machineIds: [], diagnostics, blocked: true };
  }

  const sourceMachineIds = uniqueSorted(clipped.map((row) => row.machineId));
  const machineIds = requestedMachines.length ? requestedMachines : sourceMachineIds;
  const machineRows = clipped.filter((row) => machineIds.includes(row.machineId));
  const noData = computeCoverage(machineRows, machineIds, args.range);

  const nonMachineFilters: DimensionFilters = { ...args.dimensionFilters };
  delete nonMachineFilters.machine;
  const dynamicNonMachine = dynamicFilters.filter((rule) => rule !== dynamicMachineRule);
  const legacyFiltered = applyDimensionFilters(machineRows, nonMachineFilters);
  const fieldFiltered = applyFieldFilters(legacyFiltered, dynamicNonMachine);
  const durationFiltered = applyDurationRules(fieldFiltered, args.durationRules);
  const classified = classifyIntervals(durationFiltered);
  const focused = applyJobFocus(classified, args.focusJob).intervals;

  if (!focused.length && machineIds.length) {
    diagnostics.push({ code: 'no-rows-after-filters', severity: 'info', message: 'No intervals remain after active filters' });
  }

  return {
    intervals: focused,
    noData,
    legend: buildLegend(focused, args.range, machineIds, args.focusJob),
    machineIds,
    diagnostics,
    blocked: false,
  };
}
