export interface TimelineRange {
  from: number;
  to: number;
}

export interface NormalizedInterval {
  machineId: string;
  machineType?: string;
  state: string;
  startedAt: number;
  endedAt: number | null;
  originalDurationMs: number | null;
  job?: string;
  runId?: string;
  displayClassHint?: string;
  dimensions: Record<string, string | number | boolean | null | undefined>;
  quality?: string;
  details?: string;
}

export interface VisibleInterval extends NormalizedInterval {
  visibleStart: number;
  visibleEnd: number;
  visibleDurationMs: number;
  effectiveOriginalDurationMs: number;
  isOpen: boolean;
}

export interface DurationRule {
  minMs?: number;
  maxMs?: number;
}

export interface FieldFilterRule {
  field: string;
  values: string[];
}

export interface DurationFilterRuleOption {
  state: string;
  minSeconds?: number;
  maxSeconds?: number;
}

export interface ColorMappingOption {
  field: string;
  value: string;
  color: string;
}

export interface TimelineInteractionOptions {
  dragPan: boolean;
  segmentZoom: boolean;
  wheelPan: boolean;
  ctrlWheelZoom: boolean;
  shiftWheelPan: boolean;
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface PanelDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  machineId?: string;
}

export interface ValidationResult {
  intervals: NormalizedInterval[];
  diagnostics: PanelDiagnostic[];
  hasConflicts: boolean;
}

export type DimensionKey =
  | 'machine'
  | 'job'
  | 'operator'
  | 'material'
  | 'customer'
  | 'manager'
  | 'color_profile'
  | 'print_mode'
  | 'drop_size'
  | 'tool'
  | 'preset'
  | 'commanded_speed';

export type DimensionFilters = Partial<Record<DimensionKey, readonly string[]>>;
export type DurationRules = Partial<Record<string, DurationRule>>;

export interface CoverageRegion {
  machineId: string;
  start: number;
  end: number;
  durationMs: number;
}

export type DisplayKind = 'state' | 'job' | 'selected-job' | 'other-jobs';

export interface DisplayInterval extends VisibleInterval {
  displayClass: string;
  displayKind: DisplayKind;
  displayLabel: string;
}

export interface FocusResult {
  intervals: DisplayInterval[];
  selectedJob?: string;
}

export interface LegendEntry {
  key: string;
  label: string;
  kind: DisplayKind;
  visibleDurationMs: number;
  percent: number;
  segmentCount: number;
  runCount: number | null;
}

export interface LegendModel {
  states: LegendEntry[];
  jobs: LegendEntry[];
  denominatorMs: number;
}

export interface FieldMappings {
  machineId: string;
  state: string;
  startedAt: string;
  endedAt: string;
  machineType?: string;
  originalDuration?: string;
  job?: string;
  runId?: string;
  displayClass?: string;
  operator?: string;
  material?: string;
  customer?: string;
  manager?: string;
  colorProfile?: string;
  printMode?: string;
  dropSize?: string;
  tool?: string;
  preset?: string;
  commandedSpeed?: string;
  quality?: string;
  details?: string;
}

export interface DataFrameFieldLike {
  name: string;
  type: string;
  values: readonly unknown[];
}

export interface DataFrameLike {
  fields: readonly DataFrameFieldLike[];
  length?: number;
}

export interface AdapterResult {
  intervals: NormalizedInterval[];
  diagnostics: PanelDiagnostic[];
  availableLogicalFields: Set<string>;
  availableSourceFields: Set<string>;
}

export interface TimelineScale {
  from: number;
  to: number;
  left: number;
  right: number;
  width: number;
  pxPerMs: number;
  timeToX(timeMs: number): number;
  xToTime(x: number): number;
}

export type HitIndex = Map<string, DisplayInterval[]>;

export interface TimelineModel {
  intervals: DisplayInterval[];
  noData: CoverageRegion[];
  legend: LegendModel | null;
  machineIds: string[];
  diagnostics: PanelDiagnostic[];
  blocked: boolean;
}

export type JobMode = 'none' | 'filter' | 'focus';

/** Legacy fixed bindings retained for saved dashboards. New dashboards use filterRows. */
export interface FilterBindingOptions {
  machine: string;
  job: string;
  operator: string;
  material: string;
  customer: string;
  manager: string;
  color_profile: string;
  print_mode: string;
  drop_size: string;
  tool: string;
  preset: string;
  commanded_speed: string;
}

/** Legacy duration fields retained for saved dashboards. New dashboards use durationRules. */
export interface DurationFilterOptions {
  idleMinSeconds?: number;
  idleMaxSeconds?: number;
  setupMinSeconds?: number;
  setupMaxSeconds?: number;
}

export interface ProductionTimelineOptions {
  fields: FieldMappings;
  rowHeight: number;
  showAxis: boolean;
  showLegend: boolean;
  /** Legacy state overrides retained for backward compatibility. */
  stateColors: Record<string, string>;
  colorMappings: ColorMappingOption[];
  jobMode: JobMode;
  /** Legacy fixed bindings retained for backward compatibility. */
  filters: FilterBindingOptions;
  filterRows: FieldFilterRule[];
  /** Legacy fixed Idle/Setup rules retained for backward compatibility. */
  duration: DurationFilterOptions;
  durationRules: DurationFilterRuleOption[];
  interactions: TimelineInteractionOptions;
}
