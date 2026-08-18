import React from 'react';
import type { LegendEntry, LegendModel } from '../types';
import { formatDuration } from '../domain/format';
import { getDisplayColor } from '../domain/colors';

interface Props {
  legend: LegendModel;
  stateColors: Record<string, string>;
}

const entryRow = (entry: LegendEntry, stateColors: Record<string, string>) => {
  const displayClass = entry.kind === 'job' ? `job:${entry.label}` : entry.kind;
  const job = entry.kind === 'job' ? entry.label : undefined;
  return (
    <div key={entry.key} style={{ display: 'grid', gridTemplateColumns: '12px minmax(110px,1fr) 78px 58px 66px', gap: 6, alignItems: 'center', fontSize: 11 }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: getDisplayColor(displayClass, job, stateColors) }} />
      <span title={entry.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</span>
      <span>{formatDuration(entry.visibleDurationMs)}</span>
      <span>{entry.percent.toFixed(1)}%</span>
      <span>{entry.runCount == null ? `${entry.segmentCount} seg` : `${entry.runCount} run / ${entry.segmentCount} seg`}</span>
    </div>
  );
};

export const TimelineLegend: React.FC<Props> = ({ legend, stateColors }) => (
  <div aria-label="Production timeline legend" style={{ overflow: 'auto', paddingTop: 6, display: 'grid', gap: 8 }}>
    {legend.jobs.length > 0 ? <section><strong style={{ fontSize: 11 }}>Jobs</strong>{legend.jobs.map((entry) => entryRow(entry, stateColors))}</section> : null}
    {legend.states.length > 0 ? <section><strong style={{ fontSize: 11 }}>States</strong>{legend.states.map((entry) => entryRow(entry, stateColors))}</section> : null}
  </div>
);
