/**
 * Cliente HTTP autenticado com suporte a renovação automática de access token (JWT Refresh).
 */

export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean;
}

export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;
  public code?: string;

  constructor(message: string, statusCode: number, details?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.baseUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
      ((globalThis as any).process?.env?.VITE_API_URL) ||
      (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null'
        ? '/api/v1'
        : 'http://localhost:3333/api/v1');
  }

  public getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('doses_access_token');
  }

  public getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('doses_refresh_token');
  }

  public setTokens(accessToken: string, refreshToken: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('doses_access_token', accessToken);
    localStorage.setItem('doses_refresh_token', refreshToken);
  }

  public clearTokens(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem('doses_access_token');
    localStorage.removeItem('doses_refresh_token');
    localStorage.removeItem('doses_backend_account_id');
  }

  /**
   * Tenta renovar o access token utilizando o refreshToken persistido.
   */
  public async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      return null;
    }

    // Se já houver uma renovação em andamento, aguarda a mesma promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          this.clearTokens();
          return null;
        }

        const data = await res.json();
        if (data.accessToken && data.refreshToken) {
          this.setTokens(data.accessToken, data.refreshToken);
          return data.accessToken as string;
        }

        this.clearTokens();
        return null;
      } catch (err) {
        console.warn('[ApiClient] Erro ao tentar renovar token:', err);
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Executa uma requisição HTTP autenticada com retry automático em caso de token expirado (401).
   */
  public async request<T>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (!options.skipAuth) {
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err: any) {
      throw new ApiError(err?.message || 'Falha de conexão com o servidor', 0, err);
    }

    // Se receber 401 e houver refresh token, tenta renovar uma única vez
    if (response.status === 401 && !options.skipAuth && this.getRefreshToken()) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        try {
          response = await fetch(url, { ...options, headers });
        } catch (retryErr: any) {
          throw new ApiError(retryErr?.message || 'Falha na reconexão com o servidor', 0, retryErr);
        }
      }
    }

    if (!response.ok) {
      let message = `Erro HTTP ${response.status}: ${response.statusText}`;
      let details: unknown;
      let code: string | undefined;

      try {
        const errorJson = await response.json();
        details = errorJson;
        if (errorJson && typeof errorJson.message === 'string') {
          message = errorJson.message;
        }
        if (errorJson && typeof errorJson.code === 'string') {
          code = errorJson.code;
        }
      } catch {
        // Body não é JSON
      }

      throw new ApiError(message, response.status, details, code);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  public get<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: any, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: any, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: any, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
