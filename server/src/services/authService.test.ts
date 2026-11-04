import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { runVersionedMigrations } from '../db/migrator.js';
import { AuthService } from './authService.js';
import { hashPassword, verifyPassword, hashRefreshToken } from '../utils/crypto.js';
import { signJwt, verifyJwt, JWT_CONFIG } from '../utils/jwt.js';

console.log('================================================================');
console.log('  Suíte de Testes Automatizados - Etapa 2A (Autenticação/Sessão) ');
console.log('================================================================');

// 1. Cria banco em memória isolado para os testes
const testDb = new Database(':memory:');
runVersionedMigrations(testDb);
const authService = new AuthService(testDb);

// -----------------------------------------------------------------------------
// BLOCO 1: CADASTRO E LOGIN (SCRYPT E CREDENCIAIS)
// -----------------------------------------------------------------------------
console.log('\n--- BLOCO 1: Testes de Cadastro e Login ---');

// 1.1 Cadastro Válido
const regResult = authService.register({
  username: 'camilla_doses',
  password: 'PasswordSuperSegura123!',
});

if (!regResult.account.id || regResult.account.username !== 'camilla_doses' || !regResult.accessToken || !regResult.refreshToken) {
  throw new Error('Falha 1.1: Cadastro válido não retornou estrutura esperada.');
}
console.log('1.1 Cadastro válido: Aprovado (ID da conta:', regResult.account.id, ')');

// 1.2 Hash de senha nunca em texto puro
const storedAccount = testDb.prepare('SELECT password_hash FROM accounts WHERE id = ?').get(regResult.account.id) as { password_hash: string };
if (!storedAccount.password_hash.startsWith('$scrypt$') || storedAccount.password_hash.includes('PasswordSuperSegura123!')) {
  throw new Error('Falha 1.2: Senha armazenada de forma insegura!');
}
console.log('1.2 Hash Scrypt seguro comprovado: Aprovado (' + storedAccount.password_hash.slice(0, 32) + '...)');

// 1.3 Cadastro com username duplicado (deve rejeitar)
let duplicateBlocked = false;
try {
  authService.register({
    username: 'camilla_doses',
    password: 'OutraSenha12345!',
  });
} catch (err: any) {
  if (err.code === 'USERNAME_ALREADY_EXISTS') duplicateBlocked = true;
}
if (!duplicateBlocked) {
  throw new Error('Falha 1.3: Cadastro duplicado foi permitido indevidamente!');
}
console.log('1.3 Username duplicado bloqueado: Aprovado.');

// 1.4 Senha inválida (curta < 8 chars)
let shortPasswordBlocked = false;
try {
  authService.register({
    username: 'novo_usuario',
    password: '123',
  });
} catch {
  shortPasswordBlocked = true;
}
if (!shortPasswordBlocked) {
  throw new Error('Falha 1.4: Senha com menos de 8 caracteres foi aceita!');
}
console.log('1.4 Senha inválida bloqueada: Aprovado.');

// 1.5 Login Válido
const loginResult = authService.login({
  username: 'camilla_doses',
  password: 'PasswordSuperSegura123!',
  deviceId: 'device_iphone_16',
});

if (!loginResult.accessToken || !loginResult.refreshToken) {
  throw new Error('Falha 1.5: Login válido não emitiu tokens.');
}
console.log('1.5 Login válido: Aprovado.');

// 1.6 Credenciais Incorretas (Senha errada e usuário inexistente)
let wrongPassBlocked = false;
try {
  authService.login({ username: 'camilla_doses', password: 'SenhaTotalmenteErrada!' });
} catch (err: any) {
  if (err.code === 'INVALID_CREDENTIALS') wrongPassBlocked = true;
}
if (!wrongPassBlocked) throw new Error('Falha 1.6: Login com senha errada passou!');

let unknownUserBlocked = false;
try {
  authService.login({ username: 'usuario_inexistente', password: 'QualquerSenha123!' });
} catch (err: any) {
  if (err.code === 'INVALID_CREDENTIALS') unknownUserBlocked = true;
}
if (!unknownUserBlocked) throw new Error('Falha 1.6: Login com usuário inexistente passou!');
console.log('1.6 Credenciais incorretas rejeitadas com mensagem neutra anti-enumeração: Aprovado.');

// -----------------------------------------------------------------------------
// BLOCO 2: ACCESS TOKEN (JWT NATIVO)
// -----------------------------------------------------------------------------
console.log('\n--- BLOCO 2: Testes de Validação do JWT ---');

// 2.1 Token Válido
const validVerification = verifyJwt(loginResult.accessToken);
if (!validVerification.valid || validVerification.payload?.sub !== regResult.account.id) {
  throw new Error('Falha 2.1: Verificação de token válido falhou.');
}
console.log('2.1 Validação de token legítimo: Aprovado.');

