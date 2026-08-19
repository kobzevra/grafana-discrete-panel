import React, { useMemo, useState } from 'react';
import type { DataFrame, StandardEditorProps } from '@grafana/data';
import { Button, ColorPicker, Combobox, Input, Modal, MultiCombobox } from '@grafana/ui';
import type {
  ColorMappingOption,
  DurationFilterRuleOption,
  FieldFilterRule,
  ProductionTimelineOptions,
} from '../types';
import { getJobColor, getStateColor } from '../domain/colors';

interface Discovery {
  fields: string[];
  values: Record<string, string[]>;
}

const PRIORITY_FIELDS = ['machine_id', 'job', 'state', 'operator', 'material', 'customer', 'manager'];
const FALLBACK_COLOR = '#7EB26D';

function discover(data: readonly DataFrame[]): Discovery {
  const values = new Map<string, Set<string>>();
  for (const frame of data) {
    for (const field of frame.fields) {
      let set = values.get(field.name);
      if (!set) {
        set = new Set<string>();
        values.set(field.name, set);
      }
      for (let index = 0; index < field.values.length && set.size < 500; index += 1) {
        const value = field.values[index];
        if (value !== undefined && value !== null && value !== '') {
          set.add(String(value));
        }
      }
    }
  }
  const fields = [...values.keys()].sort((a, b) => {
    const ai = PRIORITY_FIELDS.indexOf(a);
    const bi = PRIORITY_FIELDS.indexOf(b);
    if (ai >= 0 || bi >= 0) {
      return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    }
    return a.localeCompare(b);
  });
  return {
    fields,
    values: Object.fromEntries(fields.map((field) => [field, [...(values.get(field) ?? [])].sort((a, b) => a.localeCompare(b))])),
  };
}

function fieldOptions(discovery: Discovery) {
  return discovery.fields.map((field) => ({ label: field, value: field }));
}

function valueOptions(discovery: Discovery, field: string) {
  return (discovery.values[field] ?? []).map((value) => ({ label: value, value }));
}

function suggestedFields(discovery: Discovery): string[] {
  const preferred = ['machine_id', 'job', 'state', ...discovery.fields];
  const unique = [...new Set(preferred.filter((field) => discovery.fields.includes(field)))];
  while (unique.length < 4) {
    unique.push('');
  }
  return unique.slice(0, 4);
}

const tableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  alignItems: 'center',
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 600,
};

const tableRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  alignItems: 'center',
  marginBottom: 6,
};

export function FiltersEditor({
  value = [],
  onChange,
  context,
}: StandardEditorProps<FieldFilterRule[], undefined, ProductionTimelineOptions>) {
  const discovery = useMemo(() => discover(context.data ?? []), [context.data]);
  const suggested = useMemo(
    () => suggestedFields(discovery).map((field) => ({ field, values: [] as string[] })),
    [discovery]
  );
  const rows = value.length > 0 ? value : suggested;
  const fields = fieldOptions(discovery);

  const updateRow = (index: number, next: FieldFilterRule) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? next : row)));
  };

  return (
    <div>
      <div style={{ ...tableHeaderStyle, gridTemplateColumns: 'minmax(110px,.8fr) minmax(160px,1.4fr) auto' }}>
        <span>Field</span><span>Value</span><span />
      </div>
      {rows.map((row, index) => (
        <div key={`${index}-${row.field}`} style={{ ...tableRowStyle, gridTemplateColumns: 'minmax(110px,.8fr) minmax(160px,1.4fr) auto' }}>
          <Combobox
            options={fields}
            value={row.field || null}
            isClearable
            createCustomValue
            placeholder="Field"
            onChange={(option) => updateRow(index, { field: option?.value ?? '', values: [] })}
          />
          <MultiCombobox
            options={valueOptions(discovery, row.field)}
            value={row.values}
            createCustomValue
            isClearable
            placeholder="Value or $variable"
            onChange={(options) => updateRow(index, { ...row, values: options.map((option) => String(option.value)) })}
          />
          <Button variant="secondary" size="sm" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...rows, { field: '', values: [] }])}>
        + Add filter
      </Button>
    </div>
  );
}

function suggestedDurationRows(discovery: Discovery): DurationFilterRuleOption[] {
  const states = discovery.values.state ?? [];
  const rows = states.slice(0, 4).map((state) => ({ state }));
  while (rows.length < 4) {
    rows.push({ state: '' });
  }
  return rows;
}

