export type MediaStatus = 'ACTIVE' | 'DRAFT' | 'INACTIVE';

export type MediaSource = 'YOUTUBE' | 'UPLOAD' | 'EXISTING_FILE';

export type MediaSourceType = 'YOUTUBE' | 'LOCAL' | 'EXTERNAL_PLACEHOLDER';

export interface AdminMediaRecord {
  id: string;
  title: string;
  mediaType: string;
  sourceType: MediaSourceType;
  durationSeconds: number | null;
  programId?: string | null;
  program?: { title: string } | null;
  isActive: boolean;
  status: MediaStatus;
  notes?: string | null;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  embedUrl?: string | null;
  thumbnailUrl?: string | null;
  filePath?: string | null;
  publicUrl?: string | null;
  fileName?: string | null;
}

export interface MediaBaseUpsertPayload {
  title: string;
  mediaType: string;
  programId: string | null;
  durationSeconds: number;
  status: MediaStatus;
  notes?: string;
}

export interface MediaYoutubeUpsertPayload extends MediaBaseUpsertPayload {
  source: 'YOUTUBE';
  youtubeUrl: string;
  thumbnailUrl?: string;
}

export interface MediaExistingFileUpsertPayload extends MediaBaseUpsertPayload {
  source: 'EXISTING_FILE';
  filePath: string;
  publicUrl?: string;
  fileName?: string;
}

export interface MediaUploadPayload extends MediaBaseUpsertPayload {
  source: 'UPLOAD';
  file: File;
}

export type MediaUpsertPayload = MediaYoutubeUpsertPayload | MediaExistingFileUpsertPayload | MediaUploadPayload;

export interface MediaUpdatePayload {
  id: string;
  title: string;
  mediaType: string;
  programId: string | null;
  durationSeconds: number;
  status: MediaStatus;
  notes?: string;
  youtubeUrl?: string;
  thumbnailUrl?: string;
  filePath?: string;
  publicUrl?: string;
  fileName?: string;
}
