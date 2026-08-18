import { expect, test } from '@playwright/test';

function absoluteRangeFromUrl(url: string): { from: number; to: number } | null {
  const parsed = new URL(url);
  const from = Number(parsed.searchParams.get('from'));
  const to = Number(parsed.searchParams.get('to'));
  return Number.isFinite(from) && Number.isFinite(to) && to > from ? { from, to } : null;
}

test('Grafana 13.1.1 renders interval, tooltip, compact layout, and time interactions without runtime exceptions', async ({ page }) => {
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
  if (box && legendBox) {
    // Two 28px rows + 24px axis: the timeline should no longer stretch to panel height.
    expect(box.height).toBeLessThanOrEqual(82);
    expect(Math.abs(legendBox.y - (box.y + box.height))).toBeLessThanOrEqual(2);

    await page.mouse.move(box.x + 160, box.y + 14);
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText('Job A');
    await expect(tooltip).toContainText('Visible start');
    await expect(tooltip).toContainText('Visible end');
    await expect(tooltip).toContainText('Visible duration');

    // Wheel pan must update Grafana's dashboard range, not only a local viewport.
    await page.mouse.move(box.x + 320, box.y + 14);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => absoluteRangeFromUrl(page.url())).not.toBeNull();
    const panned = absoluteRangeFromUrl(page.url());
    expect(panned).not.toBeNull();

    // Ctrl+wheel zooms around the cursor and changes the dashboard duration.
    if (panned) {
      const beforeDuration = panned.to - panned.from;
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -120);
      await page.keyboard.up('Control');
      await expect.poll(() => absoluteRangeFromUrl(page.url())?.to - (absoluteRangeFromUrl(page.url())?.from ?? 0)).not.toBe(beforeDuration);
      const zoomed = absoluteRangeFromUrl(page.url());
      expect(zoomed).not.toBeNull();
      if (zoomed) {
        expect(zoomed.to - zoomed.from).toBeLessThan(beforeDuration);
      }
    }
  }

  // Reload the fixture and verify drag-on-segment selection zooms the global range.
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
  const freshCanvas = page.locator('canvas[aria-label="Production timeline with 2 machine rows"]').first();
  await expect(freshCanvas).toBeVisible();
  const freshBox = await freshCanvas.boundingBox();
  expect(freshBox).not.toBeNull();
  if (freshBox) {
    await page.mouse.move(freshBox.x + 160, freshBox.y + 14);
    await page.mouse.down();
    await page.mouse.move(freshBox.x + 310, freshBox.y + 14, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => absoluteRangeFromUrl(page.url())).not.toBeNull();
    const selected = absoluteRangeFromUrl(page.url());
    expect(selected).not.toBeNull();
    if (selected) {
      expect(selected.to - selected.from).toBeLessThan(105 * 60 * 1000);
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Production timeline legend')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
  expect(pluginConsoleErrors).toEqual([]);
});