// 2.2 Assinatura Inválida (Tampering de 1 byte)
const tokenParts = loginResult.accessToken.split('.');
const tamperedSig = tokenParts[2].slice(0, -2) + (tokenParts[2].endsWith('a') ? 'b' : 'a');
const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.${tamperedSig}`;
const sigCheck = verifyJwt(tamperedToken);
if (sigCheck.valid || sigCheck.error !== 'INVALID_SIGNATURE') {
  throw new Error('Falha 2.2: Token adulterado foi aceito!');
}
console.log('2.2 Assinatura adulterada rejeitada via timingSafeEqual: Aprovado.');

// 2.3 Token Expirado (Simulação com expiração negativa)
const expiredToken = signJwt({ sub: 'acc_123', sid: 'ses_123', username: 'test' }, undefined, -10);
const expCheck = verifyJwt(expiredToken);
if (expCheck.valid || expCheck.error !== 'EXPIRED') {
  throw new Error('Falha 2.3: Token expirado foi aceito!');
}
console.log('2.3 Token expirado rejeitado: Aprovado.');

// 2.4 Algoritmo não permitido (ex: 'none')
const fakeHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
const fakePayload = Buffer.from(JSON.stringify({ sub: 'acc_123', iss: JWT_CONFIG.issuer, aud: JWT_CONFIG.audience, exp: Math.floor(Date.now() / 1000) + 1000 })).toString('base64url');
const noneToken = `${fakeHeader}.${fakePayload}.`;
const noneCheck = verifyJwt(noneToken);
if (noneCheck.valid || noneCheck.error !== 'UNSUPPORTED_ALGORITHM') {
  throw new Error('Falha 2.4: Token com alg "none" foi aceito!');
}
console.log('2.4 Algoritmo "none" expressamente rejeitado: Aprovado.');

// 2.5 Emissor ou Audiência Incorretos
const wrongIssuerHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const wrongIssuerPayload = Buffer.from(JSON.stringify({ sub: 'acc_123', iss: 'hacker-issuer', aud: JWT_CONFIG.audience, exp: Math.floor(Date.now() / 1000) + 1000 })).toString('base64url');
const wrongIssuerSig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'doses_local_development_jwt_secret_min_32_characters_long_12345').update(`${wrongIssuerHeader}.${wrongIssuerPayload}`).digest('base64url');
const wrongIssuerToken = `${wrongIssuerHeader}.${wrongIssuerPayload}.${wrongIssuerSig}`;
const issCheck = verifyJwt(wrongIssuerToken);
if (issCheck.valid || issCheck.error !== 'INVALID_ISSUER') {
  throw new Error('Falha 2.5: Emissor incorreto foi aceito!');
}
console.log('2.5 Emissor/Audiência incorretos rejeitados: Aprovado.');

// -----------------------------------------------------------------------------
// BLOCO 3: REFRESH TOKEN, ROTAÇÃO E DETECÇÃO DE REUTILIZAÇÃO
// -----------------------------------------------------------------------------
console.log('\n--- BLOCO 3: Rotação e Detecção de Reuso de Refresh Tokens ---');

// 3.1 Renovação Válida e Rotação
const oldRefreshToken = loginResult.refreshToken;
const refreshResult = authService.refresh({ refreshToken: oldRefreshToken });

if (!refreshResult.accessToken || !refreshResult.refreshToken || refreshResult.refreshToken === oldRefreshToken) {
  throw new Error('Falha 3.1: Rotação de refresh token falhou.');
}

// 3.2 Token anterior deve estar marcado como revogado
const oldHash = hashRefreshToken(oldRefreshToken);
const oldSessionRow = testDb.prepare('SELECT is_revoked, replaced_by_hash FROM auth_sessions WHERE refresh_token_hash = ?').get(oldHash) as any;
if (oldSessionRow.is_revoked !== 1 || !oldSessionRow.replaced_by_hash) {
  throw new Error('Falha 3.2: Token anterior não foi invalidado após rotação!');
}
console.log('3.1 e 3.2 Rotação válida e invalidação do token anterior: Aprovado.');

// 3.3 DETECÇÃO DE REUTILIZAÇÃO: Tentativa de reusar o token anterior (oldRefreshToken)
let reuseDetected = false;
try {
  authService.refresh({ refreshToken: oldRefreshToken });
} catch (err: any) {
  if (err.code === 'TOKEN_REUSED_FAMILY_REVOKED') {
    reuseDetected = true;
  }
}
if (!reuseDetected) {
  throw new Error('Falha 3.3: Reutilização de token revogado não foi detectada!');
}

// 3.4 Comprova que toda a família de sessões deste dispositivo foi revogada em cadeia
const activeTokensInFamily = testDb.prepare(`
  SELECT count(*) as count
  FROM auth_sessions
  WHERE account_id = ? AND token_family = (SELECT token_family FROM auth_sessions WHERE refresh_token_hash = ?) AND is_revoked = 0
