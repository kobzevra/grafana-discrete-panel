import { DEFAULT_OPTIONS, normalizeOptions } from './panelOptions';

test('original duration is opt-in so unknown upstream units are never assumed to be milliseconds', () => {
  expect(DEFAULT_OPTIONS.fields.originalDuration).toBe('');
  expect(normalizeOptions(undefined).fields.originalDuration).toBe('');
});
