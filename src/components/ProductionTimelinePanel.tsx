import React, { useEffect, useMemo, useState } from 'react';
import type { PanelProps } from '@grafana/data';
import type { ProductionTimelineOptions } from '../types';
import { buildTimelineModel } from '../domain/pipeline';
import { normalizeOptions, resolvePanelBehavior } from '../domain/panelOptions';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineLegend } from './TimelineLegend';

export const ProductionTimelinePanel: React.FC<PanelProps<ProductionTimelineOptions>> = ({
  data,
  width,
  height,
  timeRange,
  timeZone,
  options,
  replaceVariables,
  onChangeTimeRange,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const behavior = useMemo(
    () => resolvePanelBehavior(normalizedOptions, (value) => replaceVariables(value)),
    [normalizedOptions, replaceVariables]
  );
  const range = useMemo(
    () => ({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() }),
    [timeRange.from, timeRange.to]
  );
  const model = useMemo(
    () =>
      buildTimelineModel({
        frames: data.series,
        mappings: normalizedOptions.fields,
        range,
        nowMs,
        dimensionFilters: behavior.dimensionFilters,
        fieldFilters: behavior.fieldFilters,
        durationRules: behavior.durationRules,
        focusJob: behavior.focusJob,
      }),
    [behavior, data.series, nowMs, normalizedOptions.fields, range]
  );

  const hasOpenIntervals = model.intervals.some((row) => row.isOpen);
  useEffect(() => {
    if (!hasOpenIntervals) {
      return undefined;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasOpenIntervals]);

  const diagnostics = [...behavior.diagnostics, ...model.diagnostics];
  if (model.blocked) {
    return (
      <div style={{ padding: 12, overflow: 'auto', width, height }}>
        <strong>Production Timeline cannot calculate exact totals.</strong>
        {diagnostics.map((diagnostic, index) => (
          <div key={`${diagnostic.code}-${index}`}>
            {diagnostic.code}: {diagnostic.message}
          </div>
        ))}
      </div>
    );
  }

  const diagnosticHeight = diagnostics.length > 0 ? Math.min(56, 18 * diagnostics.length) : 0;
  const availableHeight = Math.max(24, height - diagnosticHeight);
  const preferredCanvasHeight =
    model.machineIds.length * normalizedOptions.rowHeight + (normalizedOptions.showAxis ? 24 : 0);
  const minimumLegendHeight = normalizedOptions.showLegend ? Math.min(70, Math.max(0, availableHeight - 24)) : 0;
  const canvasHeight = Math.max(
    24,
    Math.min(preferredCanvasHeight || 24, Math.max(24, availableHeight - minimumLegendHeight))
  );

  return (
    <div style={{ width, height, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {diagnostics.length > 0 ? (
        <div style={{ flex: '0 0 auto', maxHeight: diagnosticHeight, overflow: 'auto', fontSize: 11 }}>
          {diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.code}-${index}`} style={{ padding: '2px 6px' }}>
              {diagnostic.message}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ flex: '0 0 auto', height: canvasHeight }}>
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
          colorMappings={normalizedOptions.colorMappings}
          interactions={normalizedOptions.interactions}
          onChangeTimeRange={(nextRange) => onChangeTimeRange(nextRange)}
        />
      </div>
      {normalizedOptions.showLegend && model.legend ? (
        <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '0 6px' }}>
          <TimelineLegend
            legend={model.legend}
            stateColors={normalizedOptions.stateColors}
            colorMappings={normalizedOptions.colorMappings}
          />
        </div>
      ) : null}
    </div>
  );
};
