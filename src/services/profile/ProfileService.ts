import { db } from '../database/db';
import type { AvatarId, Profile } from '../../types';
import { apiClient } from '../api/apiClient';

export interface CreateProfileData {
  accountId: string;
  name: string;
  surname: string;
  age: number;
  weight: number;
  height: number;
  avatar: AvatarId;
  isMainProfile?: boolean;
}

export class ProfileService {
  static async createProfile(data: CreateProfileData): Promise<Profile> {
    const trimmedName = data.name.trim();
    const trimmedSurname = data.surname.trim();

    if (!trimmedName) {
      throw new Error('O nome é obrigatório.');
    }
    if (!trimmedSurname) {
      throw new Error('O sobrenome é obrigatório.');
    }
    if (isNaN(data.age) || data.age <= 0 || data.age > 150) {
      throw new Error('Informe uma idade válida em anos.');
    }
    if (isNaN(data.weight) || data.weight <= 0 || data.weight > 500) {
      throw new Error('Informe um peso válido em kg.');
    }
    if (isNaN(data.height) || data.height <= 0 || data.height > 300) {
      throw new Error('Informe uma altura válida em cm.');
    }

    if (data.isMainProfile) {
      const existingMain = await db.profiles
        .where('accountId')
        .equals(data.accountId)
        .and((p) => p.isMainProfile)
        .first();

      if (existingMain) {
        throw new Error('Já existe um perfil principal cadastrado para esta conta.');
      }
    }

    let remoteId: string | null = null;
    const token = apiClient.getAccessToken();
    if (token) {
      try {
        const res = await apiClient.post<{ statusCode: number; profile: { id: string } }>('/profiles', {
          name: trimmedName,
          surname: trimmedSurname,
          avatar: data.avatar,
          isMainProfile: Boolean(data.isMainProfile),
          age: Math.round(data.age),
          weight: parseFloat(data.weight.toFixed(2)),
          height: Math.round(data.height),
        });
        if (res && res.profile && res.profile.id) {
          remoteId = res.profile.id;
        }
      } catch (err: any) {
        if (err && typeof err.statusCode === 'number' && err.statusCode >= 400) {
          throw err;
        }
        console.warn('[ProfileService] Backend offline, salvando perfil localmente:', err);
      }
    }

    const now = new Date().toISOString();
    const profile: Profile = {
      id: remoteId || crypto.randomUUID(),
      accountId: data.accountId,
      name: trimmedName,
      surname: trimmedSurname,
      age: Math.round(data.age),
      weight: parseFloat(data.weight.toFixed(2)),
      height: Math.round(data.height),
      avatar: data.avatar,
      isMainProfile: Boolean(data.isMainProfile),
      createdAt: now,
      updatedAt: now,
    };

    await db.profiles.add(profile);
    return profile;
  }

  static async getProfilesByAccount(accountId: string): Promise<Profile[]> {
    // 1. Lê os dados locais do IndexedDB para resposta imediata
    let localProfiles = await db.profiles
      .where('accountId')
      .equals(accountId)
      .sortBy('createdAt');

    // 2. Se houver autenticação ativa, sincroniza perfis remotos do backend
    const token = apiClient.getAccessToken();
    if (token) {
      try {
        const res = await apiClient.get<{ profiles: any[] }>('/profiles');
        if (res && Array.isArray(res.profiles)) {
          for (const rem of res.profiles) {
            const existing = await db.profiles.get(rem.id);
            if (!existing) {
              const newProfile: Profile = {
                id: rem.id,
                accountId,
                name: rem.name,
                surname: rem.surname || '',
                age: typeof rem.age === 'number' && rem.age > 0 ? rem.age : 30,
                weight: typeof rem.weight === 'number' && rem.weight > 0 ? rem.weight : 70,
                height: typeof rem.height === 'number' && rem.height > 0 ? rem.height : 170,
                avatar: (rem.avatar as AvatarId) || 'young-woman',
                isMainProfile: Boolean(rem.isMainProfile),
                medicalConditions: rem.medicalConditions || '',
                allergies: rem.allergies || '',
                createdAt: rem.createdAt || new Date().toISOString(),
                updatedAt: rem.updatedAt || new Date().toISOString(),
              };
              await db.profiles.add(newProfile);
            }
          }
          localProfiles = await db.profiles
            .where('accountId')
            .equals(accountId)
            .sortBy('createdAt');
        }
      } catch (err) {
        // Modo offline: continua com os dados locais
      }
    }

    return localProfiles;
  }

  static async getMainProfile(accountId: string): Promise<Profile | undefined> {
    return db.profiles
      .where('accountId')
      .equals(accountId)
      .and((p) => p.isMainProfile)
      .first();
  }

  static async getProfileById(id: string): Promise<Profile | undefined> {
    return db.profiles.get(id);
  }

  static async updateProfile(
    id: string,
    updates: Partial<Omit<Profile, 'id' | 'accountId' | 'createdAt'>>
  ): Promise<Profile> {
    const existing = await db.profiles.get(id);
    if (!existing) {
      throw new Error('Perfil não encontrado.');
    }

    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error('O nome é obrigatório.');
    }
    if (updates.surname !== undefined && !updates.surname.trim()) {
      throw new Error('O sobrenome é obrigatório.');
    }
    if (updates.age !== undefined && (isNaN(updates.age) || updates.age <= 0 || updates.age > 150)) {
      throw new Error('Informe uma idade válida em anos.');
    }
    if (updates.weight !== undefined && (isNaN(updates.weight) || updates.weight <= 0 || updates.weight > 500)) {
      throw new Error('Informe um peso válido em kg.');
    }
    if (updates.height !== undefined && (isNaN(updates.height) || updates.height <= 0 || updates.height > 300)) {
      throw new Error('Informe uma altura válida em cm.');
    }

    const updated: Profile = {
      ...existing,
      ...updates,
      name: updates.name ? updates.name.trim() : existing.name,
      surname: updates.surname ? updates.surname.trim() : existing.surname,
      updatedAt: new Date().toISOString(),
    };

    await db.profiles.put(updated);

    const token = apiClient.getAccessToken();
    if (token) {
      try {
        await apiClient.patch(`/profiles/${encodeURIComponent(id)}`, {
          name: updated.name,
          surname: updated.surname,
          avatar: updated.avatar,
          isMainProfile: updated.isMainProfile,
          age: updated.age,
          weight: updated.weight,
          height: updated.height,
          medicalConditions: updated.medicalConditions || '',
          allergies: updated.allergies || '',
        });
      } catch (err: any) {
        if (err && typeof err.statusCode === 'number' && err.statusCode >= 400) {
          throw err;
        }
        console.warn('[ProfileService] Erro ao sincronizar atualização no backend:', err);
      }
    }

    return updated;
  }

  static async deleteProfile(id: string): Promise<void> {
    await db.profiles.delete(id);

    const token = apiClient.getAccessToken();
    if (token) {
      try {
        await apiClient.delete(`/profiles/${encodeURIComponent(id)}`);
      } catch (err: any) {
        if (err && typeof err.statusCode === 'number' && err.statusCode >= 400) {
          throw err;
        }
        console.warn('[ProfileService] Erro ao sincronizar exclusão de perfil no backend:', err);
      }
    }
  }

  static setActiveProfileId(id: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('doses_active_profile_id', id);
    }
  }

  static getActiveProfileId(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('doses_active_profile_id');
    }
    return null;
  }

  static clearActiveProfileId(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('doses_active_profile_id');
    }
  }
}
