import { describe, expect, it } from 'vitest';
import { parseYouTubeUrl } from '../src/utils/youtube.js';

describe('parseYouTubeUrl', () => {
  it('extracts from watch url', () => {
    const parsed = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&ab_channel=x');
    expect(parsed.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtu.be', () => {
    const parsed = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=5');
    expect(parsed.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
});
