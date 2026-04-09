import type { ScheduleBlockRecord, ScheduleBlockStatus, ScheduleQueueItemRecord } from '@/types/schedule';

export function normalizeScheduleStatus(value: unknown): ScheduleBlockStatus {
  const normalized = String(value ?? 'ACTIVE').toUpperCase();
  if (normalized === 'INACTIVE') return 'INACTIVE';
  if (normalized === 'CANCELLED') return 'CANCELLED';
  return 'ACTIVE';
}

export function combineDateAndTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00.000Z`).toISOString();
}

export function formatDurationSeconds(durationSeconds: number): string {
  const total = Math.max(0, Math.floor(durationSeconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function calculateQueueDuration(items: ScheduleQueueItemRecord[]): number {
  return items.filter((item) => item.isEnabled).reduce((acc, item) => acc + Number(item.durationSeconds ?? 0), 0);
}

export function sortBlocksByStartTime(blocks: ScheduleBlockRecord[]): ScheduleBlockRecord[] {
  return [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function detectScheduleConflict(
  candidate: { startTime: string; endTime: string },
  blocks: Array<{ id: string; startTime: string; endTime: string; status: ScheduleBlockStatus }>,
  ignoreId?: string
) {
  return blocks.find((block) => {
    if (ignoreId && block.id === ignoreId) return false;
    if (block.status !== 'ACTIVE') return false;
    return candidate.startTime < block.endTime && candidate.endTime > block.startTime;
  }) ?? null;
}
