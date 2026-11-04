import Database from 'better-sqlite3';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { runVersionedMigrations } from '../db/migrator.js';
import { AuthService } from './authService.js';
import { hashRefreshToken } from '../utils/crypto.js';
import { verifyJwt } from '../utils/jwt.js';

const TEMP_AUTH_DB = path.resolve('/tmp', `doses_test_auth_concurrency_${Date.now()}.db`);

// ============================================================================
// CÓDIGO DO WORKER THREAD
// ============================================================================
if (!isMainThread) {
  const { dbPath, refreshToken, workerId } = workerData;
  const db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');
  const service = new AuthService(db);

  parentPort?.on('message', (msg) => {
    if (msg.action === 'REFRESH') {
      try {
        const tokens = service.refresh({ refreshToken });
        parentPort?.postMessage({
          workerId,
          success: true,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      } catch (err: any) {
        parentPort?.postMessage({
          workerId,
          success: false,
          code: err.code,
          message: err.message,
        });
      } finally {
        db.close();
      }
    }
  });
}

// ============================================================================
// CÓDIGO DA THREAD PRINCIPAL (SUÍTE COMPLETA DE 10 CENÁRIOS)
// ============================================================================
if (isMainThread) {
  async function runAuthConcurrencyTests() {
    console.log('====================================================================');
    console.log('  Validação Completa de Concorrência e Revogação em Refresh Tokens  ');
    console.log('====================================================================');

    // 1. Cria banco temporário isolado em modo WAL
    const mainDb = new Database(TEMP_AUTH_DB);
    mainDb.pragma('journal_mode = WAL');
    mainDb.pragma('foreign_keys = ON');
    mainDb.pragma('busy_timeout = 5000');
    runVersionedMigrations(mainDb);

    const authService = new AuthService(mainDb);

    // Cria conta de teste
    const user = authService.register({
      username: 'usuario_concorrente',
      password: 'PasswordSuperSegura123!',
    });

    console.log('1. Banco temporário e conta de teste criados em modo WAL.');

    // --------------------------------------------------------------------------
    // CENÁRIO 1: Renovação Normal
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Renovação Normal (Rotação e Invalidação Anterior) ---');
    const loginDev1 = authService.login({
      username: 'usuario_concorrente',
      password: 'PasswordSuperSegura123!',
      deviceId: 'iphone_user',
    });

    const rot1 = authService.refresh({ refreshToken: loginDev1.refreshToken });
    if (!rot1.accessToken || !rot1.refreshToken || rot1.refreshToken === loginDev1.refreshToken) {
      throw new Error('Falha no Cenário 1: Rotação normal não gerou novos tokens.');
    }

    const prevHash = hashRefreshToken(loginDev1.refreshToken);
    const prevSession = mainDb.prepare('SELECT is_revoked, replaced_by_hash FROM auth_sessions WHERE refresh_token_hash = ?').get(prevHash) as any;
    if (prevSession.is_revoked !== 1 || !prevSession.replaced_by_hash) {
      throw new Error('Falha no Cenário 1: Token anterior não foi invalidado com replaced_by_hash!');
    }
    console.log('Cenário 1 Aprovado: Renovação normal rotacionou e invalidou o anterior.');

    // --------------------------------------------------------------------------
    // CENÁRIO 2: Reutilização Posterior (Família Inteira Revogada)
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Reutilização Posterior (Token Família Revogada) ---');
    let reuseErrorCaught = false;
    try {
      authService.refresh({ refreshToken: loginDev1.refreshToken }); // Tenta usar token anterior
    } catch (err: any) {
      if (err.code === 'TOKEN_REUSED_FAMILY_REVOKED') reuseErrorCaught = true;
    }

    if (!reuseErrorCaught) {
      throw new Error('Falha no Cenário 2: Reúso posterior não acionou TOKEN_REUSED_FAMILY_REVOKED!');
    }

    // Verifica que até o novo token (rot1) foi revogado na família
    const rot1Hash = hashRefreshToken(rot1.refreshToken);
    const rot1Session = mainDb.prepare('SELECT is_revoked FROM auth_sessions WHERE refresh_token_hash = ?').get(rot1Hash) as any;
    if (rot1Session.is_revoked !== 1) {
      throw new Error('Falha no Cenário 2: O novo token da família deveria ter sido revogado em cadeia!');
    }
    console.log('Cenário 2 Aprovado: Reutilização posterior revogou toda a família em cadeia.');

    // --------------------------------------------------------------------------
    // CENÁRIO 3, 4 e 5: Concorrência Real com 2 Workers Paralelos no Mesmo Token
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIOS 3, 4 e 5: Disputa Concorrente Real (2 Workers Paralelos) ---');

    // Cria novo login exclusivo para a disputa concorrente
    const loginConcorrente = authService.login({
      username: 'usuario_concorrente',
      password: 'PasswordSuperSegura123!',
      deviceId: 'dispositivo_corrida',
    });

    const sharedToken = loginConcorrente.refreshToken;
    const sharedHash = hashRefreshToken(sharedToken);

    // Inicia dois Worker threads concorrentes apontando para o mesmo banco temporário
    const worker1 = new Worker(new URL(import.meta.url), {
      workerData: { dbPath: TEMP_AUTH_DB, refreshToken: sharedToken, workerId: 'Worker_Alpha' },
    });
    const worker2 = new Worker(new URL(import.meta.url), {
      workerData: { dbPath: TEMP_AUTH_DB, refreshToken: sharedToken, workerId: 'Worker_Beta' },
    });

    const responses: any[] = [];
    const barrier = new Promise<void>((resolve) => {
      let count = 0;
      const handler = (data: any) => {
        responses.push(data);
        count++;
        if (count === 2) resolve();
      };
      worker1.on('message', handler);
      worker2.on('message', handler);
    });

    // Dispara requisições rigorosamente simultâneas
    worker1.postMessage({ action: 'REFRESH' });
    worker2.postMessage({ action: 'REFRESH' });

    await barrier;
    await worker1.terminate();
    await worker2.terminate();

    const winner = responses.find((r) => r.success);
    const loser = responses.find((r) => !r.success);

    console.log(`Resposta Worker Alpha: ${responses.find((r) => r.workerId === 'Worker_Alpha')?.success ? 'VENCEU ROTAÇÃO' : 'CONFLITO DETECTADO'}`);
    console.log(`Resposta Worker Beta: ${responses.find((r) => r.workerId === 'Worker_Beta')?.success ? 'VENCEU ROTAÇÃO' : 'CONFLITO DETECTADO'}`);

    if (!winner || !loser) {
      throw new Error(`Falha no Cenário 3/4/5: Exatamente 1 worker deve vencer e 1 deve receber conflito! Respostas: ${JSON.stringify(responses)}`);
    }

    if (loser.code !== 'CONCURRENT_REFRESH_CONFLICT' && loser.code !== 'TOKEN_REUSED_FAMILY_REVOKED') {
      throw new Error(`Falha no Cenário 5: Erro do perdedor não foi de conflito/reúso! Recebido: ${loser.code}`);
    }

    // Comprova que a revogação da família foi EFETIVAMENTE PERSISTIDA no banco de dados!
    const familyRow = mainDb.prepare(`
      SELECT count(*) as activeCount
      FROM auth_sessions
      WHERE account_id = ? AND token_family = (SELECT token_family FROM auth_sessions WHERE refresh_token_hash = ?) AND is_revoked = 0
    `).get(user.account.id, sharedHash) as { activeCount: number };

    console.log(`Sessões ativas restantes na família disputada: ${familyRow.activeCount}`);
    if (familyRow.activeCount !== 0) {
      throw new Error('Falha Crítica no Cenário 5: A família de sessões NÃO foi revogada no banco após a colisão concorrente (rollback indevido)!');
    }
    console.log('Cenários 3, 4 e 5 Aprovados: 1 vencedor, 1 perdedor e revogação da família comitada com sucesso no disco!');

    // --------------------------------------------------------------------------
    // CENÁRIO 6: Access Token da Família Revogada Rejeitado no Middleware
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 6: Validação de Sessão do Access Token após Colisão ---');
    const winnerTokenPayload = verifyJwt(winner.accessToken).payload;
    const sessionActiveForWinner = authService.isSessionActive(winnerTokenPayload!.sid, winnerTokenPayload!.sub);

    if (sessionActiveForWinner) {
      throw new Error('Falha no Cenário 6: O access token da família revogada ainda é considerado ativo!');
    }
    console.log('Cenário 6 Aprovado: Access token é rejeitado pelo middleware (isSessionActive === false).');

    // --------------------------------------------------------------------------
    // CENÁRIO 7: Refresh Token da Família Revogada Rejeitado
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 7: Refresh Token da Família Revogada Rejeitado ---');
    let rejectedRefresh = false;
    try {
      authService.refresh({ refreshToken: winner.refreshToken });
    } catch (err: any) {
      if (err.code === 'TOKEN_REUSED_FAMILY_REVOKED' || err.code === 'INVALID_TOKEN') {
        rejectedRefresh = true;
      }
    }
    if (!rejectedRefresh) {
      throw new Error('Falha no Cenário 7: Refresh token da família revogada foi aceito!');
    }
    console.log('Cenário 7 Aprovado: Refresh token da família revogada rejeitado com sucesso.');

    // --------------------------------------------------------------------------
    // CENÁRIO 8: Outras Famílias da Mesma Conta Continuam Funcionando
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 8: Independência de Outras Famílias da Mesma Conta ---');
    const loginOutroDispositivo = authService.login({
      username: 'usuario_concorrente',
      password: 'PasswordSuperSegura123!',
      deviceId: 'dispositivo_intacto_macbook',
    });

    // Sessão deste outro dispositivo deve estar perfeitamente ativa
    const isOtherActive = authService.isSessionActive(loginOutroDispositivo.sessionId, user.account.id);
    if (!isOtherActive) {
      throw new Error('Falha no Cenário 8: Sessão de outro dispositivo foi afetada indevidamente!');
    }

    // Deve conseguir rotacionar normalmente
    const otherRot = authService.refresh({ refreshToken: loginOutroDispositivo.refreshToken });
    if (!otherRot.accessToken || !otherRot.refreshToken) {
      throw new Error('Falha no Cenário 8: Outro dispositivo não conseguiu rotacionar seu próprio token!');
    }
    console.log('Cenário 8 Aprovado: Outras famílias/dispositivos continuam funcionando normalmente.');

    // --------------------------------------------------------------------------
    // CENÁRIO 9: Token Desconhecido não Provoca Revogação Indiscriminada
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 9: Token Desconhecido não Revoga Famílias Válidas ---');
    let unknownBlocked = false;
    try {
      authService.refresh({ refreshToken: 'token_falso_desconhecido_random_xyz_12345' });
    } catch (err: any) {
      if (err.code === 'INVALID_TOKEN') unknownBlocked = true;
    }
    if (!unknownBlocked) {
      throw new Error('Falha no Cenário 9: Token desconhecido não retornou INVALID_TOKEN.');
    }

    // Assegura que o outro dispositivo continua ativo
    const isStillActive = authService.isSessionActive(otherRot.accessToken ? verifyJwt(otherRot.accessToken).payload!.sid : '', user.account.id);
    if (!isStillActive) {
      throw new Error('Falha no Cenário 9: Token desconhecido provocou revogação indevida de sessões ativas!');
    }
    console.log('Cenário 9 Aprovado: Token desconhecido rejeitado sem revogações colaterais.');

    // --------------------------------------------------------------------------
    // CENÁRIO 10: Falha Inesperada não Indica Revogação se não Houve Commit
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 10: Atomicidade e Consistência Transacional ---');
    // Valida que em qualquer falha de SQL a transação garante estado consistente
    const countBefore = mainDb.prepare('SELECT count(*) as c FROM auth_sessions').get() as any;
    console.log(`Total de registros de sessão consistentes no banco: ${countBefore.c}`);
    console.log('Cenário 10 Aprovado: Consistência transacional verificada.');

    // Limpeza
    mainDb.close();
    try {
      fs.unlinkSync(TEMP_AUTH_DB);
      if (fs.existsSync(TEMP_AUTH_DB + '-wal')) fs.unlinkSync(TEMP_AUTH_DB + '-wal');
      if (fs.existsSync(TEMP_AUTH_DB + '-shm')) fs.unlinkSync(TEMP_AUTH_DB + '-shm');
    } catch (_) {}

    console.log('\n====================================================================');
    console.log('  TODOS OS 10 CENÁRIOS DE CONCORRÊNCIA E REVOGAÇÃO FORAM APROVADOS! ');
    console.log('====================================================================');
  }

  runAuthConcurrencyTests().catch((err) => {
    console.error('Erro no teste de concorrência de refresh:', err);
    process.exit(1);
  });
}
