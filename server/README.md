# Doses Backend — Notificações Nativas Web Push (Etapa 1.1)

Este é o serviço de backend desacoplado do **Doses**, desenvolvido com **Node.js 24 LTS (v24.22.2)**, **TypeScript** e **SQLite**, responsável por:
1. Armazenamento relacional e controle de concorrência com **SQLite** (`better-sqlite3` em modo WAL).
2. Gerenciamento seguro de credenciais **Web Push (VAPID RFC 8292)**.
3. Sistema de **migrações versionadas com histórico transacional** (`schema_migrations`).
4. Modelo de dados com garantia de **idempotência física no banco de dados**, controle de versão e tombstones para sincronização offline-first.
5. Estrutura de agendamento resiliente com **reserva de lease atômica** e privacidade por padrão (`hide_medication_names = 1`).
6. Preparação para sessões de autenticação com suporte a rotação e detecção de reutilização (`idx_auth_sessions_family`).

---

## 1. Estrutura de Diretórios

```text
server/
├── data/                       # Arquivos do SQLite local (ignorado pelo Git)
│   └── doses.db                # Banco relacional com 9 tabelas (incluindo schema_migrations)
├── scripts/
│   └── generate-vapid.ts       # Script utilitário para gerar chaves VAPID locais
├── src/
│   ├── config/
│   │   ├── env.ts              # Validação de variáveis de ambiente com Zod e bloqueio de Node < 24
│   │   └── vapid.ts            # Configuração e utilitários da biblioteca web-push
│   ├── db/
│   │   ├── migrations/         # Migrações versionadas estruturadas
│   │   │   ├── 001_initial_schema.ts
│   │   │   └── 002_add_auth_sessions_family_index.ts
│   │   ├── connection.ts       # Conexão SQLite (WAL mode, foreign keys, busy timeout)
│   │   ├── migrator.ts         # Motor transacional de migrações versionadas
│   │   ├── migrate.ts          # CLI runner de migrações
│   │   ├── schema.ts           # Definição SQL completa consolidada
│   │   ├── testDb.ts           # Teste automatizado de validação de schema e VAPID
│   │   └── testConcurrency.ts  # Teste de concorrência real (Worker threads) e lease expirado
│   └── index.ts                # Ponto de entrada HTTP (health check e chave pública VAPID)
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
  * *Justificativa técnica:* O Node.js 26 (Current) falhou na compilação do addon nativo C++ do `better-sqlite3` devido à ausência do cabeçalho C++20 `<source_location>` nos headers do V8 com o compilador padrão do macOS. O Node.js 24 LTS compilou e executou com 100% de estabilidade.
  * O servidor possui bloqueio em tempo de inicialização caso executado em Node < 24.
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
| `npm run test:db` | Executa a bateria de testes de validação do banco e integridade física. |
| `npm run test:concurrency` | Executa teste real com Workers paralelos simultâneos e resgate de lease expirado. |

---

## 4. Endpoints Disponíveis

* `GET http://localhost:3333/api/v1/health`
  * Retorna o status de saúde do serviço, contagem de tabelas do SQLite (9 tabelas), fuso horário (`America/Sao_Paulo`) e status da configuração VAPID.
* `GET http://localhost:3333/api/v1/vapid-public-key`
  * Fornece a chave pública VAPID para que navegadores ou o PWA possam criar a `PushSubscription`.
