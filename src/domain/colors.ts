const STATE_COLORS: Record<string, string> = {
  offline: '#6B7280',
  idle: '#9CA3AF',
  setup: '#F59E0B',
  ready: '#22C55E',
  queued: '#60A5FA',
  'running-unresolved': '#0EA5E9',
  paused: '#F97316',
  blocked: '#A855F7',
  error: '#DC2626',
  maintenance: '#8B5CF6',
  unknown: '#64748B',
  gap: '#CBD5E1',
  stale: '#78716C',
  'other-jobs': '#94A3B8',
  'selected-job': '#2563EB',
};

const JOB_PALETTE = [
  '#1D4ED8', '#047857', '#B45309', '#7E22CE', '#BE123C', '#0E7490',
  '#4338CA', '#15803D', '#C2410C', '#A21CAF', '#0369A1', '#4D7C0F',
  '#B91C1C', '#6D28D9', '#0F766E', '#A16207', '#1E40AF', '#166534',
] as const;

function fnv1a32Utf8(value: string): number {
  const bytes = new TextEncoder().encode(value);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function getStateColor(state: string, overrides: Record<string, string> = {}): string {
  const key = state.trim().toLowerCase();
  return overrides[key] ?? STATE_COLORS[key] ?? STATE_COLORS.unknown;
}

export function getJobColor(job: string): string {
  const key = job.trim();
  return JOB_PALETTE[fnv1a32Utf8(key) % JOB_PALETTE.length];
}

export function getDisplayColor(
  displayClass: string,
  job: string | undefined,
  stateOverrides: Record<string, string> = {}
): string {
  if (displayClass === 'selected-job' || displayClass === 'other-jobs') {
    return getStateColor(displayClass, stateOverrides);
  }
  if (displayClass.startsWith('job:') && job) {
    return getJobColor(job);
  }
  return getStateColor(displayClass, stateOverrides);
}
