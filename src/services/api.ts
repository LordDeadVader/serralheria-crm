/**
 * Cliente HTTP da API. Único ponto de comunicação com o backend (HTTPS).
 * O token de sessão é opaco; o banco de dados nunca é acessado diretamente pelo navegador.
 */
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8787';
const TOKEN_KEY = 'scrm.session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const session = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* navegação privada */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const token = session.get();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corpo vazio */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; details?: { fields?: Record<string, string> } };
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      session.clear();
      onUnauthorized?.();
    }
    throw new ApiError(res.status, d.error ?? `Erro ${res.status}`, d.details?.fields ?? {});
  }
  return data as T;
}

export const get = <T>(p: string) => api<T>('GET', p);
export const post = <T>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const put = <T>(p: string, b: unknown) => api<T>('PUT', p, b);
export const del = <T>(p: string) => api<T>('DELETE', p);

export const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const r = s.toString();
  return r ? `?${r}` : '';
};
