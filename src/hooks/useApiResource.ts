import { useEffect, useRef, useState } from 'react';
import { ApiError, getApiErrorMessage } from '@/lib/api';

interface UseApiResourceOptions<TData, TMapped = TData> {
  initialData: TMapped;
  mapData?: (data: TData) => TMapped;
  fallbackMessage?: string;
  deps?: ReadonlyArray<unknown>;
}

interface UseApiResourceState<TData> {
  data: TData;
  isLoading: boolean;
  error: ApiError | null;
  errorMessage: string | null;
  reload: () => void;
}

export function useApiResource<TData, TMapped = TData>(
  loader: (signal: AbortSignal) => Promise<TData>,
  { initialData, mapData, fallbackMessage, deps = [] }: UseApiResourceOptions<TData, TMapped>
): UseApiResourceState<TMapped> {
  const [data, setData] = useState<TMapped>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const hasFetchedRef = useRef(false);
  const initialDataRef = useRef(initialData);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    setIsLoading(true);
    setError(null);
    setErrorMessage(null);

    loader(controller.signal)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        const nextData = mapData ? mapData(response) : (response as unknown as TMapped);
        setData(nextData);
        setError(null);
        setErrorMessage(null);
      })
      .catch((caughtError) => {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        const nextError = caughtError instanceof ApiError ? caughtError : new ApiError({
          code: 'UNKNOWN_ERROR',
          message: getApiErrorMessage(caughtError, fallbackMessage),
          details: caughtError
        });

        setData(initialDataRef.current);
        setError(nextError);
        setErrorMessage(getApiErrorMessage(nextError, fallbackMessage));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
          hasFetchedRef.current = true;
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [fallbackMessage, mapData, loader, reloadToken, ...deps]);

  return {
    data,
    isLoading,
    error,
    errorMessage,
    reload: () => {
      if (!hasFetchedRef.current) {
        return;
      }
      setReloadToken((current) => current + 1);
    }
  };
}