function numberValue(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function DurationRulesEditor({
  value = [],
  onChange,
  context,
}: StandardEditorProps<DurationFilterRuleOption[], undefined, ProductionTimelineOptions>) {
  const discovery = useMemo(() => discover(context.data ?? []), [context.data]);
  const suggested = useMemo(() => suggestedDurationRows(discovery), [discovery]);
  const rows = value.length > 0 ? value : suggested;
  const states = (discovery.values.state ?? []).map((state) => ({ label: state, value: state }));

  const updateRow = (index: number, next: DurationFilterRuleOption) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? next : row)));
  };

  return (
    <div>
      <div style={{ ...tableHeaderStyle, gridTemplateColumns: 'minmax(100px,1fr) 90px 90px auto' }}>
        <span>State</span><span>Minimum (s)</span><span>Maximum (s)</span><span />
      </div>
      {rows.map((row, index) => (
        <div key={`${index}-${row.state}`} style={{ ...tableRowStyle, gridTemplateColumns: 'minmax(100px,1fr) 90px 90px auto' }}>
          <Combobox
            options={states}
            value={row.state || null}
            isClearable
            createCustomValue
            placeholder="State"
            onChange={(option) => updateRow(index, { ...row, state: option?.value ?? '' })}
          />
          <Input
            type="number"
            min={0}
            value={row.minSeconds ?? ''}
            onChange={(event) => updateRow(index, { ...row, minSeconds: numberValue(event.currentTarget.value) })}
          />
          <Input
            type="number"
            min={0}
            value={row.maxSeconds ?? ''}
            onChange={(event) => updateRow(index, { ...row, maxSeconds: numberValue(event.currentTarget.value) })}
          />
          <Button variant="secondary" size="sm" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...rows, { state: '' }])}>
        + Add duration rule
      </Button>
    </div>
  );
}

function suggestedColor(field: string, value: string, index: number): string {
  if (field === 'state' && value) {
    return getStateColor(value);
  }
  if (field === 'job' && value) {
    return getJobColor(value);
  }
  const palette = ['#7EB26D', '#EAB839', '#6ED0E0', '#EF843C'];
  return palette[index % palette.length];
}

function suggestedColorRows(discovery: Discovery): ColorMappingOption[] {
  const nonRunningStates = (discovery.values.state ?? []).filter((state) => state.toLowerCase() !== 'running');
  const rows: ColorMappingOption[] = nonRunningStates.slice(0, 4).map((state, index) => ({
    field: 'state',
    value: state,
    color: suggestedColor('state', state, index),
  }));
  while (rows.length < 4) {
    rows.push({ field: discovery.fields.includes('state') ? 'state' : '', value: '', color: suggestedColor('', '', rows.length) });
  }
  return rows;
}

export function ColorMappingsEditor({
  value = [],
  onChange,
  context,
}: StandardEditorProps<ColorMappingOption[], undefined, ProductionTimelineOptions>) {
  const [isOpen, setIsOpen] = useState(false);
  const discovery = useMemo(() => discover(context.data ?? []), [context.data]);
  const suggested = useMemo(() => suggestedColorRows(discovery), [discovery]);
  const rows = value.length > 0 ? value : suggested;
  const fields = fieldOptions(discovery);

  const updateRow = (index: number, next: ColorMappingOption) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? next : row)));
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Edit color mappings{value.length > 0 ? ` (${value.length})` : ''}
      </Button>
      <Modal title="Color mappings" isOpen={isOpen} onDismiss={() => setIsOpen(false)}>
        <div style={{ ...tableHeaderStyle, gridTemplateColumns: 'minmax(130px,1fr) minmax(160px,1.3fr) 70px auto' }}>
          <span>Field</span><span>Value</span><span>Color</span><span />
        </div>
        {rows.map((row, index) => (
          <div key={`${index}-${row.field}-${row.value}`} style={{ ...tableRowStyle, gridTemplateColumns: 'minmax(130px,1fr) minmax(160px,1.3fr) 70px auto' }}>
            <Combobox
              options={fields}
              value={row.field || null}
              isClearable
              createCustomValue
              placeholder="Field"
              onChange={(option) => updateRow(index, { ...row, field: option?.value ?? '', value: '' })}
            />
            <Combobox
              options={valueOptions(discovery, row.field)}
              value={row.value || null}
              isClearable
              createCustomValue
              placeholder="Value"
              onChange={(option) => updateRow(index, { ...row, value: option?.value ?? '' })}
            />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ColorPicker color={row.color || FALLBACK_COLOR} onChange={(color) => updateRow(index, { ...row, color })} />
            </div>
            <Button variant="secondary" size="sm" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
              Remove
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => onChange([...rows, { field: '', value: '', color: FALLBACK_COLOR }])}>
          + Add mapping
        </Button>
        <Modal.ButtonRow>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}
