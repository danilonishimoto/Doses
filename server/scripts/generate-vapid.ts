import fs from 'node:fs';
import path from 'node:path';
import { generateLocalVapidKeys } from '../src/config/vapid.js';

function run() {
  console.log('--- Gerador de Chaves VAPID para Desenvolvimento Local (Doses) ---');
  const keys = generateLocalVapidKeys();

  console.log('\nChaves VAPID geradas com sucesso:\n');
  console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}\n`);

  const envPath = path.resolve(process.cwd(), '.env');
  const envExamplePath = path.resolve(process.cwd(), '.env.example');

  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    let content = fs.readFileSync(envExamplePath, 'utf-8');
    content = content.replace(
      'VAPID_PUBLIC_KEY=example_base64_encoded_vapid_public_key_to_be_generated',
      `VAPID_PUBLIC_KEY=${keys.publicKey}`
    );
    content = content.replace(
      'VAPID_PRIVATE_KEY=example_base64_encoded_vapid_private_key_to_be_generated',
      `VAPID_PRIVATE_KEY=${keys.privateKey}`
    );

    fs.writeFileSync(envPath, content, 'utf-8');
    console.log('Arquivo .env criado automaticamente com as novas chaves VAPID.');
  } else if (fs.existsSync(envPath)) {
    console.log('O arquivo .env já existe. Para atualizar suas chaves, copie as linhas acima para o seu .env.');
  }
}

run();
