import { describe, expect, it } from 'vitest';
import { resolveNowPlaying, resolveUpNext } from '../src/services/playback-resolver.service.js';

describe('resolveNowPlaying', () => {
  it('returns fallback when no schedule and no override', async () => {
    const app: any = {
      prisma: {
        playbackOverride: { findFirst: async () => null },
        scheduleItem: { findMany: async () => [] },
        media: {
          findFirst: async () => ({
            id: 'm1',
            title: 'Fallback',
            sourceType: 'LOCAL',
            publicUrl: '/uploads/fallback.mp3'
          })
        }
      }
    };

    const nowPlaying = await resolveNowPlaying(app, 'inst');
    expect(nowPlaying?.source).toBe('fallback');
    expect(nowPlaying?.media.playback.sourceType).toBe('arquivo_local');
  });

  it('returns next scheduled when no current item and no fallback', async () => {
    const app: any = {
      prisma: {
        playbackOverride: { findFirst: async () => null },
        scheduleItem: {
          findMany: async () => ([
            {
              id: 's1',
              title: 'Programa da tarde',
              weekday: 1,
              startTime: '15:00',
              endTime: '16:00',
              media: { id: 'm1', sourceType: 'YOUTUBE', youtubeVideoId: 'dQw4w9WgXcQ', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
              program: null
            }
          ])
        },
        media: { findFirst: async () => null }
      }
    };

    const nowPlaying = await resolveNowPlaying(app, 'inst', new Date('2025-01-06T14:00:00.000Z'));
    expect(nowPlaying?.source).toBe('next_scheduled');
    expect(nowPlaying?.media.playback.sourceType).toBe('youtube');
  });
});

describe('resolveUpNext', () => {
  it('returns only future items with requested limit', async () => {
    const app: any = {
      prisma: {
        scheduleItem: {
          findMany: async () => ([
            {
              id: 's1',
              title: 'Item 1',
              weekday: 1,
              startTime: '14:30',
              endTime: '15:00',
              media: { id: 'm1', sourceType: 'LOCAL', publicUrl: '/uploads/1.mp3' },
              program: null
            },
            {
              id: 's2',
              title: 'Item 2',
              weekday: 1,
              startTime: '15:00',
              endTime: '16:00',
              media: { id: 'm2', sourceType: 'YOUTUBE', youtubeVideoId: 'dQw4w9WgXcQ', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
              program: null
            }
          ])
        }
      }
    };

    const upNext = await resolveUpNext(app, 'inst', new Date('2025-01-06T14:00:00.000Z'), 1);
    expect(upNext).toHaveLength(1);
    expect(upNext[0]?.id).toBe('s1');
  });
});
