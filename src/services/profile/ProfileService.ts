import { db } from '../database/db';
import type { AvatarId, Profile } from '../../types';

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

    const now = new Date().toISOString();
    const profile: Profile = {
      id: crypto.randomUUID(),
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
    return db.profiles
      .where('accountId')
      .equals(accountId)
      .sortBy('createdAt');
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
    return updated;
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
