import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { db } from '../../services/database/db';
import { ProfileService } from '../../services/profile/ProfileService';
import { AccountService } from '../../services/account/AccountService';
import type { Profile } from '../../types';

// Mock simples para o localStorage em Node.js
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  },
  key: () => null,
  length: 0,
};

describe('Telas de Informações do Usuário & Persistência — Doses', () => {
  beforeEach(async () => {
    await db.profiles.clear();
    await db.accounts.clear();
    localStorage.clear();
  });

  it('1. Deve consultar informações do perfil ativo no IndexedDB', async () => {
    const account = await AccountService.createAccount('usuario_teste', 'Senha@1234');
    const profile = await ProfileService.createProfile({
      accountId: account.id,
      name: 'Camilla',
      surname: 'Silva',
      age: 42,
      weight: 63,
      height: 165,
      avatar: 'young-woman',
      isMainProfile: true,
    });

    const retrieved = await ProfileService.getProfileById(profile.id);
    assert.ok(retrieved);
    assert.equal(retrieved.name, 'Camilla');
    assert.equal(retrieved.age, 42);
    assert.equal(retrieved.weight, 63);
    assert.equal(retrieved.height, 165);
    assert.equal(retrieved.avatar, 'young-woman');
  });

  it('2. Deve atualizar e persistir alterações nos dados físicos (altura, peso, idade)', async () => {
    const account = await AccountService.createAccount('usuario_teste2', 'Senha@1234');
    const profile = await ProfileService.createProfile({
      accountId: account.id,
      name: 'José',
      surname: 'Ferreira',
      age: 74,
      weight: 76,
      height: 172,
      avatar: 'senior-person',
      isMainProfile: true,
    });

    // Atualiza peso e idade
    const updated = await ProfileService.updateProfile(profile.id, {
      weight: 78,
      age: 75,
      height: 173,
    });

    assert.equal(updated.weight, 78);
    assert.equal(updated.age, 75);
    assert.equal(updated.height, 173);

    // Confirma persistência no IndexedDB
    const fromDb = await db.profiles.get(profile.id);
    assert.ok(fromDb);
    assert.equal(fromDb.weight, 78);
    assert.equal(fromDb.age, 75);
    assert.equal(fromDb.height, 173);
  });

  it('3. Não deve permitir que a edição de um perfil altere acidentalmente outro perfil', async () => {
    const account = await AccountService.createAccount('usuario_teste3', 'Senha@1234');
    const profile1 = await ProfileService.createProfile({
      accountId: account.id,
      name: 'Camilla',
      surname: 'Silva',
      age: 42,
      weight: 63,
      height: 165,
      avatar: 'young-woman',
      isMainProfile: true,
    });

    const profile2 = await ProfileService.createProfile({
      accountId: account.id,
      name: 'José',
      surname: 'Ferreira',
      age: 74,
      weight: 76,
      height: 172,
      avatar: 'senior-person',
      isMainProfile: false,
    });

    // Atualiza apenas o perfil 1
    await ProfileService.updateProfile(profile1.id, {
      weight: 65,
    });

    // Verifica que o perfil 2 permaneceu intocado
    const p1 = await db.profiles.get(profile1.id);
    const p2 = await db.profiles.get(profile2.id);

    assert.equal(p1?.weight, 65);
    assert.equal(p2?.weight, 76);
    assert.equal(p2?.name, 'José');
  });

  it('4. Deve validar campos durante atualização de perfil', async () => {
    const account = await AccountService.createAccount('usuario_teste4', 'Senha@1234');
    const profile = await ProfileService.createProfile({
      accountId: account.id,
      name: 'Amora',
      surname: 'Pet',
      age: 3,
      weight: 12,
      height: 45,
      avatar: 'doguinho-fofo',
      isMainProfile: true,
    });

    await assert.rejects(
      async () => {
        await ProfileService.updateProfile(profile.id, { name: '' });
      },
      /O nome é obrigatório/
    );

    await assert.rejects(
      async () => {
        await ProfileService.updateProfile(profile.id, { age: -5 });
      },
      /Informe uma idade válida/
    );

    await assert.rejects(
      async () => {
        await ProfileService.updateProfile(profile.id, { weight: 0 });
      },
      /Informe um peso válido/
    );
  });

  it('5. Deve alternar e sincronizar perfil ativo entre múltiplos perfis', async () => {
    const account = await AccountService.createAccount('usuario_teste5', 'Senha@1234');
    const p1 = await ProfileService.createProfile({
      accountId: account.id,
      name: 'Camilla',
      surname: 'Silva',
      age: 42,
      weight: 63,
      height: 165,
      avatar: 'young-woman',
      isMainProfile: true,
    });

    const p2 = await ProfileService.createProfile({
      accountId: account.id,
      name: 'José',
      surname: 'Ferreira',
      age: 74,
      weight: 76,
      height: 172,
      avatar: 'senior-person',
      isMainProfile: false,
    });

    ProfileService.setActiveProfileId(p1.id);
    assert.equal(ProfileService.getActiveProfileId(), p1.id);

    ProfileService.setActiveProfileId(p2.id);
    assert.equal(ProfileService.getActiveProfileId(), p2.id);
  });
});
