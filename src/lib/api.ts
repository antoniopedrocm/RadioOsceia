const FALLBACK_API_URL = 'http://localhost:3333/api/v1';
const REQUEST_TIMEOUT_MS = 10000;

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? FALLBACK_API_URL).replace(/\/$/, '');

let token: string | null = localStorage.getItem('radioosceia_access_token');
const pendingRequests = new Map<string, Promise<unknown>>();

export type ApiErrorCode = 'NETWORK_ERROR' | 'HTTP_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  isNetworkError: boolean;
  details?: unknown;

  constructor({ code, message, status, details }: { code: ApiErrorCode; message: string; status?: number; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.isNetworkError = code === 'NETWORK_ERROR' || code === 'TIMEOUT';
  }
}

export function setAccessToken(nextToken: string | null) {
  token = nextToken;
  if (nextToken) {
    localStorage.setItem('radioosceia_access_token', nextToken);
  } else {
    localStorage.removeItem('radioosceia_access_token');
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}


function createRequestKey(path: string, init?: RequestInit) {
  const method = init?.method ?? 'GET';
  return `${method.toUpperCase()}:${buildUrl(path)}`;
}

function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError({
      code: 'TIMEOUT',
      message: 'A requisição demorou mais do que o esperado. Tente novamente em instantes.'
    });
  }

  if (error instanceof Error) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Não foi possível conectar ao backend. Verifique se o servidor está em execução.',
      details: error
    });
  }

  return new ApiError({
    code: 'UNKNOWN_ERROR',
    message: 'Ocorreu um erro inesperado ao consultar a API.',
    details: error
  });
}

export function getApiErrorMessage(error: unknown, fallback = 'Não foi possível carregar os dados.') {
  const apiError = error instanceof ApiError ? error : normalizeApiError(error);

  switch (apiError.code) {
    case 'TIMEOUT':
      return 'A requisição expirou. Tente novamente em instantes.';
    case 'NETWORK_ERROR':
      return 'Servidor indisponível no momento. Verifique se o backend está em execução.';
    case 'INVALID_RESPONSE':
      return 'A API retornou uma resposta inválida. Tente novamente.';
    case 'HTTP_ERROR':
      return apiError.message || fallback;
    default:
      return fallback;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestKey = createRequestKey(path, init);

  if ((init?.method ?? 'GET').toUpperCase() === 'GET' && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey) as Promise<T>;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const runRequest = async () => {
  try {
    const providedHeaders = new Headers(init?.headers ?? {});
    const isFormDataBody = init?.body instanceof FormData;

    if (!isFormDataBody && !providedHeaders.has('Content-Type')) {
      providedHeaders.set('Content-Type', 'application/json');
    }

    if (token && !providedHeaders.has('Authorization')) {
      providedHeaders.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(buildUrl(path), {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: providedHeaders
    });

    const payload = await parseJsonSafely<unknown>(response);

    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `A API respondeu com status ${response.status}.`;

      throw new ApiError({
        code: 'HTTP_ERROR',
        status: response.status,
        message,
        details: payload
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (payload === null) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        status: response.status,
        message: 'A API retornou uma resposta inválida.',
        details: response
      });
    }

    return payload as T;
  } catch (error) {
    throw normalizeApiError(error);
  } finally {
    window.clearTimeout(timeoutId);
    pendingRequests.delete(requestKey);
  }
  };

  const promise = runRequest();

  if ((init?.method ?? 'GET').toUpperCase() === 'GET') {
    pendingRequests.set(requestKey, promise as Promise<unknown>);
  }

  return promise;
}

export const api = {
  request,
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>(path, { ...init, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>(path, { ...init, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'DELETE' })
};

export { API_BASE_URL, FALLBACK_API_URL, REQUEST_TIMEOUT_MS };
