import React, { useEffect, useMemo, useRef, useState } from 'react';
import { dateTimeFormat } from '@grafana/data';
import type { TimeZone } from '@grafana/schema';
import type {
  ColorMappingOption,
  CoverageRegion,
  DisplayInterval,
  TimelineInteractionOptions,
  TimelineRange,
} from '../types';
import { createTimelineScale } from '../domain/scale';
import { createTimelineLayout } from '../domain/layout';
import { buildHitIndex, hitTest } from '../domain/hitTest';
import { getDisplayColor } from '../domain/colors';
import { formatDuration } from '../domain/format';
import { TimelineTooltip } from './TimelineTooltip';

interface HoverState {
  interval: DisplayInterval;
  x: number;
  y: number;
}

interface DragState {
  mode: 'pan' | 'select';
  pointerId: number;
  startX: number;
  currentX: number;
  startRange: TimelineRange;
}

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
  colorMappings?: ColorMappingOption[];
  interactions?: TimelineInteractionOptions;
  onChangeTimeRange?: (range: TimelineRange) => void;
}

const DEFAULT_INTERACTIONS: TimelineInteractionOptions = {
  dragPan: true,
  segmentZoom: true,
  wheelPan: true,
  ctrlWheelZoom: true,
  shiftWheelPan: true,
};

