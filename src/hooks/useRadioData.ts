import { useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useApiResource } from '@/hooks/useApiResource';
import type { Presenter, Program } from '@/types';
import type { DashboardSummary, NowPlayingResponse, NowPlayingUpNextItem } from '@/types/api';

interface ApiProgram {
  id: string;
  title: string;
  shortDescription?: string;
  coverUrl?: string;
  category?: { name: string } | null;
  presenter?: { name: string } | null;
}

interface ApiPresenter {
  id: string;
  name: string;
  shortBio?: string;
  photoUrl?: string;
}

interface TimelineBlock {
  title: string;
  timeline?: TimelineItem[];
}

interface TimelineItem {
  itemId: string;
  mediaId: string;
  title: string;
  sourceType: string;
  startAt: string;
}

interface TimelineResponse {
  blocks?: TimelineBlock[];
}

const EMPTY_PROGRAMS: Program[] = [];
const EMPTY_PRESENTERS: Presenter[] = [];
const EMPTY_UPCOMING: NowPlayingUpNextItem[] = [];
const EMPTY_DASHBOARD: DashboardSummary = {
  programs: 0,
  media: 0,
  scheduledToday: 0,
  nowPlaying: null,
  upNext: []
};
const EMPTY_TIMELINE: TimelineBlock[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNowPlayingUpNextItem(value: unknown): value is NowPlayingUpNextItem {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === 'string' && typeof value.title === 'string' && typeof value.startTime === 'string';
}

function normalizeNowPlayingResponse(payload: unknown): NowPlayingResponse {
  const record = isRecord(payload) ? payload : {};
  const upNext = Array.isArray(record.upNext) ? record.upNext.filter(isNowPlayingUpNextItem) : EMPTY_UPCOMING;
  const institution = isRecord(record.institution)
    ? (record.institution as NowPlayingResponse['institution'])
    : { id: '', slug: '', name: '' };

  const nowPlayingRaw = record.nowPlaying;
  if (nowPlayingRaw === null || nowPlayingRaw === undefined) {
    return { institution, nowPlaying: null, upNext };
  }

  if (isRecord(nowPlayingRaw) && isRecord(nowPlayingRaw.media)) {
    return { institution, nowPlaying: nowPlayingRaw as NowPlayingResponse['nowPlaying'], upNext };
  }

  const legacyFlatNowPlaying = isRecord(nowPlayingRaw) ? nowPlayingRaw : record;
  const mediaId = legacyFlatNowPlaying.mediaId;
  const mediaTitle = legacyFlatNowPlaying.mediaTitle ?? legacyFlatNowPlaying.title;
  const sourceType = legacyFlatNowPlaying.sourceType;
  const mediaType = legacyFlatNowPlaying.mediaType;

  if (
    typeof mediaId === 'string' &&
    typeof mediaTitle === 'string' &&
    typeof sourceType === 'string' &&
    typeof mediaType === 'string'
  ) {
    return {
      institution,
      nowPlaying: {
        source: typeof legacyFlatNowPlaying.source === 'string' ? legacyFlatNowPlaying.source : sourceType,
        title: typeof legacyFlatNowPlaying.title === 'string' ? legacyFlatNowPlaying.title : mediaTitle,
        media: {
          id: mediaId,
          title: mediaTitle,
          sourceType,
          mediaType,
          youtubeVideoId: typeof legacyFlatNowPlaying.youtubeVideoId === 'string' ? legacyFlatNowPlaying.youtubeVideoId : null,
          publicUrl: typeof legacyFlatNowPlaying.publicUrl === 'string' ? legacyFlatNowPlaying.publicUrl : null
        }
      },
      upNext
    };
  }

  console.warn('[useRadioData] Resposta de nowPlaying inválida; exibindo estado vazio.', payload);
  return { institution, nowPlaying: null, upNext };
}

export function useNowPlaying() {
  const loader = useCallback(async (_signal: AbortSignal) => normalizeNowPlayingResponse(await api.getNowPlaying()), []);

  return useApiResource(loader, {
    initialData: null as NowPlayingResponse['nowPlaying'] | null,
    mapData: (response: NowPlayingResponse) => response.nowPlaying,
    fallbackMessage: 'Não foi possível carregar o conteúdo atual.'
  });
}

export function useUpcomingQueue() {
  const loader = useCallback(async (_signal: AbortSignal) => normalizeNowPlayingResponse(await api.getNowPlaying()), []);

  return useApiResource(loader, {
    initialData: EMPTY_UPCOMING,
    mapData: (response: NowPlayingResponse): NowPlayingUpNextItem[] => response.upNext,
    fallbackMessage: 'Não foi possível carregar a fila de próximos conteúdos.'
  });
}

export function usePrograms() {
  const loader = useCallback((signal: AbortSignal) => api.get<ApiProgram[]>('/public/institutions/irmao-aureo/programs', { signal }), []);

  const mapData = useCallback((list: ApiProgram[]): Program[] => list.map((item) => ({
      id: item.id,
      titulo: item.title,
      categoria: item.category?.name ?? 'Sem categoria',
      apresentador: item.presenter?.name ?? 'Não definido',
      duracao: '-',
      origem: 'YouTube',
      instituicao: 'Irmão Áureo',
      descricao: item.shortDescription ?? '',
      capa: item.coverUrl ?? 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=900'
    })), []);

  return useApiResource(loader, {
    initialData: EMPTY_PROGRAMS,
    fallbackMessage: 'Não foi possível carregar os programas.',
    mapData
  });
}

export function usePresenters() {
  const loader = useCallback((signal: AbortSignal) => api.get<ApiPresenter[]>('/public/institutions/irmao-aureo/presenters', { signal }), []);

  const mapData = useCallback((list: ApiPresenter[]) => list.map((item) => ({
      id: item.id,
      nome: item.name,
      bio: item.shortBio ?? '',
      foto: item.photoUrl ?? 'https://i.pravatar.cc/300',
      programas: []
    })), []);

  return useApiResource(loader, {
    initialData: EMPTY_PRESENTERS,
    fallbackMessage: 'Não foi possível carregar os apresentadores.',
    mapData
  });
}

export function useDashboardSummary() {
  const loader = useCallback((signal: AbortSignal) => api.get<DashboardSummary>('/dashboard/summary', { signal }), []);

  return useApiResource(loader, {
    initialData: EMPTY_DASHBOARD,
    fallbackMessage: 'Não foi possível carregar o resumo do dashboard no Firebase.'
  });
}

export function useScheduleTimeline(weekday: string) {
  const timelineLoader = useCallback(
    (signal: AbortSignal) => api.get<TimelineResponse>(`/public/institutions/irmao-aureo/timeline?weekday=${weekday}`, { signal }),
    [weekday]
  );
  const nowPlayingLoader = useCallback(async (_signal: AbortSignal) => normalizeNowPlayingResponse(await api.getNowPlaying()), []);

  const mapTimeline = useCallback((response: TimelineResponse) => response.blocks ?? EMPTY_TIMELINE, []);
  const mapPlayback = useCallback((response: NowPlayingResponse) => ({
    nowPlaying: response.nowPlaying,
    upNext: response.upNext
  }), []);

  const timelineState = useApiResource(timelineLoader, {
    initialData: EMPTY_TIMELINE,
    fallbackMessage: 'Não foi possível carregar a timeline da programação.',
    mapData: mapTimeline,
    deps: [weekday]
  });

  const playbackState = useApiResource(nowPlayingLoader, {
    initialData: { nowPlaying: null, upNext: EMPTY_UPCOMING },
    fallbackMessage: 'Não foi possível carregar o status da execução.',
    mapData: mapPlayback
  });

  const flattened = useMemo(
    () => timelineState.data.flatMap((block) => (block.timeline ?? []).map((item) => ({ ...item, blockTitle: block.title }))),
    [timelineState.data]
  );

  return {
    timeline: timelineState.data,
    flattened,
    isLoading: timelineState.isLoading || playbackState.isLoading,
    timelineError: timelineState.error,
    timelineErrorMessage: timelineState.errorMessage,
    nowPlaying: playbackState.data.nowPlaying,
    upNext: playbackState.data.upNext,
    playbackError: playbackState.error,
    playbackErrorMessage: playbackState.errorMessage
  };
}
