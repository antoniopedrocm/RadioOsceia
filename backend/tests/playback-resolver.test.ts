import { describe, expect, it } from 'vitest';
import { resolveNowPlaying } from '../src/services/playback-resolver.service.js';

describe('resolveNowPlaying', () => {
  it('returns fallback when no schedule and no override', async () => {
    const app: any = {
      prisma: {
        playbackOverride: { findFirst: async () => null },
        scheduleItem: { findMany: async () => [] },
        media: { findFirst: async () => ({ id: 'm1', title: 'Fallback', sourceType: 'LOCAL' }) }
      }
    };

    const nowPlaying = await resolveNowPlaying(app, 'inst');
    expect(nowPlaying?.source).toBe('fallback');
  });
});
