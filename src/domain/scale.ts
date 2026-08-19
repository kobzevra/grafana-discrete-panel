import type { TimelineRange, TimelineScale } from '../types.ts';
export function createTimelineScale(range: TimelineRange, left: number, right: number): TimelineScale {
  const duration = range.to - range.from; const width = Math.max(0, right - left); const pxPerMs = duration > 0 ? width / duration : 0;
  return { from: range.from, to: range.to, left, right, width, pxPerMs,
    timeToX(timeMs: number) { return duration <= 0 ? left : left + (timeMs - range.from) * pxPerMs; },
    xToTime(x: number) { return width <= 0 || duration <= 0 ? range.from : range.from + ((x - left) / width) * duration; },
  };
}
