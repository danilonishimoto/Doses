import http from 'node:http';
import { env } from './config/env.js';
import { configureVapid } from './config/vapid.js';
import { runMigrations } from './db/migrate.js';
import { getDatabase, closeDatabase } from './db/connection.js';
import { AuthService } from './services/authService.js';
import { handleAuthRoutes } from './api/authRoutes.js';
import { SubscriptionService } from './services/subscriptionService.js';
import { handleSubscriptionRoutes } from './api/subscriptionRoutes.js';
import { ProfileService } from './services/profileService.js';
import { MedicationService } from './services/medicationService.js';
import { MedicationTimeService } from './services/medicationTimeService.js';
import { OccurrenceService } from './services/occurrenceService.js';
import { SchedulerService } from './services/schedulerService.js';
import { handleProfileRoutes } from './api/profileRoutes.js';
import { handleMedicationRoutes } from './api/medicationRoutes.js';

console.log('=====================================================');
console.log('  Doses Backend - Notificações Nativas Web Push (Dev)');
console.log('=====================================================');

// 1. Executa migrações na inicialização
runMigrations();

// 2. Instancia os serviços de negócio
const authService = new AuthService();
const subscriptionService = new SubscriptionService();
const profileService = new ProfileService();
const medicationService = new MedicationService();
const medicationTimeService = new MedicationTimeService();
const occurrenceService = new OccurrenceService();
const schedulerService = new SchedulerService({ intervalMs: 30000, horizonDays: 2 });

// 3. Configura chaves VAPID
const vapidConfigured = configureVapid();
if (!vapidConfigured) {
  console.warn('[Aviso] Servidor rodando sem chaves VAPID ativas. Execute `npm run generate-vapid` para configurar.');
} else {
  console.log('[VAPID] Configuração de notificações Web Push validada com sucesso.');
}

// 4. Servidor HTTP para REST APIs e Health Check
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Endpoint: Health Check
  if (req.method === 'GET' && url.pathname === '/api/v1/health') {
    const db = getDatabase();
    const tables = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'doses-backend',
        environment: env.NODE_ENV,
        timezone: env.APP_TIMEZONE,
        tablesCount: tables.count,
        vapidConfigured,
        schedulerRunning: schedulerService.getIsRunning(),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Endpoint: Fornece Chave Pública VAPID para o PWA se inscrever
  if (req.method === 'GET' && url.pathname === '/api/v1/vapid-public-key') {
    if (!env.VAPID_PUBLIC_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Chave pública VAPID não configurada no servidor' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ publicKey: env.VAPID_PUBLIC_KEY }));
    return;
  }

  // Rotas de Autenticação (/api/v1/auth/*)
  if (url.pathname.startsWith('/api/v1/auth/')) {
    handleAuthRoutes(req, res, authService).catch((err) => {
      console.error('[HTTP Auth Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ statusCode: 500, error: 'Internal Server Error' }));
    });
    return;
  }

  // Rotas de Inscrições Web Push (/api/v1/push-subscriptions*)
  if (url.pathname.startsWith('/api/v1/push-subscriptions')) {
    handleSubscriptionRoutes(req, res, subscriptionService, authService).catch((err) => {
      console.error('[HTTP Push Subscriptions Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ statusCode: 500, error: 'Internal Server Error' }));
    });
    return;
  }

  // Rotas de Perfis (/api/v1/profiles*)
  if (url.pathname.startsWith('/api/v1/profiles')) {
    handleProfileRoutes(req, res, profileService, medicationService, authService, occurrenceService).catch((err) => {
      console.error('[HTTP Profile Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ statusCode: 500, error: 'Internal Server Error' }));
    });
    return;
  }

  // Rotas de Medicamentos e Horários (/api/v1/medications* e /api/v1/medication-times*)
  if (url.pathname.startsWith('/api/v1/medications') || url.pathname.startsWith('/api/v1/medication-times')) {
    handleMedicationRoutes(req, res, medicationService, medicationTimeService, authService).catch((err) => {
      console.error('[HTTP Medication Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ statusCode: 500, error: 'Internal Server Error' }));
    });
    return;
  }

  // Rota padrão 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint não encontrado', path: url.pathname }));
});

server.listen(env.PORT, env.HOST, () => {
  console.log(`[HTTP] Servidor Doses ouvindo em http://${env.HOST}:${env.PORT}`);
  console.log(`[HTTP] Health check disponível em: http://${env.HOST}:${env.PORT}/api/v1/health`);

  // 5. Inicia o agendador automático contínuo
  schedulerService.start();
});

// Encerramento gracioso
const shutdown = async () => {
  console.log('\n[Shutdown] Encerrando servidor e conexões...');
  try {
    await schedulerService.stop(5000);
  } catch (err) {
    console.error('[Shutdown] Erro ao parar scheduler:', err);
  }
  server.close(() => {
    closeDatabase();
    console.log('[Shutdown] Recursos liberados com sucesso.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
