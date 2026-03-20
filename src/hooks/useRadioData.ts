import { useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useApiResource } from '@/hooks/useApiResource';
import type { Presenter, Program } from '@/types';
import type { DashboardSummary, NowPlayingResponse } from '@/types/api';

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

interface UpNextItem {
  id: string;
  title: string;
  startTime: string;
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
const EMPTY_UPCOMING: UpNextItem[] = [];
const EMPTY_DASHBOARD: DashboardSummary = {
  programs: 0,
  media: 0,
  scheduledToday: 0,
  nowPlaying: null,
  upNext: []
};
const EMPTY_TIMELINE: TimelineBlock[] = [];

export function useNowPlaying() {
  const loader = useCallback((signal: AbortSignal) => api.get<NowPlayingResponse>('/public/institutions/osceia/now-playing', { signal }), []);

  return useApiResource(loader, {
    initialData: null as NowPlayingResponse['nowPlaying'] | null,
    mapData: (response) => response.nowPlaying,
    fallbackMessage: 'Não foi possível carregar o conteúdo atual.'
  });
}

export function useUpcomingQueue() {
  const loader = useCallback((signal: AbortSignal) => api.get<UpNextItem[]>('/public/institutions/osceia/up-next', { signal }), []);

  return useApiResource(loader, {
    initialData: EMPTY_UPCOMING,
    fallbackMessage: 'Não foi possível carregar a fila de próximos conteúdos.'
  });
}

export function usePrograms() {
  const loader = useCallback((signal: AbortSignal) => api.get<ApiProgram[]>('/public/institutions/osceia/programs', { signal }), []);

  const mapData = useCallback((list: ApiProgram[]): Program[] => list.map((item) => ({
      id: item.id,
      titulo: item.title,
      categoria: item.category?.name ?? 'Sem categoria',
      apresentador: item.presenter?.name ?? 'Não definido',
      duracao: '-',
      origem: 'YouTube',
      instituicao: 'OSCEIA',
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
  const loader = useCallback((signal: AbortSignal) => api.get<ApiPresenter[]>('/public/institutions/osceia/presenters', { signal }), []);

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
    fallbackMessage: 'Não foi possível carregar o resumo do dashboard.'
  });
}

export function useScheduleTimeline(weekday: string) {
  const timelineLoader = useCallback(
    (signal: AbortSignal) => api.get<TimelineResponse>(`/public/institutions/osceia/timeline?weekday=${weekday}`, { signal }),
    [weekday]
  );
  const nowPlayingLoader = useCallback((signal: AbortSignal) => api.get<NowPlayingResponse>('/public/institutions/osceia/now-playing', { signal }), []);

  const mapTimeline = useCallback((response: TimelineResponse) => response.blocks ?? EMPTY_TIMELINE, []);
  const mapPlayback = useCallback((response: NowPlayingResponse) => ({
    nowPlaying: response.nowPlaying,
    upNext: (response as NowPlayingResponse & { upNext?: UpNextItem[] }).upNext ?? EMPTY_UPCOMING
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
