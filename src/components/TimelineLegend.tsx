import React from 'react';
import type { ColorMappingOption, LegendEntry, LegendModel, NormalizedInterval } from '../types';
import { formatDuration } from '../domain/format';
import { getDisplayColor } from '../domain/colors';

interface Props {
  legend: LegendModel;
  stateColors: Record<string, string>;
  colorMappings?: ColorMappingOption[];
}

function sampleInterval(entry: LegendEntry): NormalizedInterval {
  const isJob = entry.kind === 'job' || entry.kind === 'selected-job' || entry.kind === 'other-jobs';
  return {
    machineId: '',
    state: isJob ? 'running' : entry.label,
    startedAt: 0,
    endedAt: 0,
    originalDurationMs: 0,
    job: isJob && entry.kind !== 'other-jobs' ? entry.label : undefined,
    dimensions: {},
  };
}

const entryRow = (
  entry: LegendEntry,
  stateColors: Record<string, string>,
  colorMappings: readonly ColorMappingOption[]
) => {
  const displayClass =
    entry.kind === 'job' ? `job:${entry.label}` : entry.kind === 'state' ? entry.label : entry.kind;
  const job = entry.kind === 'job' || entry.kind === 'selected-job' ? entry.label : undefined;
  const interval = sampleInterval(entry);
  return (
    <div key={entry.key} style={{ display: 'grid', gridTemplateColumns: '12px minmax(110px,1fr) 78px 58px 66px', gap: 6, alignItems: 'center', fontSize: 11 }}>
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: getDisplayColor(displayClass, job, stateColors, colorMappings, interval),
        }}
      />
      <span title={entry.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</span>
      <span>{formatDuration(entry.visibleDurationMs)}</span>
      <span>{entry.percent.toFixed(1)}%</span>
      <span>{entry.runCount == null ? `${entry.segmentCount} seg` : `${entry.runCount} run / ${entry.segmentCount} seg`}</span>
    </div>
  );
};

export const TimelineLegend: React.FC<Props> = ({ legend, stateColors, colorMappings = [] }) => (
  <div aria-label="Production timeline legend" style={{ overflow: 'auto', paddingTop: 6, display: 'grid', gap: 8 }}>
    {legend.jobs.length > 0 ? <section><strong style={{ fontSize: 11 }}>Jobs</strong>{legend.jobs.map((entry) => entryRow(entry, stateColors, colorMappings))}</section> : null}
    {legend.states.length > 0 ? <section><strong style={{ fontSize: 11 }}>States</strong>{legend.states.map((entry) => entryRow(entry, stateColors, colorMappings))}</section> : null}
  </div>
);
