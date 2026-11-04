import type { CreateMedicationDTO, Medication, UpdateMedicationDTO } from '../types/medication';
import type { MedicationRepository } from './medicationRepository';

const DEFAULT_SEED_MEDICATIONS: Medication[] = [
  {
    id: 'med-camilla-1',
    profileId: 'profile-camilla',
    name: 'Vitamina D',
    schedules: ['08:00'],
    recurrence: { type: 'daily' },
    instructions: '1 cápsula pela manhã após o café',
    cardColor: '#B4ECFB',
    status: 'active',
    createdAt: new Date('2026-03-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
  },
  {
    id: 'med-camilla-2',
    profileId: 'profile-camilla',
    name: 'Ômega 3',
    schedules: ['12:30'],
    recurrence: { type: 'daily' },
    instructions: '1 cápsula durante o almoço',
    cardColor: '#FFF6E1',
    status: 'active',
    createdAt: new Date('2026-03-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
  },
  {
    id: 'med-camilla-3',
    profileId: 'profile-camilla',
    name: 'Magnésio Quelato',
    schedules: ['21:30'],
    recurrence: { type: 'daily' },
    instructions: '2 cápsulas 30 min antes de dormir',
    cardColor: '#E8F4F1',
    status: 'active',
    createdAt: new Date('2026-03-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
  },
  {
    id: 'med-jose-1',
    profileId: 'profile-jose',
    name: 'Losartana Potássica 50mg',
    schedules: ['08:00', '20:00'],
    recurrence: { type: 'daily' },
    instructions: '1 comprimido a cada 12 horas para controle de pressão',
    cardColor: '#BBF9E0',
    status: 'active',
    createdAt: new Date('2026-03-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
  },
  {
    id: 'med-jose-2',
    profileId: 'profile-jose',
    name: 'AAS Infantil 100mg',
    schedules: ['12:00'],
    recurrence: { type: 'daily' },
    instructions: '1 comprimido logo após o almoço',
    cardColor: '#FFF6E1',
    status: 'active',
    createdAt: new Date('2026-03-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
  },
  {
    id: 'med-amora-1',
    profileId: 'profile-amora',
    name: 'Apoquel 3.6mg',
    schedules: ['09:00'],
    recurrence: { type: 'daily' },
    instructions: '1/2 comprimido com petisco para alergia',
    cardColor: '#B4ECFB',
    status: 'active',
    createdAt: new Date('2026-03-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
  },
  {
    id: 'med-amora-2',
    profileId: 'profile-amora',
    name: 'Simparic 5-10kg',
    schedules: ['10:00'],
    recurrence: { type: 'weekly', interval: 4 },
    instructions: '1 tablete mastigável mensal contra pulgas e carrapatos',
    cardColor: '#BBF9E0',
    status: 'active',
    createdAt: new Date('2026-03-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
  },
];

export class MockMedicationRepository implements MedicationRepository {
  private medications: Medication[];
  private latencyMs: number;
  private errorSimulation: boolean = false;

  constructor(initialData?: Medication[], latencyMs: number = 200) {
    this.medications = initialData ? [...initialData] : [...DEFAULT_SEED_MEDICATIONS];
    this.latencyMs = latencyMs;
  }

  /**
   * Toggle simulated failure for testing UI error states.
   */
  public setErrorSimulation(enabled: boolean): void {
    this.errorSimulation = enabled;
  }

  public isErrorSimulationEnabled(): boolean {
    return this.errorSimulation;
  }

  public setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  public reset(initialData?: Medication[]): void {
    this.medications = initialData ? [...initialData] : [...DEFAULT_SEED_MEDICATIONS];
    this.errorSimulation = false;
  }

  private async simulateNetwork(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    if (this.errorSimulation) {
      throw new Error('Falha simulada na comunicação com o repositório de medicamentos.');
    }
  }

  public async list(profileId: string): Promise<Medication[]> {
    await this.simulateNetwork();

    // Check if there are medications directly matching profileId
    const directMatches = this.medications.filter((m) => m.profileId === profileId);
    if (directMatches.length > 0) {
      return directMatches.map((m) => ({ ...m, schedules: [...m.schedules] }));
    }

    // If no direct matches and this is a custom profile ID (e.g. from IndexedDB),
    // seed default items cloned for this profile so the user has immediate data
    const lowerId = profileId.toLowerCase();
    let seedSourceId = 'profile-camilla';
    if (lowerId.includes('jose') || lowerId.includes('josé')) {
      seedSourceId = 'profile-jose';
    } else if (lowerId.includes('amora') || lowerId.includes('pet') || lowerId.includes('dog')) {
      seedSourceId = 'profile-amora';
    }

    const templateMatches = this.medications.filter((m) => m.profileId === seedSourceId);
    if (templateMatches.length > 0 && !this.medications.some((m) => m.profileId === profileId)) {
      // Clone templates with the active profileId
      const cloned = templateMatches.map((t, idx) => ({
        ...t,
        id: `med-${profileId}-${idx + 1}`,
        profileId: profileId,
        schedules: [...t.schedules],
      }));
      this.medications.push(...cloned);
      return cloned.map((m) => ({ ...m, schedules: [...m.schedules] }));
    }

    return [];
  }

  public async getById(id: string): Promise<Medication | null> {
    await this.simulateNetwork();
    const item = this.medications.find((m) => m.id === id);
    if (!item) return null;
    return { ...item, schedules: [...item.schedules] };
  }

  public async create(data: CreateMedicationDTO): Promise<Medication> {
    await this.simulateNetwork();

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('O nome do medicamento é obrigatório.');
    }

    if (!data.schedules || data.schedules.length === 0) {
      throw new Error('Pelo menos um horário deve ser informado.');
    }

    const now = new Date().toISOString();
    const newMedication: Medication = {
      id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      profileId: data.profileId,
      name: data.name.trim(),
      schedules: [...data.schedules].sort(),
      recurrence: { ...data.recurrence },
      instructions: data.instructions?.trim() || undefined,
      cardColor: data.cardColor || '#B4ECFB',
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.medications.push(newMedication);
    return { ...newMedication, schedules: [...newMedication.schedules] };
  }

  public async update(id: string, data: UpdateMedicationDTO): Promise<Medication> {
    await this.simulateNetwork();

    const index = this.medications.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`Medicamento com ID "${id}" não encontrado.`);
    }

    const current = this.medications[index];

    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new Error('O nome do medicamento não pode ser vazio.');
    }

    if (data.schedules !== undefined && data.schedules.length === 0) {
      throw new Error('Pelo menos um horário deve ser informado.');
    }

    const updated: Medication = {
      ...current,
      name: data.name !== undefined ? data.name.trim() : current.name,
      schedules: data.schedules !== undefined ? [...data.schedules].sort() : current.schedules,
      recurrence: data.recurrence !== undefined ? { ...data.recurrence } : current.recurrence,
      instructions: data.instructions !== undefined ? (data.instructions.trim() || undefined) : current.instructions,
      cardColor: data.cardColor !== undefined ? data.cardColor : current.cardColor,
      status: data.status !== undefined ? data.status : current.status,
      updatedAt: new Date().toISOString(),
    };

    this.medications[index] = updated;
    return { ...updated, schedules: [...updated.schedules] };
  }

  public async delete(id: string): Promise<void> {
    await this.simulateNetwork();

    const index = this.medications.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`Medicamento com ID "${id}" não encontrado para exclusão.`);
    }

    this.medications.splice(index, 1);
  }
}
