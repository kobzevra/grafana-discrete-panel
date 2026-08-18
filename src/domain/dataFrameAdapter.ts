import type {
  AdapterResult,
  DataFrameFieldLike,
  DataFrameLike,
  FieldMappings,
  NormalizedInterval,
  PanelDiagnostic,
} from '../types.ts';

const REQUIRED_KEYS = ['machineId', 'state', 'startedAt', 'endedAt'] as const;
const DIMENSION_MAPPING: Array<[keyof FieldMappings, string]> = [
  ['operator', 'operator'],
  ['material', 'material'],
  ['customer', 'customer'],
  ['manager', 'manager'],
  ['colorProfile', 'color_profile'],
  ['printMode', 'print_mode'],
  ['dropSize', 'drop_size'],
  ['tool', 'tool'],
  ['preset', 'preset'],
  ['commandedSpeed', 'commanded_speed'],
];

function fieldByName(frame: DataFrameLike, name: string | undefined): DataFrameFieldLike | undefined {
  return name ? frame.fields.find((field) => field.name === name) : undefined;
}

function stringValue(field: DataFrameFieldLike | undefined, index: number): string | undefined {
  const value = field?.values[index];
  return value == null ? undefined : String(value);
}

function rawValue(
  field: DataFrameFieldLike | undefined,
  index: number
): string | number | boolean | null | undefined {
  const value = field?.values[index];
  if (value == null) {
    return value as null | undefined;
  }
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : String(value);
}

function parseTime(
  field: DataFrameFieldLike | undefined,
  index: number,
  allowNull: boolean
): number | null | undefined {
  if (!field) {
    return undefined;
  }
  const value = field.values[index];
  if (value == null) {
    return allowNull ? null : undefined;
  }
  if (field.type === 'time' && typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (field.type === 'time' && value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime();
  }
  if (field.type === 'string' && typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseDuration(field: DataFrameFieldLike | undefined, index: number): number | null | undefined {
  if (!field) {
    return undefined;
  }
  const value = field.values[index];
  if (value == null || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function rowCount(frame: DataFrameLike): number {
  if (typeof frame.length === 'number' && Number.isInteger(frame.length) && frame.length >= 0) {
    return frame.length;
  }
  return frame.fields.reduce((max, field) => Math.max(max, field.values.length), 0);
}

export function adaptDataFrames(frames: readonly DataFrameLike[], mappings: FieldMappings): AdapterResult {
  const diagnostics: PanelDiagnostic[] = [];
  const intervals: NormalizedInterval[] = [];
  const availableLogicalFields = new Set<string>();
  const availableSourceFields = new Set<string>();

  for (const key of REQUIRED_KEYS) {
    if (!mappings[key]?.trim()) {
      diagnostics.push({ code: 'missing-required-mapping', severity: 'error', message: `Missing required field mapping: ${key}` });
    }
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { intervals, diagnostics, availableLogicalFields, availableSourceFields };
  }

  for (const frame of frames) {
    for (const field of frame.fields) {
      availableSourceFields.add(field.name);
    }
    const required = REQUIRED_KEYS.map((key) => [key, fieldByName(frame, mappings[key])] as const);
    const presentRequired = required.filter(([, field]) => Boolean(field)).length;
    if (presentRequired === 0) {
      continue;
    }
    if (presentRequired !== REQUIRED_KEYS.length) {
      const missing = required.filter(([, field]) => !field).map(([key]) => key);
      diagnostics.push({ code: 'mapped-field-not-found', severity: 'error', message: `Frame is missing required mapped fields: ${missing.join(', ')}` });
      continue;
    }

    for (const [logicalKey, physicalName] of Object.entries(mappings)) {
      if (physicalName && fieldByName(frame, physicalName)) {
        availableLogicalFields.add(logicalKey);
      }
    }

    const machineField = fieldByName(frame, mappings.machineId)!;
    const stateField = fieldByName(frame, mappings.state)!;
    const startField = fieldByName(frame, mappings.startedAt)!;
    const endField = fieldByName(frame, mappings.endedAt)!;
    const durationField = fieldByName(frame, mappings.originalDuration);

    for (let index = 0; index < rowCount(frame); index += 1) {
      const machineId = stringValue(machineField, index)?.trim();
      const state = stringValue(stateField, index)?.trim();
      const startedAt = parseTime(startField, index, false);
      const endedAt = parseTime(endField, index, true);
      if (!machineId || !state) {
        diagnostics.push({ code: 'invalid-row', severity: 'warning', message: `Row ${index} is missing machine_id or state`, machineId: machineId || undefined });
        continue;
      }
      if (typeof startedAt !== 'number' || endedAt === undefined) {
        diagnostics.push({ code: 'invalid-timestamp', severity: 'warning', message: `Row ${index} has an invalid start or end timestamp`, machineId });
        continue;
      }

      const mappedDuration = parseDuration(durationField, index);
      if (mappedDuration === undefined && durationField) {
        diagnostics.push({ code: 'invalid-duration', severity: 'warning', message: `Row ${index} has invalid original_duration; derived duration will be used when possible`, machineId });
      }
      const originalDurationMs = mappedDuration !== undefined && mappedDuration !== null
        ? mappedDuration
        : endedAt !== null ? Math.max(0, endedAt - startedAt) : null;

      const dimensions: NormalizedInterval['dimensions'] = {};
      for (const field of frame.fields) {
        const value = rawValue(field, index);
        if (value !== undefined) {
          dimensions[field.name] = value;
        }
      }
      for (const [mappingKey, logicalKey] of DIMENSION_MAPPING) {
        const value = rawValue(fieldByName(frame, mappings[mappingKey]), index);
        if (value !== undefined) {
          dimensions[logicalKey] = value;
        }
      }

      intervals.push({
        machineId,
        machineType: stringValue(fieldByName(frame, mappings.machineType), index),
        state,
        startedAt,
        endedAt,
        originalDurationMs,
        job: stringValue(fieldByName(frame, mappings.job), index),
        runId: stringValue(fieldByName(frame, mappings.runId), index),
        displayClassHint: stringValue(fieldByName(frame, mappings.displayClass), index),
        dimensions,
        quality: stringValue(fieldByName(frame, mappings.quality), index),
        details: stringValue(fieldByName(frame, mappings.details), index),
      });
    }
  }

  return { intervals, diagnostics, availableLogicalFields, availableSourceFields };
}
