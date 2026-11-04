import http from 'node:http';
import { z } from 'zod';
import { MedicationService } from '../services/medicationService.js';
import { MedicationTimeService } from '../services/medicationTimeService.js';
import { AuthService } from '../services/authService.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { validateRecurrence } from '../utils/recurrenceValidator.js';

const TimeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

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

const UpdateMedicationSchema = z.object({
  name: z.string().trim().min(1, 'O nome não pode ser vazio.').max(150).optional(),
  dosage: z.string().trim().max(100).optional(),
  recurrence: RecurrenceZodSchema.optional(),
  expectedVersion: z.number().int().positive().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Pelo menos um campo deve ser fornecido para atualização.',
});

const CreateMedicationTimeSchema = z.object({
  time: z.string({ required_error: 'O horário é obrigatório.' })
    .trim()
    .regex(TimeRegex, 'O horário deve estar no formato 24h "HH:mm" (ex: 08:00, 14:30).'),
});

const UpdateMedicationTimeSchema = z.object({
  time: z.string({ required_error: 'O horário é obrigatório.' })
    .trim()
    .regex(TimeRegex, 'O horário deve estar no formato 24h "HH:mm" (ex: 08:00, 14:30).'),
  expectedVersion: z.number().int().positive().optional(),
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

export async function handleMedicationRoutes(
  req: AuthenticatedRequest,
  res: http.ServerResponse,
  medicationService: MedicationService,
  medicationTimeService: MedicationTimeService,
  authService?: AuthService
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '');
  const pathParts = pathname.split('/').filter(Boolean);

  const isMedicationRoute = pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'v1' && pathParts[2] === 'medications';
  const isMedicationTimeRoute = pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'v1' && pathParts[2] === 'medication-times';

  if (!isMedicationRoute && !isMedicationTimeRoute) {
    return false;
  }

  // Autenticação obrigatória em todas as rotas
  const isAuthenticated = authenticateToken(req, res, authService);
  if (!isAuthenticated || !req.user) {
    return true;
  }

  const accountId = req.user.accountId;

  // 1. /api/v1/medications/:id
  if (isMedicationRoute && pathParts.length === 4) {
    const medicationId = pathParts[3];

    // 1.1. GET /api/v1/medications/:id — Consultar medicamento
    if (req.method === 'GET') {
      const medication = medicationService.getMedicationById(accountId, medicationId);
      if (!medication) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Medicamento não encontrado.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        medication,
      });
      return true;
    }

    // 1.2. PATCH /api/v1/medications/:id — Atualizar medicamento
    if (req.method === 'PATCH') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = UpdateMedicationSchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Dados de atualização inválidos.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const result = medicationService.updateMedication(accountId, medicationId, parsed.data);
        if (result.error === 'NOT_FOUND') {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Medicamento não encontrado para atualização.',
          });
          return true;
        }

        if (result.error === 'VERSION_CONFLICT') {
          sendJson(res, 409, {
            statusCode: 409,
            error: 'Conflict',
            message: 'Conflito de versão: o medicamento foi alterado concorrentemente.',
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

        sendJson(res, 200, {
          statusCode: 200,
          message: 'Medicamento atualizado com sucesso.',
          medication: result.medication,
          cancelledOccurrencesCount: result.cancelledOccurrencesCount,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
        return true;
      }
    }

    // 1.3. DELETE /api/v1/medications/:id — Excluir medicamento logicamente
    if (req.method === 'DELETE') {
      const result = medicationService.deleteMedication(accountId, medicationId);
      if (!result.success) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Medicamento não encontrado para exclusão.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        message: 'Medicamento excluído com sucesso.',
        cancelledOccurrencesCount: result.cancelledOccurrencesCount,
      });
      return true;
    }
  }

  // 2. /api/v1/medications/:medicationId/times
  if (isMedicationRoute && pathParts.length === 5 && pathParts[4] === 'times') {
    const medicationId = pathParts[3];

    // 2.1. POST /api/v1/medications/:medicationId/times — Criar horário de medicamento
    if (req.method === 'POST') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = CreateMedicationTimeSchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Horário inválido.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const result = medicationTimeService.createMedicationTime(accountId, medicationId, parsed.data);
        if (result.error === 'MEDICATION_NOT_FOUND') {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Medicamento não encontrado para associar o horário.',
          });
          return true;
        }

        if (result.error === 'DUPLICATE_TIME') {
          sendJson(res, 409, {
            statusCode: 409,
            error: 'Conflict',
            message: 'Este horário já está cadastrado para este medicamento.',
          });
          return true;
        }

        sendJson(res, 201, {
          statusCode: 201,
          message: 'Horário cadastrado com sucesso.',
          time: result.time,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
        return true;
      }
    }

    // 2.2. GET /api/v1/medications/:medicationId/times — Listar horários do medicamento
    if (req.method === 'GET') {
      const times = medicationTimeService.listMedicationTimes(accountId, medicationId);
      if (times === null) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Medicamento não encontrado.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        times,
      });
      return true;
    }
  }

  // 3. /api/v1/medication-times/:id
  if (isMedicationTimeRoute && pathParts.length === 4) {
    const timeId = pathParts[3];

    // 3.1. GET /api/v1/medication-times/:id — Consultar horário
    if (req.method === 'GET') {
      const time = medicationTimeService.getMedicationTimeById(accountId, timeId);
      if (!time) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Horário não encontrado.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        time,
      });
      return true;
    }

    // 3.2. PATCH /api/v1/medication-times/:id — Atualizar horário
    if (req.method === 'PATCH') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = UpdateMedicationTimeSchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Horário inválido.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const result = medicationTimeService.updateMedicationTime(accountId, timeId, parsed.data);
        if (result.error === 'NOT_FOUND') {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Horário não encontrado para atualização.',
          });
          return true;
        }

        if (result.error === 'DUPLICATE_TIME') {
          sendJson(res, 409, {
            statusCode: 409,
            error: 'Conflict',
            message: 'Já existe outro registro com este horário para o mesmo medicamento.',
          });
          return true;
        }

        if (result.error === 'VERSION_CONFLICT') {
          sendJson(res, 409, {
            statusCode: 409,
            error: 'Conflict',
            message: 'Conflito de versão: o horário foi alterado concorrentemente.',
          });
          return true;
        }

        sendJson(res, 200, {
          statusCode: 200,
          message: 'Horário atualizado com sucesso.',
          time: result.time,
          cancelledOccurrencesCount: result.cancelledOccurrencesCount,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { statusCode: 400, error: 'Bad Request', message: err.message });
        return true;
      }
    }

    // 3.3. DELETE /api/v1/medication-times/:id — Excluir logicamente o horário
    if (req.method === 'DELETE') {
      const result = medicationTimeService.deleteMedicationTime(accountId, timeId);
      if (!result.success) {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Horário não encontrado para exclusão.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        message: 'Horário excluído com sucesso.',
        cancelledOccurrencesCount: result.cancelledOccurrencesCount,
      });
      return true;
    }
  }

  sendJson(res, 405, {
    statusCode: 405,
    error: 'Method Not Allowed',
    message: `Método ${req.method} não suportado para esta rota.`,
  });
  return true;
}
