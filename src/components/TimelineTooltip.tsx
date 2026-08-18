import React from 'react';
import { dateTimeFormat, type TimeZone } from '@grafana/data';
import type { DisplayInterval } from '../types';
import { formatDuration } from '../domain/format';

interface Props {
  interval: DisplayInterval;
  x: number;
  y: number;
  timeZone: TimeZone;
}

function line(label: string, value: React.ReactNode) {
  return <div><strong>{label}:</strong> {value}</div>;
}

export const TimelineTooltip: React.FC<Props> = ({ interval, x, y, timeZone }) => {
  const clipped = interval.visibleStart !== interval.startedAt || (!interval.isOpen && interval.visibleEnd !== interval.endedAt);
  const originalEnd = interval.endedAt == null ? 'current' : dateTimeFormat(interval.endedAt, { timeZone });

  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute', left: x + 12, top: y + 12, zIndex: 2,
        pointerEvents: 'none', background: 'rgba(20,20,20,.94)', color: '#fff',
        borderRadius: 4, padding: '8px 10px', maxWidth: 380, fontSize: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,.28)',
      }}
    >
      {line('Machine', interval.machineId)}
      {line('Class', interval.displayLabel)}
      {line('State', interval.state)}
      {interval.job ? line('Job', interval.job) : null}
      {line('Visible start', dateTimeFormat(interval.visibleStart, { timeZone }))}
      {line('Visible end', dateTimeFormat(interval.visibleEnd, { timeZone }))}
      {line('Visible duration', formatDuration(interval.visibleDurationMs))}
      {clipped || interval.isOpen ? <>
        {line('Original start', dateTimeFormat(interval.startedAt, { timeZone }))}
        {line('Original end', originalEnd)}
        {line(interval.isOpen ? 'Current duration' : 'Original duration', formatDuration(interval.effectiveOriginalDurationMs))}
      </> : null}
      {Object.entries(interval.dimensions).map(([key, value]) => value == null || value === '' ? null : line(key, String(value)))}
      {interval.quality ? line('Quality', interval.quality) : null}
      {interval.details ? line('Details', interval.details) : null}
    </div>
  );
};
