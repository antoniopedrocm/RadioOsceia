export type ScheduleBlockStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELLED';
export type ScheduleRecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY';
export type QueueItemType = 'MEDIA' | 'PROGRAM_HEADER' | 'BREAK' | 'MANUAL';

export interface ScheduleQueueItemRecord {
  id: string;
  order: number;
  itemType: QueueItemType;
  mediaId?: string | null;
  mediaTitle?: string | null;
  durationSeconds: number;
  notes?: string | null;
  isEnabled: boolean;
}

export interface ScheduleBlockRecord {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleBlockStatus;
  isActive: boolean;
  programId?: string | null;
  programTitle?: string | null;
  recurrenceType: ScheduleRecurrenceType;
  recurrenceGroupId?: string | null;
  items: ScheduleQueueItemRecord[];
  totalDurationSeconds: number;
}

export interface ScheduleDayViewResponse {
  date: string;
  blocks: ScheduleBlockRecord[];
}

export interface ScheduleWeekViewResponse {
  weekStartDate: string;
  weekEndDate: string;
  days: Array<{
    date: string;
    blocks: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      status: ScheduleBlockStatus;
      isActive: boolean;
      programTitle?: string | null;
      totalDurationSeconds: number;
    }>;
  }>;
}

export interface CreateScheduleBlockPayload {
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  programId?: string | null;
  recurrenceType: ScheduleRecurrenceType;
  recurrenceRule?: {
    interval?: number;
    byWeekDays?: number[];
    until?: string | null;
    count?: number | null;
  } | null;
  items: Array<{
    itemType: QueueItemType;
    mediaId?: string | null;
    durationSeconds: number;
    notes?: string | null;
    isEnabled?: boolean;
  }>;
}

export interface UpdateScheduleBlockPayload {
  blockId: string;
  applyScope?: 'THIS' | 'THIS_AND_FUTURE' | 'ALL_IN_GROUP';
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  programId?: string | null;
  status: ScheduleBlockStatus;
  items: Array<{
    id?: string;
    itemType: QueueItemType;
    mediaId?: string | null;
    durationSeconds: number;
    notes?: string | null;
    isEnabled?: boolean;
    order: number;
  }>;
}

export interface PlaybackTimelineResponse {
  now: string;
  current: null | {
    blockId: string;
    blockTitle: string;
    programId?: string | null;
    programTitle?: string | null;
    itemId?: string | null;
    itemTitle?: string | null;
    startedAt: string;
    endsAt: string;
  };
  next: Array<{
    blockId: string;
    blockTitle: string;
    itemId?: string | null;
    itemTitle?: string | null;
    startsAt: string;
    endsAt: string;
  }>;
}
