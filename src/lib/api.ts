const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1';

let token: string | null = localStorage.getItem('radioosceia_access_token');

export function setAccessToken(nextToken: string | null) {
  token = nextToken;
  if (nextToken) {
    localStorage.setItem('radioosceia_access_token', nextToken);
  } else {
    localStorage.removeItem('radioosceia_access_token');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? 'Erro ao consultar API');
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};
