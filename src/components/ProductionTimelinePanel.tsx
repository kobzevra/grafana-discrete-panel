import React, { useEffect, useMemo, useState } from 'react';
import type { PanelProps } from '@grafana/data';
import type { ProductionTimelineOptions } from '../types';
import { buildTimelineModel } from '../domain/pipeline';
import { normalizeOptions, resolvePanelBehavior } from '../domain/panelOptions';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineLegend } from './TimelineLegend';

export const ProductionTimelinePanel: React.FC<PanelProps<ProductionTimelineOptions>> = ({
  data, width, height, timeRange, timeZone, options, replaceVariables,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const behavior = useMemo(
    () => resolvePanelBehavior(normalizedOptions, (value) => replaceVariables(value)),
    [normalizedOptions, replaceVariables]
  );
  const range = useMemo(() => ({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() }), [timeRange.from, timeRange.to]);
  const model = useMemo(() => buildTimelineModel({
    frames: data.series,
    mappings: normalizedOptions.fields,
    range,
    nowMs,
    dimensionFilters: behavior.dimensionFilters,
    durationRules: behavior.durationRules,
    focusJob: behavior.focusJob,
  }), [behavior, data.series, nowMs, normalizedOptions.fields, range]);
  const hasOpenIntervals = model.intervals.some((row) => row.isOpen);
  useEffect(() => {
    if (!hasOpenIntervals) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasOpenIntervals]);

  const diagnostics = [...behavior.diagnostics, ...model.diagnostics];

  if (model.blocked) {
    return <div style={{ padding: 12, overflow: 'auto', width, height }}><strong>Production Timeline cannot calculate exact totals.</strong>{diagnostics.map((d, i) => <div key={`${d.code}-${i}`}>{d.code}: {d.message}</div>)}</div>;
  }

  const legendHeight = normalizedOptions.showLegend ? Math.min(150, Math.max(70, height * 0.3)) : 0;
  const canvasHeight = Math.max(40, height - legendHeight);
  return (
    <div style={{ width, height, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {diagnostics.filter((d) => d.severity !== 'info').map((d, i) => <div key={`${d.code}-${i}`} style={{ fontSize: 11, padding: '2px 6px' }}>{d.message}</div>)}
      <TimelineCanvas
        intervals={model.intervals}
        noData={model.noData}
        machineIds={model.machineIds}
        range={range}
        width={width}
        height={canvasHeight}
        rowHeight={normalizedOptions.rowHeight}
        showAxis={normalizedOptions.showAxis}
        timeZone={timeZone}
        stateColors={normalizedOptions.stateColors}
      />
      {normalizedOptions.showLegend && model.legend ? <div style={{ height: legendHeight, overflow: 'auto', padding: '0 6px' }}><TimelineLegend legend={model.legend} stateColors={normalizedOptions.stateColors} /></div> : null}
    </div>
  );
};
