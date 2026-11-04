import type { CreateMedicationDTO, Medication, UpdateMedicationDTO } from '../types/medication';
import type { MedicationRepository } from './medicationRepository';

export interface ApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null> | string | null;
}

export class ApiException extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.details = details;
  }
}

export class ApiMedicationRepository implements MedicationRepository {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null> | string | null;

  constructor(config?: ApiClientConfig) {
    this.baseUrl = config?.baseUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1';
    this.getAuthToken = config?.getAuthToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        let details: unknown;
        try {
          const errorJson = await response.json();
          details = errorJson;
          if (errorJson && typeof errorJson.message === 'string') {
            errorMessage = errorJson.message;
          }
        } catch {
          // Response body was not JSON
        }
        throw new ApiException(errorMessage, response.status, details);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        error instanceof Error ? error.message : 'Falha na conexão com o servidor',
        0,
        error
      );
    }
  }

  public async list(profileId: string): Promise<Medication[]> {
    return this.request<Medication[]>(`/profiles/${encodeURIComponent(profileId)}/medications`, {
      method: 'GET',
    });
  }

  public async getById(id: string): Promise<Medication | null> {
    try {
      return await this.request<Medication>(`/medications/${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    } catch (error) {
      if (error instanceof ApiException && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  public async create(data: CreateMedicationDTO): Promise<Medication> {
    return this.request<Medication>(`/profiles/${encodeURIComponent(data.profileId)}/medications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async update(id: string, data: UpdateMedicationDTO): Promise<Medication> {
    return this.request<Medication>(`/medications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async delete(id: string): Promise<void> {
    await this.request<void>(`/medications/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }
}
