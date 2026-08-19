import { expect, test } from '@playwright/test';

function timeParamMs(value: string | null): number {
  if (!value) {
    return Number.NaN;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return Date.parse(value);
}

function absoluteRangeFromUrl(url: string): { from: number; to: number } | null {
  const parsed = new URL(url);
  const from = timeParamMs(parsed.searchParams.get('from'));
  const to = timeParamMs(parsed.searchParams.get('to'));
  return Number.isFinite(from) && Number.isFinite(to) && to > from ? { from, to } : null;
}

async function selectedRangeLabel(page: import('@playwright/test').Page): Promise<string> {
  return (await page.getByRole('button', { name: /Time range selected:/ }).getAttribute('aria-label')) ?? '';
}

test('Grafana 13.1.1 renders interval, tooltip, compact layout, and dashboard time interactions', async ({ page }) => {
  const pageErrors: string[] = [];
  const pluginConsoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (/production timeline|kobzevra-production-timeline|react/i.test(text)) {
        pluginConsoleErrors.push(text);
      }
    }
  });

  const dashboardUrl = '/d/production-timeline-smoke?orgId=1';
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });

  const canvases = page.locator('canvas[aria-label="Production timeline with 2 machine rows"]');
  await expect(canvases).toHaveCount(2);
  await expect(canvases.first()).toBeVisible();
  await expect(canvases.nth(1)).toBeVisible();

  const legends = page.getByLabel('Production timeline legend');
  await expect(legends).toHaveCount(2);
  const legendTexts = await legends.allTextContents();
  expect(
    legendTexts.some(
      (text) =>
        text.includes('Job A') &&
        text.includes('01:10:00') &&
        text.includes('Job B') &&
        text.includes('00:20:00') &&
        text.includes('paused') &&
        text.includes('00:15:00')
    )
  ).toBe(true);
  expect(
    legendTexts.some(
      (text) =>
        text.includes('Job A') &&
        text.includes('01:10:00') &&
        text.includes('Other jobs') &&
        text.includes('00:20:00') &&
        text.includes('paused') &&
        text.includes('00:15:00')
    )
  ).toBe(true);

  const box = await canvases.first().boundingBox();
  const legendBox = await legends.first().boundingBox();
  expect(box).not.toBeNull();
  expect(legendBox).not.toBeNull();
  if (!box || !legendBox) {
    return;
  }

  // Two 28px rows + 24px axis: timeline is compact and legend begins immediately below it.
  expect(box.height).toBeLessThanOrEqual(82);
  expect(Math.abs(legendBox.y - (box.y + box.height))).toBeLessThanOrEqual(2);

  await page.mouse.move(box.x + 160, box.y + 14);
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Job A');
  await expect(tooltip).toContainText('Visible start');
  await expect(tooltip).toContainText('Visible end');
  await expect(tooltip).toContainText('Visible duration');

  // Physical mouse wheel pans the global dashboard range while preserving duration.
  const beforeWheelLabel = await selectedRangeLabel(page);
  const beforeWheel = absoluteRangeFromUrl(page.url());
  expect(beforeWheel).not.toBeNull();
  await page.mouse.move(box.x + 320, box.y + 14);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => selectedRangeLabel(page)).not.toBe(beforeWheelLabel);
  const afterWheel = absoluteRangeFromUrl(page.url());
  expect(afterWheel).not.toBeNull();
  if (beforeWheel && afterWheel) {
    expect(afterWheel.to - afterWheel.from).toBe(beforeWheel.to - beforeWheel.from);
  }

  // Ctrl+wheel zooms around the cursor and shortens the dashboard range.
  const beforeZoom = absoluteRangeFromUrl(page.url());
  expect(beforeZoom).not.toBeNull();
  if (beforeZoom) {
    const beforeZoomLabel = await selectedRangeLabel(page);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await expect.poll(() => selectedRangeLabel(page)).not.toBe(beforeZoomLabel);
    const afterZoom = absoluteRangeFromUrl(page.url());
    expect(afterZoom).not.toBeNull();
    if (afterZoom) {
      expect(afterZoom.to - afterZoom.from).toBeLessThan(beforeZoom.to - beforeZoom.from);
    }
  }

  // Dragging the axis/empty timeline pans the global range.
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
  let canvas = page.locator('canvas[aria-label="Production timeline with 2 machine rows"]').first();
  await expect(canvas).toBeVisible();
  let currentBox = await canvas.boundingBox();
  const beforeDragPanLabel = await selectedRangeLabel(page);
  const beforeDragPan = absoluteRangeFromUrl(page.url());
  expect(currentBox).not.toBeNull();
  if (currentBox) {
    await page.mouse.move(currentBox.x + 320, currentBox.y + 68);
    await page.mouse.down();
    await page.mouse.move(currentBox.x + 400, currentBox.y + 68, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => selectedRangeLabel(page)).not.toBe(beforeDragPanLabel);
    const afterDragPan = absoluteRangeFromUrl(page.url());
    expect(afterDragPan).not.toBeNull();
    if (beforeDragPan && afterDragPan) {
      expect(afterDragPan.to - afterDragPan.from).toBe(beforeDragPan.to - beforeDragPan.from);
    }
  }

  // Dragging a colored segment selects a narrower dashboard range.
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
  canvas = page.locator('canvas[aria-label="Production timeline with 2 machine rows"]').first();
  await expect(canvas).toBeVisible();
  currentBox = await canvas.boundingBox();
  const beforeSelectionLabel = await selectedRangeLabel(page);
  const beforeSelection = absoluteRangeFromUrl(page.url());
  expect(currentBox).not.toBeNull();
  if (currentBox) {
    await page.mouse.move(currentBox.x + 160, currentBox.y + 14);
    await page.mouse.down();
    await page.mouse.move(currentBox.x + 310, currentBox.y + 14, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => selectedRangeLabel(page)).not.toBe(beforeSelectionLabel);
    const afterSelection = absoluteRangeFromUrl(page.url());
    expect(afterSelection).not.toBeNull();
    if (beforeSelection && afterSelection) {
      expect(afterSelection.to - afterSelection.from).toBeLessThan(beforeSelection.to - beforeSelection.from);
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Production timeline legend')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
  expect(pluginConsoleErrors).toEqual([]);
});
