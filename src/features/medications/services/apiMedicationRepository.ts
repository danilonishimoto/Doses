import type { CreateMedicationDTO, Medication, MedicationRecurrence, UpdateMedicationDTO } from '../types/medication';
import type { MedicationRepository } from './medicationRepository';
import { apiClient, ApiError } from '../../../services/api/apiClient';
import { db } from '../../../services/database/db';

export function recurrenceToString(recurrence?: MedicationRecurrence): string {
  if (!recurrence || recurrence.type === 'daily') {
    return 'DAILY';
  }
  if (recurrence.type === 'weekly') {
    const days = recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0
      ? [...recurrence.daysOfWeek].sort((a, b) => a - b).join(',')
      : '1,2,3,4,5,6,7';
    return `WEEKLY:${days}`;
  }
  return 'DAILY';
}

export function stringToRecurrence(raw?: string): MedicationRecurrence {
  if (!raw || raw === 'DAILY') {
    return { type: 'daily' };
  }
  if (raw.startsWith('WEEKLY:')) {
    const parts = raw.slice(7).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    return { type: 'weekly', daysOfWeek: parts };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type) return parsed;
  } catch {
    // fallback
  }
  return { type: 'daily' };
}

export interface ApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null> | string | null;
}

export class ApiMedicationRepository implements MedicationRepository {
  constructor(_config?: ApiClientConfig) {
    // Utiliza o cliente unificado apiClient
  }

  public async list(profileId: string): Promise<Medication[]> {
    // 1. Lê os dados locais do IndexedDB para resposta imediata e suporte offline
    let localMeds: Medication[] = [];
    try {
      localMeds = await db.medications.where('profileId').equals(profileId).toArray();
    } catch {
      localMeds = [];
    }

    // 2. Se houver conexão e token, sincroniza com o backend
    const token = apiClient.getAccessToken();
    if (token) {
      try {
        const res = await apiClient.get<{ statusCode: number; medications: any[] }>(
          `/profiles/${encodeURIComponent(profileId)}/medications`
        );

        if (res && Array.isArray(res.medications)) {
          const remoteList: Medication[] = [];

          for (const rem of res.medications) {
            // Busca os horários deste medicamento no backend
            let schedules: string[] = [];
            try {
              const timesRes = await apiClient.get<{ statusCode: number; times: any[] }>(
                `/medications/${encodeURIComponent(rem.id)}/times`
              );
              if (timesRes && Array.isArray(timesRes.times)) {
                schedules = timesRes.times.map((t) => t.time).sort();
              }
            } catch {
              // Mantém horários que já existiam localmente se a sub-requisição falhar
              const cached = localMeds.find((m) => m.id === rem.id);
              schedules = cached?.schedules || [];
            }

            const med: Medication = {
              id: rem.id,
              profileId: rem.profileId || profileId,
              name: rem.name,
              instructions: rem.dosage || '',
              schedules,
              recurrence: stringToRecurrence(rem.recurrence),
              cardColor: '#BBF9E0',
              status: 'active',
              createdAt: rem.createdAt || new Date().toISOString(),
              updatedAt: rem.updatedAt || new Date().toISOString(),
            };

            await db.medications.put(med);
            remoteList.push(med);
          }

          // Se o backend retornou registros, mescla com eventuais itens locais pendentes
          if (remoteList.length > 0) {
            return remoteList;
          }
        }
      } catch (err) {
        // Falha de rede: utiliza o armazenamento local
        console.warn('[ApiMedicationRepository] Backend indisponível, utilizando dados locais:', err);
      }
    }

    return localMeds;
  }

  public async getById(id: string): Promise<Medication | null> {
    try {
      const local = await db.medications.get(id);
      if (local) return local;
    } catch {
      // Ignora erro do Dexie
    }

    const token = apiClient.getAccessToken();
    if (token) {
      try {
        const res = await apiClient.get<{ statusCode: number; medication: any }>(
          `/medications/${encodeURIComponent(id)}`
        );
        if (res && res.medication) {
          const rem = res.medication;
          let schedules: string[] = [];
          try {
            const timesRes = await apiClient.get<{ statusCode: number; times: any[] }>(
              `/medications/${encodeURIComponent(rem.id)}/times`
            );
            if (timesRes && Array.isArray(timesRes.times)) {
              schedules = timesRes.times.map((t) => t.time).sort();
            }
          } catch {
            // Sem horários remotos
          }

          const med: Medication = {
            id: rem.id,
            profileId: rem.profileId,
            name: rem.name,
            instructions: rem.dosage || '',
            schedules,
            recurrence: stringToRecurrence(rem.recurrence),
            cardColor: '#BBF9E0',
            status: 'active',
            createdAt: rem.createdAt || new Date().toISOString(),
            updatedAt: rem.updatedAt || new Date().toISOString(),
          };

          await db.medications.put(med);
          return med;
        }
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 404) {
          return null;
        }
      }
    }

