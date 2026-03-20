import { describe, expect, it } from 'vitest';
import { resolveSequenceTimeline } from '../src/services/playback-resolver.service.js';

describe('resolveSequenceTimeline', () => {
  it('resolve sequência com FIXED_TIME', () => {
    const sequence: any = {
      items: [
        { id: '1', orderIndex: 1, startMode: 'FIXED_TIME', fixedStartTime: '08:00', media: { id: 'm1', title: 'Intro', sourceType: 'LOCAL', mediaType: 'INTRODUCAO', durationSeconds: 120 } },
        { id: '2', orderIndex: 2, startMode: 'FIXED_TIME', fixedStartTime: '08:05', media: { id: 'm2', title: 'Talk', sourceType: 'YOUTUBE', mediaType: 'PROGRAMA', durationSeconds: 1800 } }
      ]
    };

    const { timeline, conflicts } = resolveSequenceTimeline(sequence, new Date('2025-01-06T00:00:00.000Z'));
    expect(conflicts).toHaveLength(0);
    expect(timeline[0].startAt.toISOString()).toContain('T08:00:00.000Z');
    expect(timeline[1].startAt.toISOString()).toContain('T08:05:00.000Z');
  });

  it('resolve sequência com AFTER_PREVIOUS', () => {
    const sequence: any = {
      items: [
        { id: '1', orderIndex: 1, startMode: 'FIXED_TIME', fixedStartTime: '08:00', media: { id: 'm1', title: 'Intro', sourceType: 'LOCAL', mediaType: 'INTRODUCAO', durationSeconds: 120 } },
        { id: '2', orderIndex: 2, startMode: 'AFTER_PREVIOUS', relativeOffsetSeconds: 10, media: { id: 'm2', title: 'Vinheta', sourceType: 'LOCAL', mediaType: 'VINHETA', durationSeconds: 30 } }
      ]
    };

    const { timeline } = resolveSequenceTimeline(sequence, new Date('2025-01-06T00:00:00.000Z'));
    expect(timeline[1].startAt.toISOString()).toContain('T08:02:10.000Z');
  });

  it('valida conflito em sequência mista', () => {
    const sequence: any = {
      items: [
        { id: '1', orderIndex: 1, startMode: 'FIXED_TIME', fixedStartTime: '08:00', media: { id: 'm1', title: 'Longo', sourceType: 'LOCAL', mediaType: 'AUDIO', durationSeconds: 600 } },
        { id: '2', orderIndex: 2, startMode: 'FIXED_TIME', fixedStartTime: '08:05', media: { id: 'm2', title: 'Conflito', sourceType: 'LOCAL', mediaType: 'VINHETA', durationSeconds: 30 } }
      ]
    };

    const { conflicts } = resolveSequenceTimeline(sequence, new Date('2025-01-06T00:00:00.000Z'));
    expect(conflicts.length).toBeGreaterThan(0);
  });
});
