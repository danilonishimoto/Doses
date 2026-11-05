import http from 'node:http';
import { z } from 'zod';
import { ProfileService } from '../services/profileService.js';
import { MedicationService } from '../services/medicationService.js';
import { OccurrenceService } from '../services/occurrenceService.js';
import { PrescriptionService } from '../services/prescriptionService.js';
import { AuthService } from '../services/authService.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { validateRecurrence } from '../utils/recurrenceValidator.js';

const RecurrenceZodSchema = z.string()
  .trim()
  .max(100)
  .superRefine((val, ctx) => {
    const res = validateRecurrence(val);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || 'Formato de recorrência inválido.',
      });
    }
  });

const CreateProfileSchema = z.object({
  name: z.string({ required_error: 'O nome do perfil é obrigatório.' })
    .trim()
    .min(1, 'O nome do perfil não pode ser vazio.')
    .max(100, 'O nome do perfil deve ter no máximo 100 caracteres.'),
  surname: z.string().trim().max(100, 'O sobrenome deve ter no máximo 100 caracteres.').optional(),
  avatar: z.string({ required_error: 'O avatar do perfil é obrigatório.' })
    .trim()
    .min(1, 'O avatar não pode ser vazio.')
    .max(200, 'O avatar deve ter no máximo 200 caracteres.'),
  isMainProfile: z.boolean().optional(),
  age: z.number().int().min(0).max(150).optional(),
  weight: z.number().min(0).max(500).optional(),
  height: z.number().min(0).max(300).optional(),
  medicalConditions: z.string().max(1000).optional(),
  allergies: z.string().max(1000).optional(),
});

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1, 'O nome não pode ser vazio.').max(100).optional(),
  surname: z.string().trim().max(100).optional(),
  avatar: z.string().trim().min(1, 'O avatar não pode ser vazio.').max(200).optional(),
  isMainProfile: z.boolean().optional(),
  age: z.number().int().min(0).max(150).optional(),
  weight: z.number().min(0).max(500).optional(),
  height: z.number().min(0).max(300).optional(),
  medicalConditions: z.string().max(1000).optional(),
  allergies: z.string().max(1000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Pelo menos um campo deve ser fornecido para atualização.',
});

const CreateMedicationSchema = z.object({
  name: z.string({ required_error: 'O nome do medicamento é obrigatório.' })
    .trim()
    .min(1, 'O nome do medicamento não pode ser vazio.')
    .max(150, 'O nome do medicamento deve ter no máximo 150 caracteres.'),
  dosage: z.string().trim().max(100).optional(),
  recurrence: RecurrenceZodSchema.optional(),
});

const CreatePrescriptionSchema = z.object({
  specialty: z.string({ required_error: 'A especialidade é obrigatória.' })
    .trim()
    .min(1, 'A especialidade não pode ser vazia.')
    .max(100),
  doctorName: z.string({ required_error: 'O nome do médico é obrigatório.' })
    .trim()
    .min(1, 'O nome do médico não pode ser vazio.')
    .max(150),
  crm: z.string().trim().max(50).optional(),
  clinicOrHospital: z.string().trim().max(150).optional(),
  emissionDate: z.string({ required_error: 'A data de emissão é obrigatória.' })
    .trim()
    .min(1, 'A data de emissão não pode ser vazia.')
    .max(50),
  expirationDate: z.string().trim().max(50).optional(),
  medications: z.array(z.string()).optional(),
  instructions: z.string().trim().max(1000).optional(),
  cardColor: z.string().trim().max(30).optional(),
});