    return null;
  }

  public async create(data: CreateMedicationDTO): Promise<Medication> {
    const token = apiClient.getAccessToken();
    const recurrenceStr = recurrenceToString(data.recurrence);
    let remoteId: string | null = null;
    let savedSchedules: string[] = [...(data.schedules || [])];

    if (token) {
      try {
        // 1. Cria o medicamento no backend
        const res = await apiClient.post<{ statusCode: number; medication: { id: string } }>(
          `/profiles/${encodeURIComponent(data.profileId)}/medications`,
          {
            name: data.name.trim(),
            dosage: (data.instructions || '').trim(),
            recurrence: recurrenceStr,
          }
        );

        if (res && res.medication && res.medication.id) {
          remoteId = res.medication.id;

          // 2. Cria cada horário cadastrado para o medicamento
          const failedTimes: string[] = [];
          for (const time of savedSchedules) {
            try {
              await apiClient.post(`/medications/${encodeURIComponent(remoteId)}/times`, {
                time: time.trim(),
              });
            } catch (timeErr) {
              console.warn(`[ApiMedicationRepository] Falha ao cadastrar horário ${time}:`, timeErr);
              failedTimes.push(time);
            }
          }

          if (failedTimes.length > 0 && failedTimes.length === savedSchedules.length && savedSchedules.length > 0) {
            throw new Error(`Medicamento criado, mas nenhum dos horários pôde ser registrado no servidor.`);
          }
        }
      } catch (err: any) {
        if (err && typeof err.statusCode === 'number' && err.statusCode >= 400) {
          throw err;
        }
        if (err instanceof Error && err.message.includes('horários')) {
          throw err;
        }
        console.warn('[ApiMedicationRepository] Backend offline, salvando localmente:', err);
      }
    }

    const now = new Date().toISOString();
    const med: Medication = {
      id: remoteId || crypto.randomUUID(),
      profileId: data.profileId,
      name: data.name.trim(),
      instructions: data.instructions,
      schedules: savedSchedules,
      recurrence: data.recurrence || { type: 'daily' },
      cardColor: data.cardColor || '#BBF9E0',
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.medications.put(med);
    } catch (dbErr) {
      console.warn('[ApiMedicationRepository] Erro ao gravar medicamento no Dexie:', dbErr);
    }

    return med;
  }

  public async update(id: string, data: UpdateMedicationDTO): Promise<Medication> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Medicamento não encontrado para atualização: ${id}`);
    }

    const updated: Medication = {
      ...existing,
      ...data,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      instructions: data.instructions !== undefined ? data.instructions : existing.instructions,
      schedules: data.schedules !== undefined ? [...data.schedules] : existing.schedules,
      recurrence: data.recurrence !== undefined ? data.recurrence : existing.recurrence,
      updatedAt: new Date().toISOString(),
    };

    // Atualiza localmente
    try {
      await db.medications.put(updated);
    } catch {
      // Ignora erro local
    }

    const token = apiClient.getAccessToken();
    if (token) {
      try {
        // Atualiza campos do medicamento no backend
        const recurrenceStr = recurrenceToString(updated.recurrence);
        await apiClient.patch(`/medications/${encodeURIComponent(id)}`, {
          name: updated.name,
          dosage: updated.instructions,
          recurrence: recurrenceStr,
        });

        // Se horários foram modificados, sincroniza com o backend
        if (data.schedules !== undefined) {
          const existingTimesRes = await apiClient.get<{ statusCode: number; times: any[] }>(
            `/medications/${encodeURIComponent(id)}/times`
          ).catch(() => ({ times: [] }));

          const currentTimes = existingTimesRes.times || [];
          const newTimesSet = new Set(updated.schedules);

          // Remove horários que não existem mais
          for (const ct of currentTimes) {
            if (!newTimesSet.has(ct.time)) {
              await apiClient.delete(`/medication-times/${encodeURIComponent(ct.id)}`).catch(() => null);
            }
          }

          // Adiciona horários novos
          const currentTimeStrings = new Set(currentTimes.map((t: any) => t.time));
          for (const nt of updated.schedules) {
            if (!currentTimeStrings.has(nt)) {
              await apiClient.post(`/medications/${encodeURIComponent(id)}/times`, {
                time: nt,
              }).catch(() => null);
            }
          }
        }
      } catch (err: any) {
        if (err && typeof err.statusCode === 'number' && err.statusCode >= 400) {
          throw err;
        }
        console.warn('[ApiMedicationRepository] Erro ao sincronizar atualização com o backend:', err);
      }
    }

    return updated;
  }

  public async delete(id: string): Promise<void> {
    try {
      await db.medications.delete(id);
    } catch {
      // Ignora erro local
    }

    const token = apiClient.getAccessToken();
    if (token) {
      try {
        await apiClient.delete(`/medications/${encodeURIComponent(id)}`);
      } catch (err: any) {
        if (err && typeof err.statusCode === 'number' && err.statusCode >= 400) {
          throw err;
        }
        console.warn('[ApiMedicationRepository] Erro ao sincronizar exclusão com o backend:', err);
      }
    }
  }
}
