import React, { useEffect, useMemo, useRef, useState } from 'react';
import { dateTimeFormat, type TimeZone } from '@grafana/data';
import type { CoverageRegion, DisplayInterval, TimelineRange } from '../types';
import { createTimelineScale } from '../domain/scale';
import { createTimelineLayout } from '../domain/layout';
import { buildHitIndex, hitTest } from '../domain/hitTest';
import { getDisplayColor } from '../domain/colors';
import { TimelineTooltip } from './TimelineTooltip';

interface HoverState { interval: DisplayInterval; x: number; y: number }
interface Props {
  intervals: DisplayInterval[];
  noData: CoverageRegion[];
  machineIds: string[];
  range: TimelineRange;
  width: number;
  height: number;
  rowHeight: number;
  showAxis: boolean;
  timeZone: TimeZone;
  stateColors: Record<string, string>;
}

function tickCount(width: number) { return Math.max(2, Math.min(8, Math.floor(width / 120))); }

export const TimelineCanvas: React.FC<Props> = ({ intervals, noData, machineIds, range, width, height, rowHeight, showAxis, timeZone, stateColors }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const layout = useMemo(() => createTimelineLayout({ width, height, machineCount: machineIds.length, rowHeight, showAxis }), [width, height, machineIds.length, rowHeight, showAxis]);
  const scale = useMemo(() => createTimelineScale(range, layout.plotLeft, layout.plotRight), [range.from, range.to, layout.plotLeft, layout.plotRight]);
  const hitIndex = useMemo(() => buildHitIndex(intervals), [intervals]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(height * devicePixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';

    const rowIndex = new Map(machineIds.map((id, index) => [id, index]));
    ctx.strokeStyle = 'rgba(128,128,128,.25)';
    ctx.fillStyle = 'rgba(128,128,128,.85)';
    for (let i = 0; i < machineIds.length; i++) {
      const top = layout.rowTop(i);
      ctx.beginPath(); ctx.moveTo(0, top + layout.effectiveRowHeight); ctx.lineTo(width, top + layout.effectiveRowHeight); ctx.stroke();
      ctx.fillText(machineIds[i], 6, layout.rowCenter(i));
    }

    for (const gap of noData) {
      const index = rowIndex.get(gap.machineId); if (index == null) continue;
      const x1 = scale.timeToX(gap.start); const x2 = scale.timeToX(gap.end);
      ctx.fillStyle = 'rgba(128,128,128,.08)';
      ctx.fillRect(x1, layout.rowTop(index) + 2, Math.max(0, x2 - x1), Math.max(1, layout.effectiveRowHeight - 4));
    }

    for (const interval of intervals) {
      const index = rowIndex.get(interval.machineId); if (index == null) continue;
      const x1 = scale.timeToX(interval.visibleStart); const x2 = scale.timeToX(interval.visibleEnd);
      const y = layout.rowTop(index) + 3; const h = Math.max(2, layout.effectiveRowHeight - 6);
      ctx.fillStyle = getDisplayColor(interval.displayClass, interval.job, stateColors);
      ctx.fillRect(x1, y, Math.max(1, x2 - x1), h);
      if (x2 - x1 > 52) {
        ctx.save(); ctx.beginPath(); ctx.rect(x1 + 2, y, Math.max(0, x2 - x1 - 4), h); ctx.clip();
        ctx.fillStyle = '#fff'; ctx.fillText(interval.displayLabel, x1 + 5, y + h / 2); ctx.restore();
      }
    }

    if (showAxis && scale.width > 0) {
      const count = tickCount(scale.width);
      ctx.strokeStyle = 'rgba(128,128,128,.35)'; ctx.fillStyle = 'rgba(128,128,128,.9)'; ctx.textAlign = 'center';
      for (let i = 0; i <= count; i++) {
        const t = range.from + ((range.to - range.from) * i) / count;
        const x = scale.timeToX(t);
        ctx.beginPath(); ctx.moveTo(x, layout.plotBottom); ctx.lineTo(x, layout.plotBottom + 4); ctx.stroke();
        ctx.fillText(dateTimeFormat(t, { timeZone, format: 'HH:mm' }), x, layout.plotBottom + 14);
      }
      ctx.textAlign = 'start';
    }
  }, [height, intervals, layout, machineIds, noData, range.from, range.to, scale, showAxis, stateColors, timeZone, width]);

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    if (x < layout.plotLeft || x >= layout.plotRight || y < 0 || y >= layout.plotBottom) { setHover(null); return; }
    const row = Math.floor(y / layout.effectiveRowHeight);
    const machineId = machineIds[row];
    if (!machineId) { setHover(null); return; }
    const interval = hitTest(hitIndex, machineId, scale.xToTime(x));
    setHover(interval ? { interval, x, y } : null);
  };

  return (
    <div style={{ position: 'relative', width, height }} role="img" aria-label={`Production timeline with ${machineIds.length} machine rows`}>
      <canvas ref={canvasRef} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)} />
      {hover ? <TimelineTooltip interval={hover.interval} x={hover.x} y={hover.y} timeZone={timeZone} /> : null}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {intervals.map((i, idx) => <span key={`${i.machineId}-${i.visibleStart}-${idx}`}>{i.machineId}: {i.displayLabel}</span>)}
      </div>
    </div>
  );
};
