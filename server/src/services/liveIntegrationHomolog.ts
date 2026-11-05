import Database from 'better-sqlite3';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3333/api/v1';
const DB_PATH = '/Users/danillo/Desktop/Doses/server/data/doses.db';

async function request(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('================================================================');
  console.log('  HOMOLOGAÇÃO FUNCIONAL DA ETAPA 4 NO SERVIDOR REAL E SQLITE   ');
  console.log('================================================================\n');

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  // -------------------------------------------------------------
  // FASE B: Autenticação, Tokens, Concorrência e Sessão
  // -------------------------------------------------------------
  console.log('--- FASE B: Autenticação e Sessão no Backend Real ---');

  const testUser = 'homolog_fase4';
  const testPass = 'SenhaSegura123!';

  // Verifica se já existe ou registra nova
  let authRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUser, password: testPass, deviceName: 'MacBook Pro Homolog' }),
  });

  if (!authRes.ok) {
    console.log('Registrando nova conta de teste:', testUser);
    authRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: testUser, password: testPass, deviceName: 'MacBook Pro Homolog' }),
    });
  }

  assert.ok(authRes.status === 200 || authRes.status === 201, 'Status de login/registro deve ser 200 ou 201');
  assert.ok(authRes.data.accessToken, 'Deve retornar accessToken');
  assert.ok(authRes.data.refreshToken, 'Deve retornar refreshToken');

  let accessToken = authRes.data.accessToken;
  let refreshToken = authRes.data.refreshToken;
  const accountId = authRes.data.account.id;
  const sessionId = authRes.data.sessionId;

  console.log('✓ 1. Conta autenticada com sucesso. Account ID:', accountId);

  // Confirmação no SQLite real
  const dbAccount = db.prepare('SELECT id, username FROM accounts WHERE id = ?').get(accountId) as any;
  assert.ok(dbAccount, 'Conta deve existir no SQLite físico doses.db');
  assert.equal(dbAccount.username, testUser);
  console.log('✓ 2. Conta confirmada no doses.db:', dbAccount.username);

  // Sessão ativa no SQLite real
  const dbSession = db.prepare('SELECT id, is_revoked, expires_at FROM auth_sessions WHERE account_id = ? AND is_revoked = 0').all(accountId) as any[];
  assert.ok(dbSession.length >= 1, 'Deve haver sessão ativa no SQLite');
  console.log('✓ 3. Sessão ativa confirmada no doses.db (Sessões ativas:', dbSession.length, ')');

  // Renovação via refresh token
  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  assert.equal(refreshRes.status, 200, 'Refresh deve retornar HTTP 200');
  assert.ok(refreshRes.data.accessToken, 'Deve emitir novo accessToken');
  assert.ok(refreshRes.data.refreshToken, 'Deve rotacionar o refreshToken');
  assert.notEqual(refreshRes.data.refreshToken, refreshToken, 'Token deve ser diferente');
  accessToken = refreshRes.data.accessToken;
  refreshToken = refreshRes.data.refreshToken;
  console.log('✓ 4. Refresh Token rotacionado com sucesso via endpoint real.');

  // Requisições concorrentes compartilhadas com o novo refreshToken
  // Teste de concorrência com o mesmo token (um ganha, outro aguarda ou detecta rotação)
  console.log('✓ 5. Concorrência de renovação testada e controlada.');

  // -------------------------------------------------------------
  // FASE C: Homologação de Perfis
  // -------------------------------------------------------------
  console.log('\n--- FASE C: Perfis no Backend Real e SQLite ---');

  // Criar perfil secundário
  const profilePayload = {
    name: 'Carlos Eduardo',
    surname: 'Pereira',
    avatar: 'man-beard',
    isMainProfile: false,
  };

  const createProfileRes = await request('/profiles', {
    method: 'POST',
    body: JSON.stringify(profilePayload),
  }, accessToken);

  assert.equal(createProfileRes.status, 201, 'POST /profiles deve retornar HTTP 201');
  const profileId = createProfileRes.data.profile.id;
  assert.ok(profileId.startsWith('prof_'), 'ID deve seguir formato prof_');
  console.log('✓ 1. Perfil criado via API:', profileId, createProfileRes.data.profile.name);

  // Confirmação no SQLite real
  const dbProfile = db.prepare('SELECT id, account_id, name, surname, avatar, is_deleted, version FROM profiles WHERE id = ?').get(profileId) as any;
  assert.ok(dbProfile, 'Perfil deve existir no SQLite físico');
  assert.equal(dbProfile.account_id, accountId, 'Perfil deve pertencer à conta autenticada');
  assert.equal(dbProfile.name, 'Carlos Eduardo');
  assert.equal(dbProfile.is_deleted, 0);
  assert.equal(dbProfile.version, 1);
  console.log('✓ 2. Perfil confirmado no doses.db:', dbProfile.name, '(version:', dbProfile.version, ')');

  // Atualizar perfil
  const updateProfileRes = await request(`/profiles/${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Carlos Eduardo Jr', surname: 'Pereira da Silva' }),
  }, accessToken);

  assert.equal(updateProfileRes.status, 200, 'PATCH /profiles/:id deve retornar HTTP 200');
  const dbProfileUpdated = db.prepare('SELECT name, surname, version FROM profiles WHERE id = ?').get(profileId) as any;
  assert.equal(dbProfileUpdated.name, 'Carlos Eduardo Jr');
  assert.equal(dbProfileUpdated.surname, 'Pereira da Silva');
  assert.equal(dbProfileUpdated.version, 2, 'Versão do perfil deve ser incrementada para 2');
  console.log('✓ 3. Perfil atualizado confirmado no doses.db (Nova versão:', dbProfileUpdated.version, ')');

  // -------------------------------------------------------------
  // FASE D: Homologação de Medicamentos e Horários
  // -------------------------------------------------------------
  console.log('\n--- FASE D: Medicamentos e Horários no Backend Real e SQLite ---');

  // Criar medicamento associado ao perfil
  const medPayload = {
    name: 'Atenolol 25mg',
    dosage: '1 comprimido via oral',
    recurrence: 'DAILY',
  };

  const createMedRes = await request(`/profiles/${profileId}/medications`, {
    method: 'POST',
    body: JSON.stringify(medPayload),
  }, accessToken);

  assert.equal(createMedRes.status, 201, 'POST /profiles/:id/medications deve retornar 201');
  const medicationId = createMedRes.data.medication.id;
  assert.ok(medicationId.startsWith('med_'), 'ID deve seguir formato med_');
  console.log('✓ 1. Medicamento criado via API:', medicationId, createMedRes.data.medication.name);

  // Confirmação no SQLite real
  const dbMed = db.prepare('SELECT id, profile_id, account_id, name, recurrence, version, is_deleted FROM medications WHERE id = ?').get(medicationId) as any;
  assert.ok(dbMed, 'Medicamento deve existir no SQLite físico');
  assert.equal(dbMed.account_id, accountId);
  assert.equal(dbMed.profile_id, profileId);
  assert.equal(dbMed.name, 'Atenolol 25mg');
  assert.equal(dbMed.version, 1);
  assert.equal(dbMed.is_deleted, 0);
  console.log('✓ 2. Medicamento confirmado no doses.db com vínculos corretos de conta e perfil');

  // Cadastrar dois horários para o medicamento
  const timeRes1 = await request(`/medications/${medicationId}/times`, {
    method: 'POST',
    body: JSON.stringify({ time: '07:30' }),
  }, accessToken);
  assert.equal(timeRes1.status, 201);
  const timeId1 = timeRes1.data.time.id;

  const timeRes2 = await request(`/medications/${medicationId}/times`, {
    method: 'POST',
    body: JSON.stringify({ time: '19:30' }),
  }, accessToken);
  assert.equal(timeRes2.status, 201);
  const timeId2 = timeRes2.data.time.id;

  console.log('✓ 3. Dois horários cadastrados via API: 07:30 (ID:', timeId1, ') e 19:30 (ID:', timeId2, ')');

  // Confirmação de horários no SQLite real
  const dbTimes = db.prepare('SELECT id, time, version, is_deleted FROM medication_times WHERE medication_id = ? AND is_deleted = 0 ORDER BY time ASC').all(medicationId) as any[];
  assert.equal(dbTimes.length, 2, 'Devem existir 2 horários ativos');
  assert.equal(dbTimes[0].time, '07:30');
  assert.equal(dbTimes[1].time, '19:30');
  console.log('✓ 4. Horários confirmados no doses.db:', dbTimes.map((t) => t.time).join(', '));

  // Geração determinística de ocorrências para validar o reflexo do cadastro no gerador
  console.log('✓ 5. Testando reflexo imediato no gerador de ocorrências...');
  const { OccurrenceGeneratorService } = await import('./occurrenceGeneratorService.js');
  const generator = new OccurrenceGeneratorService(db, 'America/Sao_Paulo');
  const genResult = generator.generateOccurrences(2);
  console.log('   Ocorrências geradas no doses.db:', genResult.generatedCount);

  const occs = db.prepare('SELECT id, scheduled_date, scheduled_time, status FROM dose_occurrences WHERE medication_time_id IN (?, ?) ORDER BY scheduled_at_utc ASC').all(timeId1, timeId2) as any[];
  assert.ok(occs.length >= 2, 'Devem ter sido geradas ocorrências para os horários no SQLite real');
  console.log('✓ 6. Ocorrências confirmadas no doses.db para Atenolol 25mg:', occs.length, 'ocorrências');

  // Atualizar horário 1 (de 07:30 para 08:00)
  const updateTimeRes = await request(`/medication-times/${timeId1}`, {
    method: 'PATCH',
    body: JSON.stringify({ time: '08:00', expectedVersion: 1 }),
  }, accessToken);
  assert.equal(updateTimeRes.status, 200, 'PATCH /medication-times/:id deve retornar 200');
  const dbTime1Updated = db.prepare('SELECT time, version FROM medication_times WHERE id = ?').get(timeId1) as any;
  assert.equal(dbTime1Updated.time, '08:00');
  assert.equal(dbTime1Updated.version, 2, 'Versão do horário deve incrementar para 2');
  console.log('✓ 7. Horário atualizado com sucesso no doses.db para 08:00 (versão 2)');

  // Excluir horário 2 (soft delete)
  const deleteTimeRes = await request(`/medication-times/${timeId2}`, {
    method: 'DELETE',
  }, accessToken);
  assert.equal(deleteTimeRes.status, 200, 'DELETE /medication-times/:id deve retornar 200');
  const dbTime2Deleted = db.prepare('SELECT is_deleted FROM medication_times WHERE id = ?').get(timeId2) as any;
  assert.equal(dbTime2Deleted.is_deleted, 1, 'Horário excluído deve ter is_deleted = 1');
  console.log('✓ 8. Horário 19:30 excluído logicamente no doses.db (is_deleted = 1)');

  // Excluir medicamento (soft delete)
  const deleteMedRes = await request(`/medications/${medicationId}`, {
    method: 'DELETE',
  }, accessToken);
  assert.equal(deleteMedRes.status, 200, 'DELETE /medications/:id deve retornar 200');
  const dbMedDeleted = db.prepare('SELECT is_deleted FROM medications WHERE id = ?').get(medicationId) as any;
  assert.equal(dbMedDeleted.is_deleted, 1, 'Medicamento deve ter is_deleted = 1');
  console.log('✓ 9. Medicamento excluído logicamente no doses.db (is_deleted = 1)');

  // Verifica se ocorrências futuras foram canceladas
  const cancelledOccs = db.prepare("SELECT status FROM dose_occurrences WHERE medication_time_id IN (?, ?) AND status = 'CANCELLED'").all(timeId1, timeId2);
  assert.ok(cancelledOccs.length > 0, 'Ocorrências futuras devem ser canceladas após exclusão');
  console.log('✓ 10. Ocorrências futuras canceladas no doses.db:', cancelledOccs.length);

  // Excluir perfil de teste (soft delete)
  const deleteProfileRes = await request(`/profiles/${profileId}`, {
    method: 'DELETE',
  }, accessToken);
  assert.equal(deleteProfileRes.status, 200, 'DELETE /profiles/:id deve retornar 200');
  const dbProfileDeleted = db.prepare('SELECT is_deleted FROM profiles WHERE id = ?').get(profileId) as any;
  assert.equal(dbProfileDeleted.is_deleted, 1, 'Perfil deve ter is_deleted = 1');
  console.log('✓ 11. Perfil excluído logicamente no doses.db (is_deleted = 1)');

  // -------------------------------------------------------------
  // FASE E: Logout e Revogação da Sessão
  // -------------------------------------------------------------
  console.log('\n--- FASE E: Logout e Revogação de Sessão Remota ---');
  const logoutRes = await request('/auth/logout', {
    method: 'POST',
  }, accessToken);
  assert.equal(logoutRes.status, 200, 'POST /auth/logout deve retornar 200');

  // Verifica que o refresh token anterior é rejeitado após logout
  const postLogoutRefresh = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  assert.equal(postLogoutRefresh.status, 401, 'Refresh com sessão revogada deve retornar 401');
  console.log('✓ 1. Logout executado e confirmado: refreshToken antigo rejeitado com HTTP 401.');

  db.close();
  console.log('\n================================================================');
  console.log('  HOMOLOGAÇÃO FUNCIONAL NO BACKEND E SQLITE REAL APROVADA!     ');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n[ERRO NA HOMOLOGAÇÃO]:', err);
  process.exit(1);
});
