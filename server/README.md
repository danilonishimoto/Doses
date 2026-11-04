# Doses Backend — Notificações Nativas Web Push (Etapa 2A)

Este é o serviço de backend desacoplado do **Doses**, desenvolvido com **Node.js 24 LTS (v24.22.2)**, **TypeScript** e **SQLite**, responsável por:
1. Armazenamento relacional e controle de concorrência com **SQLite** (`better-sqlite3` em modo WAL).
2. Gerenciamento seguro de credenciais **Web Push (VAPID RFC 8292)**.
3. Sistema de **migrações versionadas com histórico transacional** (`schema_migrations`).
4. Modelo de dados com garantia de **idempotência física no banco de dados**, controle de versão e tombstones para sincronização offline-first.
5. Estrutura de agendamento resiliente com **reserva de lease atômica** e `lease_token` contra workers zumbis.
6. **Autenticação e Sessões (Etapa 2A):**
   - Hashing de senhas com `Scrypt` nativo e salt aleatório de 16 bytes.
   - Access tokens JWT (15 min) com validação estrita de algoritmo HS256, emissor (`iss`) e audiência (`aud`).
   - Refresh tokens opacos (256 bits) com rotação atômica, detecção de reutilização e revogação em cadeia da família de sessões.
   - Rate limiting em memória contra força bruta.

---

## 1. Estrutura de Diretórios

```text
server/
├── data/                       # Arquivos do SQLite local (ignorado pelo Git)
│   └── doses.db                # Banco relacional com 9 tabelas
├── scripts/
│   └── generate-vapid.ts       # Script utilitário para gerar chaves VAPID locais
├── src/
│   ├── api/
│   │   └── authRoutes.ts       # Endpoints REST de autenticação com validação Zod
│   ├── config/
│   │   ├── env.ts              # Validação de variáveis de ambiente com Zod e bloqueio de Node < 24
│   │   └── vapid.ts            # Configuração e utilitários da biblioteca web-push
│   ├── db/
│   │   ├── migrations/         # Migrações versionadas estruturadas
│   │   │   ├── 001_initial_schema.ts
│   │   │   ├── 002_add_auth_sessions_family_index.ts
│   │   │   ├── 003_add_lease_token_to_occurrences.ts
│   │   │   └── 004_enhance_auth_sessions.ts
│   │   ├── connection.ts       # Conexão SQLite (WAL mode, foreign keys, busy timeout)
│   │   ├── migrator.ts         # Motor transacional de migrações versionadas
│   │   ├── migrate.ts          # CLI runner de migrações
│   │   ├── schema.ts           # Definição SQL completa consolidada
│   │   ├── testDb.ts           # Teste automatizado de validação de schema e VAPID
│   │   └── testConcurrency.ts  # Teste de concorrência com Workers paralelos, lease_token e retries
│   ├── middlewares/
│   │   ├── authMiddleware.ts   # Middleware de validação de JWT Bearer e checagem de sessão ativa
│   │   └── rateLimiter.ts      # Rate limiter em memória por IP e username
│   ├── services/
│   │   ├── authService.ts      # Lógica de negócio de autenticação, rotação e reuso
│   │   └── authService.test.ts # Suíte completa de testes automatizados da Etapa 2A
│   ├── utils/
│   │   ├── crypto.ts           # Scrypt nativo, timingSafeEqual e refresh tokens opacos
│   │   └── jwt.ts              # Emissão e validação estrita de JWT nativo (HS256, iss, aud)
│   └── index.ts                # Ponto de entrada HTTP
├── .env.example                # Modelo de variáveis de ambiente sem segredos
├── .gitignore                  # Proteção de credenciais, bancos locais e logs
├── .nvmrc                      # Versão fixada: 24.22.2
├── package.json
└── tsconfig.json
```

---

## 2. Requisitos e Runtime

### Pré-requisitos
* **Node.js:** Versão 24 LTS (`v24.22.2`).
* **NPM:** 11+.

### Configuração Inicial
1. Certifique-se de estar no Node 24:
   ```bash
   nvm use 24
   ```
2. Copie o arquivo de exemplo para `.env`:
   ```bash
   cp .env.example .env
   ```
3. Gere um par de chaves VAPID exclusivas para desenvolvimento local:
   ```bash
   npm run generate-vapid
   ```

---

## 3. Comandos Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor em modo de desenvolvimento com hot-reload (`tsx watch`). |
| `npm run build` | Compila o TypeScript para a pasta `dist/`. |
| `npm run start` | Executa o código compilado em produção. |
| `npm run migrate` | Aplica migrações versionadas pendentes com integridade transacional. |
| `npm run generate-vapid` | Gera um novo par de chaves VAPID criptograficamente seguras para dev local. |
| `npm run test:db` | Executa teste de validação do schema e integridade física. |
| `npm run test:concurrency` | Executa teste de lease com `lease_token`, bloqueio zumbi e teto de retries. |
| `npm run test:auth` | Executa suíte completa de testes de autenticação (Scrypt, JWT, rotação, reuso, logout). |

---

## 4. Endpoints de Autenticação (Etapa 2A)

### `POST /api/v1/auth/register`
* **Body:**
  ```json
  {
    "username": "camilla_doses",
    "password": "PasswordSuperSegura123!"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "4a7b9c...",
    "account": {
      "id": "acc_07d760f2...",
      "username": "camilla_doses",
      "createdAt": "2026-11-04T08:48:42.000Z"
    },
    "sessionId": "ses_81ab7e..."
  }
  ```

### `POST /api/v1/auth/login`
* **Body:**
  ```json
  {
    "username": "camilla_doses",
    "password": "PasswordSuperSegura123!",
    "deviceId": "iphone_16"
  }
  ```
* **Response (200 OK):** Retorna novo par de tokens (`accessToken` e `refreshToken`).

### `POST /api/v1/auth/refresh`
* **Body:**
  ```json
  {
    "refreshToken": "4a7b9c..."
  }
  ```
* **Response (200 OK):** Retorna novo `accessToken` e o novo `refreshToken` rotacionado.
* **Detecção de Reuso:** Se o token antigo for reenviado, retorna `401 Unauthorized` com código `TOKEN_REUSED` e revoga todas as sessões da família daquele dispositivo.

### `POST /api/v1/auth/logout`
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response (200 OK):**
  ```json
  {
    "message": "Sessão encerrada com sucesso."
  }
  ```

### `GET /api/v1/auth/me`
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response (200 OK):**
  ```json
  {
    "account": {
      "id": "acc_07d760f2...",
      "username": "camilla_doses",
      "createdAt": "2026-11-04T08:48:42.000Z"
    },
    "sessionId": "ses_81ab7e..."
  }
  ```
