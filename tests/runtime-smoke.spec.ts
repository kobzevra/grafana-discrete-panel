import { expect, test } from '@playwright/test';

test('Grafana 13.1.1 renders interval and focus fixtures without runtime exceptions', async ({ page }) => {
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

  await page.goto('/d/production-timeline-smoke?orgId=1', { waitUntil: 'domcontentloaded' });

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

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Production timeline legend')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
  expect(pluginConsoleErrors).toEqual([]);
});
