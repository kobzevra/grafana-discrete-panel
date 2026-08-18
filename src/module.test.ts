import fs from 'node:fs';
import path from 'node:path';

test('registers the Production Timeline through PanelPlugin', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/module.ts'), 'utf8');
  expect(source).toContain('new PanelPlugin<ProductionTimelineOptions>(ProductionTimelinePanel)');
  expect(source).not.toMatch(/CanvasPanelCtrl|PanelCtrl|grafana\/app\//);
});