const UpdatePrescriptionSchema = z.object({
  specialty: z.string().trim().min(1).max(100).optional(),
  doctorName: z.string().trim().min(1).max(150).optional(),
  crm: z.string().trim().max(50).optional(),
  clinicOrHospital: z.string().trim().max(150).optional(),
  emissionDate: z.string().trim().min(1).max(50).optional(),
  expirationDate: z.string().trim().max(50).optional(),
  medications: z.array(z.string()).optional(),
  instructions: z.string().trim().max(1000).optional(),
  cardColor: z.string().trim().max(30).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Pelo menos um campo deve ser fornecido para atualização.',
});

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseBodyJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Formato JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleProfileRoutes(
  req: AuthenticatedRequest,
  res: http.ServerResponse,
  profileService: ProfileService,
  medicationService: MedicationService,
  authService?: AuthService,
  occurrenceService?: OccurrenceService,
  prescriptionService?: PrescriptionService
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '');
  const pathParts = pathname.split('/').filter(Boolean);

  if (pathParts.length < 3 || pathParts[0] !== 'api' || pathParts[1] !== 'v1' || pathParts[2] !== 'profiles') {
    return false;
  }

  // Autenticação obrigatória em todas as rotas de perfis
  const isAuthenticated = authenticateToken(req, res, authService);
  if (!isAuthenticated || !req.user) {
    return true;
  }

  const accountId = req.user.accountId;
  const prescService = prescriptionService || new PrescriptionService();

  // 1. /api/v1/profiles
  if (pathParts.length === 3) {
    // 1.1. POST /api/v1/profiles — Criar perfil
    if (req.method === 'POST') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = CreateProfileSchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Dados do perfil inválidos.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const profile = profileService.createProfile(accountId, {
          name: parsed.data.name,
          surname: parsed.data.surname,
          avatar: parsed.data.avatar,
          isMainProfile: parsed.data.isMainProfile,
          age: parsed.data.age,
          weight: parsed.data.weight,
          height: parsed.data.height,
          medicalConditions: parsed.data.medicalConditions,
          allergies: parsed.data.allergies,
        });

        sendJson(res, 201, {
          statusCode: 201,
          message: 'Perfil criado com sucesso.',
          profile,
        });
        return true;
      } catch (err: any) {
        if (err.message === 'Payload Too Large') {
          sendJson(res, 413, { statusCode: 413, error: 'Payload Too Large' });
          return true;
        }
        sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
        return true;
      }
    }

    // 1.2. GET /api/v1/profiles — Listar perfis da conta autenticada
    if (req.method === 'GET') {
      const profiles = profileService.listProfiles(accountId);
      sendJson(res, 200, {
        statusCode: 200,
        profiles,
      });
      return true;
    }
  }

  // 2. /api/v1/profiles/:id
  if (pathParts.length === 4) {
    const profileId = pathParts[3];

    // 2.1. GET /api/v1/profiles/:id — Consultar perfil específico
    if (req.method === 'GET') {
      const profile = profileService.getProfileById(accountId, profileId);
      if (!profile) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Perfil não encontrado.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        profile,
      });
      return true;
    }

    // 2.2. PATCH ou PUT /api/v1/profiles/:id — Atualizar perfil
    if (req.method === 'PATCH' || req.method === 'PUT') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = UpdateProfileSchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Dados de atualização inválidos.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const updated = profileService.updateProfile(accountId, profileId, parsed.data);
        if (!updated) {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Perfil não encontrado para atualização.',
          });
          return true;
        }

        sendJson(res, 200, {
          statusCode: 200,
          message: 'Perfil atualizado com sucesso.',
          profile: updated,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
        return true;
      }
    }

    // 2.3. DELETE /api/v1/profiles/:id — Excluir logicamente o perfil
    if (req.method === 'DELETE') {
      const result = profileService.deleteProfile(accountId, profileId);
      if (!result.success) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Perfil não encontrado para exclusão.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        message: 'Perfil excluído com sucesso.',
        cancelledOccurrencesCount: result.cancelledOccurrencesCount,
      });
      return true;
    }
  }

  // 3. /api/v1/profiles/:profileId/medications
  if (pathParts.length === 5 && pathParts[4] === 'medications') {
    const profileId = pathParts[3];

    // 3.1. POST /api/v1/profiles/:profileId/medications — Criar medicamento para o perfil
    if (req.method === 'POST') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = CreateMedicationSchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Dados do medicamento inválidos.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const result = medicationService.createMedication(accountId, profileId, parsed.data);
        if (result.error === 'PROFILE_NOT_FOUND') {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Perfil não encontrado para associar o medicamento.',
          });
          return true;
        }

        if (result.error === 'INVALID_RECURRENCE') {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: result.errorMessage || 'Formato de recorrência inválido.',
          });
          return true;
        }

        sendJson(res, 201, {
          statusCode: 201,
          message: 'Medicamento criado com sucesso.',
          medication: result.medication,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
        return true;
      }
    }

    // 3.2. GET /api/v1/profiles/:profileId/medications — Listar medicamentos do perfil
    if (req.method === 'GET') {
      const medications = medicationService.listMedicationsByProfile(accountId, profileId);
      if (medications === null) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Perfil não encontrado.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        medications,
      });
      return true;
    }
  }

  // 4. /api/v1/profiles/:profileId/occurrences
  if (pathParts.length >= 5 && pathParts[4] === 'occurrences') {
    const profileId = pathParts[3];
    const occService = occurrenceService || new OccurrenceService();

    // 4.1. GET /api/v1/profiles/:profileId/occurrences
    if (pathParts.length === 5 && req.method === 'GET') {
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      if (startDate && endDate) {
        const occurrences = occService.listOccurrencesByDateRange(accountId, profileId, startDate, endDate);
        sendJson(res, 200, {
          statusCode: 200,
          startDate,
          endDate,
          occurrences,
        });
        return true;
      }

      const dateParam = url.searchParams.get('date');
      const targetDate = dateParam || new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      const occurrences = occService.listOccurrencesByDate(accountId, profileId, targetDate);
      sendJson(res, 200, {
        statusCode: 200,
        date: targetDate,
        occurrences,
      });
      return true;
    }

    // 4.2. POST /api/v1/profiles/:profileId/occurrences/:occurrenceId/confirm
    if (pathParts.length === 7 && pathParts[6] === 'confirm' && req.method === 'POST') {
      const occurrenceId = pathParts[5];
      let confirmedAt: string | undefined;
      try {
        const rawBody = await parseBodyJson(req);
        if (rawBody && typeof rawBody.confirmedAt === 'string') {
          confirmedAt = rawBody.confirmedAt;
        }
      } catch {
        // body opcional
      }

      const result = occService.confirmOccurrence(accountId, profileId, occurrenceId, confirmedAt);
      if (result.error === 'NOT_FOUND') {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Ocorrência não encontrada ou cancelada.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        message: 'Dose confirmada com sucesso.',
        ...result,
      });
      return true;
    }

    // 4.3. POST /api/v1/profiles/:profileId/occurrences/:occurrenceId/unconfirm
    if (pathParts.length === 7 && pathParts[6] === 'unconfirm' && req.method === 'POST') {
      const occurrenceId = pathParts[5];
      const result = occService.unconfirmOccurrence(accountId, profileId, occurrenceId);
      if (result.error === 'NOT_FOUND') {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Ocorrência não encontrada ou cancelada.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        message: 'Confirmação desfeita com sucesso.',
        ...result,
      });
      return true;
    }
  }

  // 5. /api/v1/profiles/:profileId/prescriptions
  if (pathParts.length >= 5 && pathParts[4] === 'prescriptions') {
    const profileId = pathParts[3];

    // 5.1. POST /api/v1/profiles/:profileId/prescriptions — Criar receita médica
    if (pathParts.length === 5 && req.method === 'POST') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = CreatePrescriptionSchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Dados da receita inválidos.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const result = prescService.createPrescription(accountId, profileId, parsed.data);
        if ('error' in result && result.error === 'PROFILE_NOT_FOUND') {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Perfil não encontrado para associar a receita.',
          });
          return true;
        }

        sendJson(res, 201, {
          statusCode: 201,
          message: 'Receita médica cadastrada com sucesso.',
          prescription: result,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
        return true;
      }
    }

    // 5.2. GET /api/v1/profiles/:profileId/prescriptions — Listar receitas do perfil
    if (pathParts.length === 5 && req.method === 'GET') {
      const prescriptions = prescService.listPrescriptions(accountId, profileId);
      if (prescriptions === null) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Perfil não encontrado.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        prescriptions,
      });
      return true;
    }

    // 5.3. /api/v1/profiles/:profileId/prescriptions/:prescriptionId
    if (pathParts.length === 6) {
      const prescriptionId = pathParts[5];

      // GET
      if (req.method === 'GET') {
        const item = prescService.getPrescriptionById(accountId, profileId, prescriptionId);
        if (!item) {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Receita médica não encontrada.',
          });
          return true;
        }

        sendJson(res, 200, {
          statusCode: 200,
          prescription: item,
        });
        return true;
      }

      // PATCH ou PUT
      if (req.method === 'PATCH' || req.method === 'PUT') {
        try {
          const rawBody = await parseBodyJson(req);
          const parsed = UpdatePrescriptionSchema.safeParse(rawBody);

          if (!parsed.success) {
            sendJson(res, 400, {
              statusCode: 400,
              error: 'Bad Request',
              message: 'Dados de atualização da receita inválidos.',
              details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
            });
            return true;
          }

          const updated = prescService.updatePrescription(accountId, profileId, prescriptionId, parsed.data);
          if (!updated) {
            sendJson(res, 404, {
              statusCode: 404,
              error: 'Not Found',
              message: 'Receita médica não encontrada para atualização.',
            });
            return true;
          }

          sendJson(res, 200, {
            statusCode: 200,
            message: 'Receita médica atualizada com sucesso.',
            prescription: updated,
          });
          return true;
        } catch (err: any) {
          sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
          return true;
        }
      }

      // DELETE
      if (req.method === 'DELETE') {
        const deleted = prescService.deletePrescription(accountId, profileId, prescriptionId);
        if (!deleted) {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Receita médica não encontrada para exclusão.',
          });
          return true;
        }

        sendJson(res, 200, {
          statusCode: 200,
          message: 'Receita médica excluída com sucesso.',
        });
        return true;
      }
    }
  }

  sendJson(res, 405, {
    statusCode: 405,
    error: 'Method Not Allowed',
    message: `Método ${req.method} não suportado para esta rota.`,
  });
  return true;
}
