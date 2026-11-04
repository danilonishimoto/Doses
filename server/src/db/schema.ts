export const CREATE_TABLES_SQL = `
-- 1. Contas de Usuário
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Perfis de Pacientes (Titular, Cônjuge, Idoso, Pet)
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    surname TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL,
    is_main_profile INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE (id, account_id)
);

-- 3. Medicamentos
CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL DEFAULT '',
    recurrence TEXT NOT NULL DEFAULT 'DAILY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id, account_id) REFERENCES profiles(id, account_id) ON DELETE CASCADE,
    UNIQUE (id, profile_id, account_id)
);

-- 4. Horários dos Medicamentos
CREATE TABLE IF NOT EXISTS medication_times (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    time TEXT NOT NULL, -- Formato 'HH:mm'
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (medication_id, profile_id, account_id) REFERENCES medications(id, profile_id, account_id) ON DELETE CASCADE,
    UNIQUE (id, profile_id, account_id)
);

-- 5. Inscrições de Notificações Web Push (Múltiplos Dispositivos)
-- NOTA DE PRIVACIDADE: hide_medication_names possui DEFAULT 1 (ocultar por padrão)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    device_name TEXT NOT NULL DEFAULT '',
    hide_medication_names INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- 6. Sessões e Rotação de Refresh Tokens (Com Detecção de Reutilização)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    refresh_token_hash TEXT UNIQUE NOT NULL,
    token_family TEXT NOT NULL, -- Para invalidação em cadeia caso haja reuso suspeito
    is_revoked INTEGER NOT NULL DEFAULT 0,
    revoked_at TEXT,
    replaced_by_hash TEXT,
    expires_at INTEGER NOT NULL, -- Unix epoch em segundos
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- 7. Ocorrências Programadas de Lembretes (Idempotência e Agendamento Resiliente)
CREATE TABLE IF NOT EXISTS dose_occurrences (
    id TEXT PRIMARY KEY, -- Hash SHA-256 determinístico
    medication_time_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,       -- 'YYYY-MM-DD' na data civil local
    scheduled_time TEXT NOT NULL,       -- 'HH:mm' no horário local
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    scheduled_at_utc INTEGER NOT NULL,  -- Instante UTC exato em milissegundos
    schedule_version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK(status IN (
        'SCHEDULED',      -- Aguardando chegada do horário programado
        'DISPATCHING',    -- Em processamento com lease ativo
        'DISPATCHED',     -- Aceito pelo Push Service externo (201 Created)
        'DISPATCH_FAILED',-- Falha transitória (elegível a nova tentativa com backoff)
        'CONFIRMED',      -- Usuário confirmou que tomou a dose
        'MISSED',         -- Não confirmada / janela de tolerância expirada
        'CANCELLED'       -- Cancelada devido a alteração ou exclusão do horário
    )),
    lease_until INTEGER,                -- Timestamp UTC (ms) até quando o worker tem exclusividade
    lease_token TEXT,                   -- Token único (UUID) da aquisição atual para evitar split-brain
    dispatched_at TEXT,                 -- ISO timestamp do envio bem-sucedido ao Push Service
    confirmed_at TEXT,                  -- ISO timestamp da confirmação do usuário
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (medication_time_id, profile_id, account_id) REFERENCES medication_times(id, profile_id, account_id) ON DELETE RESTRICT,
    UNIQUE (id, profile_id, account_id)
);

-- 8. Confirmações de Doses Tomadas (Log Append-Only de Eventos Clínicos)
CREATE TABLE IF NOT EXISTS dose_confirmations (
    id TEXT PRIMARY KEY,
    occurrence_id TEXT UNIQUE NOT NULL,
    profile_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'TAKEN', -- 'TAKEN' ou 'SKIPPED'
    confirmed_at TEXT NOT NULL,           -- Timestamp registrado no momento da tomada
    source TEXT NOT NULL DEFAULT 'NOTIFICATION_ACTION', -- 'NOTIFICATION_ACTION' | 'APP_UI'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (occurrence_id, profile_id, account_id) REFERENCES dose_occurrences(id, profile_id, account_id) ON DELETE RESTRICT
);

-- ÍNDICES DE PERFORMANCE E INTEGRIDADE
CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrences_slot 
ON dose_occurrences(medication_time_id, scheduled_date, scheduled_time, schedule_version);

CREATE INDEX IF NOT EXISTS idx_occurrences_dispatch_search 
ON dose_occurrences(status, scheduled_at_utc, lease_until);

CREATE INDEX IF NOT EXISTS idx_subscriptions_account 
ON push_subscriptions(account_id, is_active);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_device 
ON auth_sessions(account_id, device_id, is_revoked);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_family 
ON auth_sessions(account_id, token_family, is_revoked);
`;
