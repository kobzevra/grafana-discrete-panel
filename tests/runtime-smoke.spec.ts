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

test('Grafana 13.1.1 renders interval, tooltip, compact layout, and diagnoses time interactions', async ({ page }) => {
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

  const legends = page.getByLabel('Production timeline legend');
  await expect(legends).toHaveCount(2);
  const legendTexts = await legends.allTextContents();
  expect(legendTexts.some((text) => text.includes('Job A') && text.includes('01:10:00') && text.includes('paused'))).toBe(true);

  const box = await canvases.first().boundingBox();
  const legendBox = await legends.first().boundingBox();
  expect(box).not.toBeNull();
  expect(legendBox).not.toBeNull();
  if (!box || !legendBox) {
    return;
  }

  expect(box.height).toBeLessThanOrEqual(82);
  expect(Math.abs(legendBox.y - (box.y + box.height))).toBeLessThanOrEqual(2);

  await page.mouse.move(box.x + 160, box.y + 14);
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Job A');
  await expect(tooltip).toContainText('Visible duration');

  const timeButton = page.getByRole('button', { name: /Time range selected:/ });
  const beforeLabel = await timeButton.getAttribute('aria-label');
  const beforeRange = absoluteRangeFromUrl(page.url());
  expect(beforeRange).not.toBeNull();

  await canvases.first().evaluate((canvas) => {
    canvas.addEventListener('wheel', () => {
      canvas.setAttribute('data-native-wheel-seen', 'yes');
    });
  });
  await page.mouse.move(box.x + 320, box.y + 14);
  await page.mouse.wheel(0, 120);
  const nativeWheelSeen = await canvases.first().getAttribute('data-native-wheel-seen');
  const afterPhysicalWheelLabel = await timeButton.getAttribute('aria-label');
  console.log('DIAG physical wheel', { nativeWheelSeen, beforeLabel, afterPhysicalWheelLabel, url: page.url() });

  await canvases.first().dispatchEvent('wheel', { deltaX: 0, deltaY: 120, clientX: 320, clientY: 14, bubbles: true, cancelable: true });
  await page.waitForTimeout(300);
  const afterDispatchedWheelLabel = await timeButton.getAttribute('aria-label');
  console.log('DIAG dispatched wheel', { afterDispatchedWheelLabel, url: page.url() });

  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
  const freshCanvas = page.locator('canvas[aria-label="Production timeline with 2 machine rows"]').first();
  await expect(freshCanvas).toBeVisible();
  const freshBox = await freshCanvas.boundingBox();
  const beforeDragLabel = await page.getByRole('button', { name: /Time range selected:/ }).getAttribute('aria-label');
  expect(freshBox).not.toBeNull();
  if (freshBox) {
    await page.mouse.move(freshBox.x + 320, freshBox.y + 68);
    await page.mouse.down();
    await page.mouse.move(freshBox.x + 400, freshBox.y + 68, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    console.log('DIAG drag axis', {
      beforeDragLabel,
      afterDragLabel: await page.getByRole('button', { name: /Time range selected:/ }).getAttribute('aria-label'),
      url: page.url(),
    });
  }

  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
  const selectCanvas = page.locator('canvas[aria-label="Production timeline with 2 machine rows"]').first();
  await expect(selectCanvas).toBeVisible();
  const selectBox = await selectCanvas.boundingBox();
  const beforeSelectLabel = await page.getByRole('button', { name: /Time range selected:/ }).getAttribute('aria-label');
  expect(selectBox).not.toBeNull();
  if (selectBox) {
    await page.mouse.move(selectBox.x + 160, selectBox.y + 14);
    await page.mouse.down();
    await page.mouse.move(selectBox.x + 310, selectBox.y + 14, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    console.log('DIAG drag segment', {
      beforeSelectLabel,
      afterSelectLabel: await page.getByRole('button', { name: /Time range selected:/ }).getAttribute('aria-label'),
      url: page.url(),
    });
  }

  expect(nativeWheelSeen).toBe('yes');
  expect(pageErrors).toEqual([]);
  expect(pluginConsoleErrors).toEqual([]);
});
