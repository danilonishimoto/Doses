import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';

export interface PrescriptionDto {
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

export interface CreatePrescriptionInput {
  specialty: string;
  doctorName: string;
  crm?: string;
  clinicOrHospital?: string;
  emissionDate: string;
  expirationDate?: string;
  medications?: string[];
  instructions?: string;
  cardColor?: string;
}

export interface UpdatePrescriptionInput {
  specialty?: string;
  doctorName?: string;
  crm?: string;
  clinicOrHospital?: string;
  emissionDate?: string;
  expirationDate?: string;
  medications?: string[];
  instructions?: string;
  cardColor?: string;
}

export class PrescriptionService {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb || getDatabase();
  }

  createPrescription(
    accountId: string,
    profileId: string,
    input: CreatePrescriptionInput
  ): PrescriptionDto | { error: string } {
    // Valida que o perfil existe e pertence a esta conta
    const profile = this.db.prepare(`
      SELECT id FROM profiles
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(profileId, accountId);

    if (!profile) {
      return { error: 'PROFILE_NOT_FOUND' };
    }

    const id = 'rec_' + crypto.randomUUID();
    const specialty = input.specialty.trim();
    const doctorName = input.doctorName.trim();
    const crm = (input.crm || '').trim();
    const clinicOrHospital = (input.clinicOrHospital || '').trim();
    const emissionDate = input.emissionDate.trim();
    const expirationDate = (input.expirationDate || '').trim();
    const medications = Array.isArray(input.medications) ? input.medications.map(m => String(m).trim()).filter(Boolean) : [];
    const instructions = (input.instructions || '').trim();
    const cardColor = (input.cardColor || '#B4ECFB').trim();

    this.db.prepare(`
      INSERT INTO prescriptions (
        id, profile_id, account_id, specialty, doctor_name, crm, clinic_or_hospital,
        emission_date, expiration_date, medications_json, instructions, card_color,
        is_deleted, version, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        0, 1, datetime('now'), datetime('now')
      )
    `).run(
      id,
      profileId,
      accountId,
      specialty,
      doctorName,
      crm,
      clinicOrHospital,
      emissionDate,
      expirationDate,
      JSON.stringify(medications),
      instructions,
      cardColor
    );

    return this.getPrescriptionById(accountId, profileId, id)!;
  }

  listPrescriptions(accountId: string, profileId: string): PrescriptionDto[] | null {
    const profile = this.db.prepare(`
      SELECT id FROM profiles
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(profileId, accountId);

    if (!profile) {
      return null;
    }

    const rows = this.db.prepare(`
      SELECT id, profile_id, account_id, specialty, doctor_name, crm, clinic_or_hospital,
             emission_date, expiration_date, medications_json, instructions, card_color,
             version, created_at, updated_at
      FROM prescriptions
      WHERE profile_id = ? AND account_id = ? AND is_deleted = 0
      ORDER BY emission_date DESC, created_at DESC
    `).all(profileId, accountId) as any[];

    return rows.map((r) => this.mapRowToDto(r));
  }

  getPrescriptionById(accountId: string, profileId: string, prescriptionId: string): PrescriptionDto | null {
    const row = this.db.prepare(`
      SELECT id, profile_id, account_id, specialty, doctor_name, crm, clinic_or_hospital,
             emission_date, expiration_date, medications_json, instructions, card_color,
             version, created_at, updated_at
      FROM prescriptions
      WHERE id = ? AND profile_id = ? AND account_id = ? AND is_deleted = 0
    `).get(prescriptionId, profileId, accountId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToDto(row);
  }

  updatePrescription(
    accountId: string,
    profileId: string,
    prescriptionId: string,
    input: UpdatePrescriptionInput
  ): PrescriptionDto | null {
    const existing = this.getPrescriptionById(accountId, profileId, prescriptionId);
    if (!existing) {
      return null;
    }

    const newSpecialty = input.specialty !== undefined ? input.specialty.trim() : existing.specialty;
    const newDoctorName = input.doctorName !== undefined ? input.doctorName.trim() : existing.doctorName;
    const newCrm = input.crm !== undefined ? input.crm.trim() : existing.crm;
    const newClinic = input.clinicOrHospital !== undefined ? input.clinicOrHospital.trim() : existing.clinicOrHospital;
    const newEmission = input.emissionDate !== undefined ? input.emissionDate.trim() : existing.emissionDate;
    const newExpiration = input.expirationDate !== undefined ? input.expirationDate.trim() : existing.expirationDate;
    const newMedications = input.medications !== undefined
      ? (Array.isArray(input.medications) ? input.medications.map(m => String(m).trim()).filter(Boolean) : [])
      : existing.medications;
    const newInstructions = input.instructions !== undefined ? input.instructions.trim() : existing.instructions;
    const newCardColor = input.cardColor !== undefined ? input.cardColor.trim() : existing.cardColor;

    this.db.prepare(`
      UPDATE prescriptions
      SET specialty = ?,
          doctor_name = ?,
          crm = ?,
          clinic_or_hospital = ?,
          emission_date = ?,
          expiration_date = ?,
          medications_json = ?,
          instructions = ?,
          card_color = ?,
          version = version + 1,
          updated_at = datetime('now')
      WHERE id = ? AND profile_id = ? AND account_id = ? AND is_deleted = 0
    `).run(
      newSpecialty,
      newDoctorName,
      newCrm,
      newClinic,
      newEmission,
      newExpiration,
      JSON.stringify(newMedications),
      newInstructions,
      newCardColor,
      prescriptionId,
      profileId,
      accountId
    );

    return this.getPrescriptionById(accountId, profileId, prescriptionId);
  }

  deletePrescription(accountId: string, profileId: string, prescriptionId: string): boolean {
    const info = this.db.prepare(`
      UPDATE prescriptions
      SET is_deleted = 1,
          deleted_at = datetime('now'),
          version = version + 1,
          updated_at = datetime('now')
      WHERE id = ? AND profile_id = ? AND account_id = ? AND is_deleted = 0
    `).run(prescriptionId, profileId, accountId);

    return info.changes > 0;
  }

  private mapRowToDto(row: any): PrescriptionDto {
    let medications: string[] = [];
    try {
      medications = JSON.parse(row.medications_json || '[]');
    } catch {
      medications = [];
    }

    return {
      id: row.id,
      profileId: row.profile_id,
      accountId: row.account_id,
      specialty: row.specialty,
      doctorName: row.doctor_name,
      crm: row.crm || '',
      clinicOrHospital: row.clinic_or_hospital || '',
      emissionDate: row.emission_date,
      expirationDate: row.expiration_date || '',
      medications,
      instructions: row.instructions || '',
      cardColor: row.card_color || '#B4ECFB',
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
