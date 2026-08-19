export interface TimelineLayout {
  plotLeft: number;
  plotRight: number;
  plotBottom: number;
  axisHeight: number;
  effectiveRowHeight: number;
  contentHeight: number;
  rowTop(index: number): number;
  rowCenter(index: number): number;
}

export function createTimelineLayout(args: {
  width: number;
  height: number;
  machineCount: number;
  rowHeight: number;
  showAxis: boolean;
  labelWidth?: number;
}): TimelineLayout {
  const labelWidth = Math.min(args.labelWidth ?? 140, Math.max(0, args.width * 0.45));
  const axisHeight = args.showAxis ? 24 : 0;
  const availableRowsHeight = Math.max(0, args.height - axisHeight);
  const fitHeight = args.machineCount > 0 ? Math.floor(availableRowsHeight / args.machineCount) : args.rowHeight;
  const effectiveRowHeight =
    args.machineCount > 0 ? Math.max(8, Math.min(args.rowHeight, fitHeight || args.rowHeight)) : args.rowHeight;
  const plotBottom = Math.max(0, args.machineCount * effectiveRowHeight);
  const contentHeight = Math.min(args.height, plotBottom + axisHeight);

  return {
    plotLeft: labelWidth,
    plotRight: args.width,
    plotBottom,
    axisHeight,
    effectiveRowHeight,
    contentHeight,
    rowTop: (index) => index * effectiveRowHeight,
    rowCenter: (index) => index * effectiveRowHeight + effectiveRowHeight / 2,
  };
}
