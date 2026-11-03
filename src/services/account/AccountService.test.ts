import 'fake-indexeddb/auto';
import { db } from '../database/db';
import { AccountService } from './AccountService';
import { ProfileService } from '../profile/ProfileService';

async function runTests() {
  console.log('--- Iniciando Testes de Serviços e IndexedDB ---');

  // Limpa banco antes do teste
  await db.accounts.clear();
  await db.profiles.clear();

  // Teste 1: Criação de conta
  console.log('1. Testando criação de conta...');
  const account = await AccountService.createAccount('mariacosta', 'senha123');
  console.assert(account.username === 'mariacosta', 'Nome de usuário incorreto');
  console.assert(account.passwordHash.length > 20, 'Hash de senha inválido');
  console.assert(account.salt.length > 10, 'Salt ausente');

  // Teste 2: Prevenção de duplicidade de conta
  console.log('2. Testando tentativa de criar conta duplicada...');
  let duplicateError = false;
  try {
    await AccountService.createAccount('mariacosta', 'outrasenha');
  } catch (err) {
    duplicateError = true;
  }
  console.assert(duplicateError, 'Deveria ter impedido usuário duplicado');

  // Teste 3: Criação de perfil principal
  console.log('3. Testando criação de perfil principal...');
  const mainProfile = await ProfileService.createProfile({
    accountId: account.id,
    name: 'Maria',
    surname: 'Costa',
    age: 34,
    weight: 62.5,
    height: 165,
    avatar: 'young-woman',
    isMainProfile: true,
  });
  console.assert(mainProfile.isMainProfile === true, 'Deveria ser perfil principal');
  console.assert(mainProfile.name === 'Maria', 'Nome do perfil principal incorreto');

  // Teste 4: Impedir segundo perfil principal
  console.log('4. Testando restrição de apenas 1 perfil principal...');
  let secondMainError = false;
  try {
    await ProfileService.createProfile({
      accountId: account.id,
      name: 'Maria 2',
      surname: 'Costa',
      age: 35,
      weight: 63,
      height: 165,
      avatar: 'young-woman',
      isMainProfile: true,
    });
  } catch (err) {
    secondMainError = true;
  }
  console.assert(secondMainError, 'Deveria ter impedido segundo perfil principal');

  // Teste 5: Adicionar pessoa (perfil secundário)
  console.log('5. Testando adição de pessoa secundária...');
  const secondProfile = await ProfileService.createProfile({
    accountId: account.id,
    name: 'Artur',
    surname: 'Costa',
    age: 72,
    weight: 78,
    height: 170,
    avatar: 'senior-person',
    isMainProfile: false,
  });
  console.assert(secondProfile.isMainProfile === false, 'Deveria ser perfil secundário');

  // Teste 6: Consulta de perfis da conta
  console.log('6. Testando consulta e integridade de perfis...');
  const allProfiles = await ProfileService.getProfilesByAccount(account.id);
  console.assert(allProfiles.length === 2, 'Deveria retornar exatamente 2 perfis');
  console.assert(allProfiles[0].name === 'Maria', 'Primeiro perfil deve ser Maria');
  console.assert(allProfiles[1].name === 'Artur', 'Segundo perfil deve ser Artur');

  console.log('--- TODOS OS TESTES PASSARAM COM SUCESSO! ---');
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
