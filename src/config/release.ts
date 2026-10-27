export type Track = 'stable' | 'canary';

export function resolveTrack(value: string | undefined): Track {
  return value?.trim().toLowerCase() === 'canary' ? 'canary' : 'stable';
}