function tickCount(width: number): number {
  return Math.max(2, Math.min(8, Math.floor(width / 120)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const TimelineCanvas: React.FC<Props> = ({
  intervals,
  noData,
  machineIds,
  range,
  width,
  height,
  rowHeight,
  showAxis,
  timeZone,
  stateColors,
  colorMappings = [],
  interactions = DEFAULT_INTERACTIONS,
  onChangeTimeRange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selection, setSelection] = useState<{ startX: number; currentX: number } | null>(null);
  const layout = useMemo(
    () => createTimelineLayout({ width, height, machineCount: machineIds.length, rowHeight, showAxis }),
    [width, height, machineIds.length, rowHeight, showAxis]
  );
  const scale = useMemo(
    () => createTimelineScale(range, layout.plotLeft, layout.plotRight),
    [range, layout.plotLeft, layout.plotRight]
  );
  const hitIndex = useMemo(() => buildHitIndex(intervals), [intervals]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onChangeTimeRange) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      if (scale.width <= 0) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < layout.plotLeft || x > layout.plotRight) {
        return;
      }
      const duration = range.to - range.from;
      if (duration <= 0) {
        return;
      }

      if (event.ctrlKey) {
        if (!interactions.ctrlWheelZoom) {
          return;
        }
        event.preventDefault();
        setHover(null);
        const cursorTime = scale.xToTime(x);
        const anchor = (cursorTime - range.from) / duration;
        const factor = Math.exp(event.deltaY * 0.002);
        const newDuration = clamp(duration * factor, 1000, 10 * 365 * 24 * 60 * 60 * 1000);
        const from = cursorTime - anchor * newDuration;
        onChangeTimeRange({ from, to: from + newDuration });
        return;
      }

      if (!interactions.wheelPan) {
        return;
      }
      event.preventDefault();
      setHover(null);
      const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const multiplier = event.shiftKey && interactions.shiftWheelPan ? 3 : 1;
      const deltaMs = (rawDelta * multiplier * duration) / Math.max(200, scale.width);
      onChangeTimeRange({ from: range.from + deltaMs, to: range.to + deltaMs });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [interactions, layout.plotLeft, layout.plotRight, onChangeTimeRange, range, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(height * devicePixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';

    const rowIndex = new Map(machineIds.map((id, index) => [id, index]));
    ctx.strokeStyle = 'rgba(128,128,128,.25)';
    ctx.fillStyle = 'rgba(128,128,128,.85)';
    for (let index = 0; index < machineIds.length; index += 1) {
      const top = layout.rowTop(index);
      ctx.beginPath();
      ctx.moveTo(0, top + layout.effectiveRowHeight);
      ctx.lineTo(width, top + layout.effectiveRowHeight);
      ctx.stroke();
      ctx.fillText(machineIds[index], 6, layout.rowCenter(index));
    }

    for (const gap of noData) {
      const index = rowIndex.get(gap.machineId);
      if (index == null) {
        continue;
      }
      const x1 = scale.timeToX(gap.start);
      const x2 = scale.timeToX(gap.end);
      ctx.fillStyle = 'rgba(128,128,128,.08)';
      ctx.fillRect(
        x1,
        layout.rowTop(index) + 2,
        Math.max(0, x2 - x1),
        Math.max(1, layout.effectiveRowHeight - 4)
      );
    }

    for (const interval of intervals) {
      const index = rowIndex.get(interval.machineId);
      if (index == null) {
        continue;
      }
      const x1 = scale.timeToX(interval.visibleStart);
      const x2 = scale.timeToX(interval.visibleEnd);
      const y = layout.rowTop(index) + 3;
      const segmentHeight = Math.max(2, layout.effectiveRowHeight - 6);
      ctx.fillStyle = getDisplayColor(interval.displayClass, interval.job, stateColors, colorMappings, interval);
      ctx.fillRect(x1, y, Math.max(1, x2 - x1), segmentHeight);
      if (x2 - x1 > 52) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x1 + 2, y, Math.max(0, x2 - x1 - 4), segmentHeight);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillText(interval.displayLabel, x1 + 5, y + segmentHeight / 2);
        ctx.restore();
      }
    }

    if (showAxis && scale.width > 0) {
      const count = tickCount(scale.width);
      ctx.strokeStyle = 'rgba(128,128,128,.35)';
      ctx.fillStyle = 'rgba(128,128,128,.9)';
      ctx.textAlign = 'center';
      for (let index = 0; index <= count; index += 1) {
        const time = range.from + ((range.to - range.from) * index) / count;
        const x = scale.timeToX(time);
        ctx.beginPath();
        ctx.moveTo(x, layout.plotBottom);
        ctx.lineTo(x, layout.plotBottom + 4);
        ctx.stroke();
        ctx.fillText(dateTimeFormat(time, { timeZone, format: 'HH:mm' }), x, layout.plotBottom + 14);
      }
      ctx.textAlign = 'start';
    }

    if (selection) {
      const x1 = clamp(Math.min(selection.startX, selection.currentX), layout.plotLeft, layout.plotRight);
      const x2 = clamp(Math.max(selection.startX, selection.currentX), layout.plotLeft, layout.plotRight);
      ctx.fillStyle = 'rgba(100,160,255,.18)';
      ctx.fillRect(x1, 0, Math.max(0, x2 - x1), layout.plotBottom);
      ctx.strokeStyle = 'rgba(120,180,255,.9)';
      ctx.strokeRect(x1 + 0.5, 0.5, Math.max(0, x2 - x1 - 1), Math.max(0, layout.plotBottom - 1));
    }
  }, [
    colorMappings,
    height,
    intervals,
    layout,
    machineIds,
    noData,
    range,
    scale,
    selection,
    showAxis,
    stateColors,
    timeZone,
    width,
  ]);

  const pointForEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const intervalAt = (x: number, y: number): DisplayInterval | null => {
    if (x < layout.plotLeft || x >= layout.plotRight || y < 0 || y >= layout.plotBottom) {
      return null;
    }
    const row = Math.floor(y / layout.effectiveRowHeight);
    const machineId = machineIds[row];
    return machineId ? hitTest(hitIndex, machineId, scale.xToTime(x)) : null;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !onChangeTimeRange) {
      return;
    }
    const { x, y } = pointForEvent(event);
    if (x < layout.plotLeft || x > layout.plotRight || y < 0 || y > layout.plotBottom + layout.axisHeight) {
      return;
    }
    const interval = intervalAt(x, y);
    const mode = interval && interactions.segmentZoom ? 'select' : interactions.dragPan ? 'pan' : null;
    if (!mode) {
      return;
    }
    setHover(null);
    dragRef.current = { mode, pointerId: event.pointerId, startX: x, currentX: x, startRange: { ...range } };
    if (mode === 'select') {
      setSelection({ startX: x, currentX: x });
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pointForEvent(event);
    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      drag.currentX = x;
      setHover(null);
      if (drag.mode === 'select') {
        setSelection({ startX: drag.startX, currentX: x });
      }
      return;
    }

    const interval = intervalAt(x, y);
    setHover(interval ? { interval, x, y } : null);
  };

  const finishDrag = (event: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const { x } = pointForEvent(event);
    dragRef.current = null;
    setSelection(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (cancelled || !onChangeTimeRange) {
      return;
    }

    const deltaX = x - drag.startX;
    if (Math.abs(deltaX) < 4 || scale.width <= 0) {
      return;
    }
    if (drag.mode === 'pan') {
      const duration = drag.startRange.to - drag.startRange.from;
      const deltaMs = -(deltaX / scale.width) * duration;
      onChangeTimeRange({ from: drag.startRange.from + deltaMs, to: drag.startRange.to + deltaMs });
      return;
    }

    const x1 = clamp(Math.min(drag.startX, x), layout.plotLeft, layout.plotRight);
    const x2 = clamp(Math.max(drag.startX, x), layout.plotLeft, layout.plotRight);
    const from = scale.xToTime(x1);
    const to = scale.xToTime(x2);
    if (to > from) {
      onChangeTimeRange({ from, to });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => finishDrag(event);
  const onPointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => finishDrag(event, true);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Production timeline with ${machineIds.length} machine rows`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => {
          if (!dragRef.current) {
            setHover(null);
          }
        }}
        style={{ touchAction: 'none', cursor: 'default' }}
      />
      {hover ? <TimelineTooltip interval={hover.interval} x={hover.x} y={hover.y} timeZone={timeZone} /> : null}
      <ul style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {intervals.map((interval, index) => (
          <li key={`${interval.machineId}-${interval.visibleStart}-${index}`}>
            {interval.machineId}: {interval.displayLabel}, {formatDuration(interval.visibleDurationMs)}
          </li>
        ))}
      </ul>
    </div>
  );
};
