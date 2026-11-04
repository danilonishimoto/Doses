import http from 'node:http';
import { env } from './config/env.js';
import { configureVapid } from './config/vapid.js';
import { runMigrations } from './db/migrate.js';
import { getDatabase, closeDatabase } from './db/connection.js';

console.log('=====================================================');
console.log('  Doses Backend - Notificações Nativas Web Push (Dev)');
console.log('=====================================================');

// 1. Executa migrações na inicialização
runMigrations();

// 2. Configura chaves VAPID
const vapidConfigured = configureVapid();
if (!vapidConfigured) {
  console.warn('[Aviso] Servidor rodando sem chaves VAPID ativas. Execute `npm run generate-vapid` para configurar.');
} else {
  console.log('[VAPID] Configuração de notificações Web Push validada com sucesso.');
}

// 3. Servidor HTTP básico para Health Check e Consulta de Chave Pública
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

  // Rota padrão 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint não encontrado', path: url.pathname }));
});

server.listen(env.PORT, env.HOST, () => {
  console.log(`[HTTP] Servidor Doses ouvindo em http://${env.HOST}:${env.PORT}`);
  console.log(`[HTTP] Health check disponível em: http://${env.HOST}:${env.PORT}/api/v1/health`);
});

// Encerramento gracioso
const shutdown = () => {
  console.log('\n[Shutdown] Encerrando servidor e conexões...');
  server.close(() => {
    closeDatabase();
    console.log('[Shutdown] Recursos liberados com sucesso.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
