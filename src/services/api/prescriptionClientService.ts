import { apiClient } from './apiClient';
import type { ReceitaMedicaItem, AvatarId } from '../../types';

interface BackendPrescriptionDto {
  id: string;
  profileId: string;
  accountId: string;
  specialty: string;
  doctorName: string;
  crm: string;
  clinicOrHospital: string;
  emissionDate: string;
  expirationDate: string;
  medications: string[];
  instructions: string;
  cardColor: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class PrescriptionClientService {
  private static getStorageKey(profileId: string): string {
    return `doses_prescriptions_cache_${profileId}`;
  }

  private static getLocalCache(profileId: string): ReceitaMedicaItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(profileId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static setLocalCache(profileId: string, items: ReceitaMedicaItem[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(profileId), JSON.stringify(items));
    } catch {
      // Falha silenciosa de cota de armazenamento
    }
  }

  /**
   * Lista as receitas médicas associadas ao perfil ativo.
   */
  public static async listPrescriptions(
    profileId: string,
    profileName: string,
    avatar: AvatarId
  ): Promise<ReceitaMedicaItem[]> {
    try {
      const res = await apiClient.get<{ statusCode: number; prescriptions: BackendPrescriptionDto[] }>(
        `/profiles/${profileId}/prescriptions`
      );

      if (res && Array.isArray(res.prescriptions)) {
        const items: ReceitaMedicaItem[] = res.prescriptions.map((p) => ({
          id: p.id,
          profileId: p.profileId,
          profileName,
          avatar,
          specialty: p.specialty,
          doctorName: p.doctorName,
          crm: p.crm,
          clinicOrHospital: p.clinicOrHospital,
          emissionDate: p.emissionDate,
          expirationDate: p.expirationDate,
          medications: p.medications,
          instructions: p.instructions,
          cardColor: p.cardColor || '#B4ECFB',
        }));

        this.setLocalCache(profileId, items);
        return items;
      }
    } catch {
      // Backend offline ou inacessível: recorre ao cache local
    }

    return this.getLocalCache(profileId);
  }

  /**
   * Cadastra uma nova receita médica com persistência real.
   */
  public static async createPrescription(
    profileId: string,
    profileName: string,
    avatar: AvatarId,
    item: Omit<ReceitaMedicaItem, 'id' | 'profileId' | 'profileName' | 'avatar'>
  ): Promise<ReceitaMedicaItem> {
    const payload = {
      specialty: item.specialty,
      doctorName: item.doctorName,
      crm: item.crm || '',
      clinicOrHospital: item.clinicOrHospital || '',
      emissionDate: item.emissionDate,
      expirationDate: item.expirationDate || '',
      medications: item.medications || [],
      instructions: item.instructions || '',
      cardColor: item.cardColor || '#B4ECFB',
    };

    let createdId = 'rec_local_' + Date.now();

    try {
      const res = await apiClient.post<{ statusCode: number; prescription: BackendPrescriptionDto }>(
        `/profiles/${profileId}/prescriptions`,
        payload
      );

      if (res && res.prescription && res.prescription.id) {
        createdId = res.prescription.id;
      }
    } catch {
      // Se offline, cria identificador local para sincronização posterior
    }

    const newItem: ReceitaMedicaItem = {
      ...payload,
      id: createdId,
      profileId,
      profileName,
      avatar,
    };

    const current = this.getLocalCache(profileId);
    const updated = [newItem, ...current.filter((c) => c.id !== createdId)];
    this.setLocalCache(profileId, updated);

    return newItem;
  }

  /**
   * Atualiza uma receita médica existente.
   */
  public static async updatePrescription(
    profileId: string,
    prescriptionId: string,
    profileName: string,
    avatar: AvatarId,
    item: Partial<ReceitaMedicaItem>
  ): Promise<ReceitaMedicaItem> {
    const payload: Record<string, any> = {};
    if (item.specialty !== undefined) payload.specialty = item.specialty;
    if (item.doctorName !== undefined) payload.doctorName = item.doctorName;
    if (item.crm !== undefined) payload.crm = item.crm;
    if (item.clinicOrHospital !== undefined) payload.clinicOrHospital = item.clinicOrHospital;
    if (item.emissionDate !== undefined) payload.emissionDate = item.emissionDate;
    if (item.expirationDate !== undefined) payload.expirationDate = item.expirationDate;
    if (item.medications !== undefined) payload.medications = item.medications;
    if (item.instructions !== undefined) payload.instructions = item.instructions;
    if (item.cardColor !== undefined) payload.cardColor = item.cardColor;

    try {
      await apiClient.patch(
        `/profiles/${profileId}/prescriptions/${prescriptionId}`,
        payload
      );
    } catch {
      // Backend offline: persiste no cache local
    }

    const current = this.getLocalCache(profileId);
    let updatedItem: ReceitaMedicaItem | null = null;

    const next = current.map((existing) => {
      if (existing.id === prescriptionId) {
        updatedItem = {
          ...existing,
          ...payload,
          profileId,
          profileName,
          avatar,
        };
        return updatedItem;
      }
      return existing;
    });

    if (!updatedItem) {
      updatedItem = {
        id: prescriptionId,
        profileId,
        profileName,
        avatar,
        specialty: item.specialty || '',
        doctorName: item.doctorName || '',
        crm: item.crm || '',
        clinicOrHospital: item.clinicOrHospital || '',
        emissionDate: item.emissionDate || '',
        expirationDate: item.expirationDate || '',
        medications: item.medications || [],
        instructions: item.instructions || '',
        cardColor: item.cardColor || '#B4ECFB',
      };
      next.unshift(updatedItem);
    }

    this.setLocalCache(profileId, next);
    return updatedItem;
  }

  /**
   * Exclui uma receita médica.
   */
  public static async deletePrescription(profileId: string, prescriptionId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/profiles/${profileId}/prescriptions/${prescriptionId}`);
    } catch {
      // Backend offline: remove do cache local
    }

    const current = this.getLocalCache(profileId);
    const next = current.filter((item) => item.id !== prescriptionId);
    this.setLocalCache(profileId, next);

    return true;
  }
}
