import { config } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

// Validação estrita da versão do Node.js (Exige Node.js 24)
const currentMajor = parseInt(process.versions.node.split('.')[0] || '0', 10);
if (currentMajor < 24) {
  console.error(
    `\n[Runtime Incompatível] Você está executando no Node.js ${process.version}.\n` +
    `O Doses Backend requer estritamente Node.js 24 (LTS).\n` +
    `Para alternar para o Node 24, execute no terminal:\n` +
    `  export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" && nvm use 24\n`
  );
  process.exit(1);
}

// Carrega o arquivo .env se existir
config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('localhost'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),
  DATABASE_FILE: z.string().default('./data/doses.db'),

  JWT_SECRET: z.string().min(32).default('doses_local_development_jwt_secret_min_32_characters_long_12345'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(30),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:suporte-dev@dosesapp.com.br'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuração inválida de variáveis de ambiente:');
  console.error(parsed.error.format());
  process.exit(1);
}

// Validação imediata do fuso horário IANA configurado
try {
  new Intl.DateTimeFormat(undefined, { timeZone: parsed.data.APP_TIMEZONE });
} catch {
  console.error(
    `[Configuração Inválida] APP_TIMEZONE="${parsed.data.APP_TIMEZONE}" não é um identificador de fuso horário IANA válido.`
  );
  process.exit(1);
}

export const env = parsed.data;