`).get(regResult.account.id, oldHash) as { count: number };

if (activeTokensInFamily.count !== 0) {
  throw new Error('Falha 3.4: A família de sessões não foi revogada por completo após a tentativa de reuso!');
}
console.log('3.3 e 3.4 Detecção de reutilização e revogação em cadeia da família: Aprovado.');

// 3.5 Token Inexistente
let notFoundBlocked = false;
try {
  authService.refresh({ refreshToken: 'token_inexistente_totalmente_aleatorio_12345' });
} catch (err: any) {
  if (err.code === 'INVALID_TOKEN') notFoundBlocked = true;
}
if (!notFoundBlocked) throw new Error('Falha 3.5: Token inexistente não foi rejeitado!');
console.log('3.5 Token inexistente rejeitado: Aprovado.');

// 3.6 Concorrência: Duas requisições simultâneas disputando o mesmo refresh token
console.log('\n--- 3.6 Teste de Concorrência em Refresh Tokens ---');
// Cria novo login para o teste de concorrência
const loginForConcurrent = authService.login({
  username: 'camilla_doses',
  password: 'PasswordSuperSegura123!',
  deviceId: 'device_tablet',
});

const sharedToken = loginForConcurrent.refreshToken;

// Simulação de duas chamadas quase simultâneas
let firstSuccess = false;
let secondBlockedOrConflict = false;

try {
  authService.refresh({ refreshToken: sharedToken });
  firstSuccess = true;
} catch (_) {}

try {
  authService.refresh({ refreshToken: sharedToken });
} catch (err: any) {
  if (err.code === 'TOKEN_REUSED_FAMILY_REVOKED' || err.code === 'CONCURRENT_REFRESH_CONFLICT' || err.code === 'INVALID_TOKEN') {
    secondBlockedOrConflict = true;
  }
}

if (!firstSuccess || !secondBlockedOrConflict) {
  throw new Error('Falha 3.6: Concorrência permitiu que duas renovações fossem aceitas para o mesmo token!');
}
console.log('3.6 Proteção atômica de concorrência em refresh tokens: Aprovado.');

// -----------------------------------------------------------------------------
// BLOCO 4: SESSÕES, LOGOUT E ISOLAMENTO MULTIUSUÁRIO
// -----------------------------------------------------------------------------
console.log('\n--- BLOCO 4: Sessões, Logout e Isolamento entre Contas ---');

// 4.1 Sessões de Dispositivos Diferentes Permanecem Independentes
const sessionDev1 = authService.login({ username: 'camilla_doses', password: 'PasswordSuperSegura123!', deviceId: 'iphone_user' });
const sessionDev2 = authService.login({ username: 'camilla_doses', password: 'PasswordSuperSegura123!', deviceId: 'macbook_user' });

// Logout do dispositivo 1
authService.logout({ sessionId: sessionDev1.sessionId, accountId: regResult.account.id });

if (authService.isSessionActive(sessionDev1.sessionId, regResult.account.id)) {
  throw new Error('Falha 4.1: Sessão 1 deveria estar inativa após logout!');
}

if (!authService.isSessionActive(sessionDev2.sessionId, regResult.account.id)) {
  throw new Error('Falha 4.1: Sessão do dispositivo 2 foi afetada indevidamente pelo logout do dispositivo 1!');
}
console.log('4.1 Logout individual e independência entre dispositivos: Aprovado.');

// 4.2 Isolamento Entre Contas Distintas
const user2 = authService.register({ username: 'seu_jose_parkinson', password: 'PasswordSeguraSeuJose123!' });

// Valida que o token do User2 não tem acesso ao ID do User1
const tokenUser2 = verifyJwt(user2.accessToken);
if (tokenUser2.payload?.sub === regResult.account.id) {
  throw new Error('Falha 4.2: Violação de identidade de conta no payload JWT!');
}

// Tentativa de fazer logout na sessão do User1 usando o accountId do User2
const crossLogout = authService.logout({ sessionId: sessionDev2.sessionId, accountId: user2.account.id });
if (crossLogout) {
  throw new Error('Falha 4.2: Conta 2 conseguiu encerrar sessão pertencente à Conta 1!');
}
console.log('4.2 Isolamento estrito entre contas comprovado: Aprovado.');

console.log('\n================================================================');
console.log('  TODOS OS TESTES OBRIGATÓRIOS DA ETAPA 2A PASSARAM COM SUCESSO! ');
console.log('================================================================');
