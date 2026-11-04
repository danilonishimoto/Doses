import http from 'node:http';
import { z } from 'zod';
import { SubscriptionService } from '../services/subscriptionService.js';
import { AuthService } from '../services/authService.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/authMiddleware.js';

// Schemas Zod de validação rigorosa
const RegisterSubscriptionSchema = z.object({
  endpoint: z.string({ required_error: 'O endpoint é obrigatório.' }).url('O endpoint deve ser uma URL válida.').min(10),
  keys: z.object(
    {
      p256dh: z.string({ required_error: 'A chave p256dh é obrigatória.' }).min(1, 'A chave p256dh não pode ser vazia.'),
      auth: z.string({ required_error: 'A chave auth é obrigatória.' }).min(1, 'A chave auth não pode ser vazia.'),
    },
    { required_error: 'O objeto keys com p256dh e auth é obrigatório.' }
  ),
  deviceName: z.string().max(100).optional(),
  userAgent: z.string().max(500).optional(),
  hideMedicationNames: z.boolean().optional(),
});

const UpdatePrivacySchema = z.object({
  hideMedicationNames: z.boolean({
    required_error: 'O campo hideMedicationNames é obrigatório.',
    invalid_type_error: 'O campo hideMedicationNames deve ser booleano (true ou false).',
  }),
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
      } catch (err) {
        reject(new Error('Formato JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleSubscriptionRoutes(
  req: AuthenticatedRequest,
  res: http.ServerResponse,
  subscriptionService: SubscriptionService,
  authService?: AuthService
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, ''); // Remove trailing slash
  const pathParts = pathname.split('/').filter(Boolean);

  // Validação do prefixo base /api/v1/push-subscriptions
  if (pathParts.length < 3 || pathParts[0] !== 'api' || pathParts[1] !== 'v1' || pathParts[2] !== 'push-subscriptions') {
    return false;
  }

  // TODAS as rotas de push-subscriptions exigem autenticação obrigatória
  const isAuthenticated = authenticateToken(req, res, authService);
  if (!isAuthenticated || !req.user) {
    // A resposta 401 já foi emitida pelo middleware
    return true;
  }

  const authenticatedAccountId = req.user.accountId;

  // 1. POST /api/v1/push-subscriptions — Registro de nova subscription ou atualização por endpoint
  if (req.method === 'POST' && pathParts.length === 3) {
    try {
      const rawBody = await parseBodyJson(req);
      const parsed = RegisterSubscriptionSchema.safeParse(rawBody);

      if (!parsed.success) {
        sendJson(res, 400, {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Dados de inscrição Web Push inválidos.',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
        return true;
      }

      // O account_id do corpo (se houver tentativa de injeção) é estritamente ignorado
      const result = subscriptionService.registerSubscription(authenticatedAccountId, {
        endpoint: parsed.data.endpoint,
        keys: parsed.data.keys,
        deviceName: parsed.data.deviceName,
        userAgent: parsed.data.userAgent,
        hideMedicationNames: parsed.data.hideMedicationNames,
      });

      if (!result.success) {
        if (result.error === 'ENDPOINT_OWNED_BY_ANOTHER_ACCOUNT') {
          sendJson(res, 409, {
            statusCode: 409,
            error: 'Conflict',
            message: result.message,
          });
          return true;
        }

        sendJson(res, result.statusCode || 400, {
          statusCode: result.statusCode || 400,
          error: result.error,
          message: result.message,
        });
        return true;
      }

      sendJson(res, result.created ? 201 : 200, {
        statusCode: result.created ? 201 : 200,
        message: result.created ? 'Inscrição registrada com sucesso.' : 'Inscrição renovada/atualizada com sucesso.',
        subscription: result.subscription,
      });
      return true;
    } catch (err: any) {
      if (err.message === 'Payload Too Large') {
        sendJson(res, 413, { statusCode: 413, error: 'Payload Too Large' });
        return true;
      }
      sendJson(res, 400, {
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Erro ao processar registro de inscrição.',
      });
      return true;
    }
  }

  // 2. GET /api/v1/push-subscriptions — Listagem de subscriptions da conta autenticada
  if (req.method === 'GET' && pathParts.length === 3) {
    const subscriptions = subscriptionService.listSubscriptions(authenticatedAccountId);
    sendJson(res, 200, {
      statusCode: 200,
      subscriptions,
    });
    return true;
  }

  // 3. Sub-rotas com identificador: /api/v1/push-subscriptions/:id
  if (pathParts.length === 4) {
    const subscriptionId = pathParts[3];

    // 3.1. PATCH /api/v1/push-subscriptions/:id — Atualização de preferência de privacidade
    if (req.method === 'PATCH') {
      try {
        const rawBody = await parseBodyJson(req);
        const parsed = UpdatePrivacySchema.safeParse(rawBody);

        if (!parsed.success) {
          sendJson(res, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Campo hideMedicationNames inválido ou ausente.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
          return true;
        }

        const result = subscriptionService.updatePrivacy(
          subscriptionId,
          authenticatedAccountId,
          parsed.data.hideMedicationNames
        );

        if (result.error === 'NOT_FOUND') {
          sendJson(res, 404, {
            statusCode: 404,
            error: 'Not Found',
            message: 'Inscrição Web Push não encontrada.',
          });
          return true;
        }

        if (result.error === 'FORBIDDEN') {
          sendJson(res, 403, {
            statusCode: 403,
            error: 'Forbidden',
            message: 'Você não possui permissão para atualizar esta inscrição.',
          });
          return true;
        }

        sendJson(res, 200, {
          statusCode: 200,
          message: 'Preferência de privacidade atualizada com sucesso.',
          subscription: result.subscription,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 400, {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Erro ao processar atualização.',
        });
        return true;
      }
    }

    // 3.2. DELETE /api/v1/push-subscriptions/:id — Desativação lógica da inscrição
    if (req.method === 'DELETE') {
      const result = subscriptionService.deactivateSubscription(subscriptionId, authenticatedAccountId);

      if (result.error === 'NOT_FOUND') {
        sendJson(res, 404, {
          statusCode: 404,
          error: 'Not Found',
          message: 'Inscrição Web Push não encontrada para remoção/desativação.',
        });
        return true;
      }

      if (result.error === 'FORBIDDEN') {
        sendJson(res, 403, {
          statusCode: 403,
          error: 'Forbidden',
          message: 'Você não possui permissão para desativar ou remover esta inscrição.',
        });
        return true;
      }

      sendJson(res, 200, {
        statusCode: 200,
        message: 'Inscrição Web Push desativada com sucesso.',
        subscription: result.subscription,
      });
      return true;
    }
  }

  // Método não permitido para a rota especificada
  sendJson(res, 405, {
    statusCode: 405,
    error: 'Method Not Allowed',
    message: `Método ${req.method} não suportado para esta rota.`,
  });
  return true;
}
