import 'fake-indexeddb/auto';
import React from 'react';
(globalThis as any).React = React;
import assert from 'node:assert/strict';
import { db } from '../database/db';
import { AccountService } from '../account/AccountService';
import { ProfileService } from './ProfileService';
import { ALL_AVATARS, AVATAR_NAMES } from '../../components/profile/AvatarSelector';
import { getAvatarBgColor, AvatarRenderer } from '../../components/profile/AvatarRenderer';
import type { AvatarId } from '../../types';

// Mock localStorage para Node.js
const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};

async function runNewAvatarsTests() {
  console.log('--- Iniciando Testes de Importação, Seleção e Persistência de Novos Avatares ---');

  // Limpa banco
  await db.accounts.clear();
  await db.profiles.clear();
  ProfileService.clearActiveProfileId();

  // 1. Validar que todos os 14 avatares do frame Profiles estão presentes
  console.log('1. Validando catálogo completo de 14 avatares do frame Profiles...');
  assert.equal(ALL_AVATARS.length, 14, 'O catálogo de avatares deve conter 14 opções');
  assert.ok(ALL_AVATARS.includes('young-woman'), 'Deve conter young-woman (Profile 01)');
  assert.ok(ALL_AVATARS.includes('senior-person'), 'Deve conter senior-person (Profile 02)');
  assert.ok(ALL_AVATARS.includes('doguinho-fofo'), 'Deve conter doguinho-fofo (Profile 03)');
  for (let i = 4; i <= 14; i++) {
    const id = `profile-${String(i).padStart(2, '0')}` as AvatarId;
    assert.ok(ALL_AVATARS.includes(id), `Deve conter o avatar ${id}`);
    assert.ok(AVATAR_NAMES[id], `Avatar ${id} deve possuir rótulo descritivo`);
  }

  // 2. Validar que cada avatar possui renderizador e cor de fundo válida
  console.log('2. Validando renderizador e cores de fundo para todos os avatares...');
  for (const avatarId of ALL_AVATARS) {
    const color = getAvatarBgColor(avatarId);
    assert.ok(/^#[0-9A-Fa-f]{6}$/.test(color), `Cor de ${avatarId} deve ser hexadecimal válida (#RRGGBB): ${color}`);
    const vnode = AvatarRenderer({ avatar: avatarId, size: 76 });
    assert.ok(vnode, `AvatarRenderer deve retornar elemento para ${avatarId}`);
  }

  // 3. Validar compatibilidade com avatares legados
  console.log('3. Validando compatibilidade de avatares legados...');
  assert.equal(getAvatarBgColor('young-woman'), '#BBF9E0');
  assert.equal(getAvatarBgColor('senior-person'), '#B4ECFB');
  assert.equal(getAvatarBgColor('doguinho-fofo'), '#FBD4EC');

  // 4. Testar persistência e recuperação no IndexedDB para novos avatares
  console.log('4. Testando criação e persistência de perfis com novos avatares no IndexedDB...');
  const testAccount = await AccountService.createAccount('usuario_avatares', 'senha123');

  // Criar perfis com novos avatares (ex: profile-04, profile-07, profile-10, profile-14)
  const p4 = await ProfileService.createProfile({
    accountId: testAccount.id,
    name: 'Carlos',
    surname: 'Crespo',
    age: 29,
    weight: 75,
    height: 180,
    avatar: 'profile-04',
    isMainProfile: true,
  });
  assert.equal(p4.avatar, 'profile-04');

  const p7 = await ProfileService.createProfile({
    accountId: testAccount.id,
    name: 'Fatima',
    surname: 'Hijab',
    age: 34,
    weight: 62,
    height: 165,
    avatar: 'profile-07',
    isMainProfile: false,
  });
  assert.equal(p7.avatar, 'profile-07');

  const p10 = await ProfileService.createProfile({
    accountId: testAccount.id,
    name: 'Mimi',
    surname: 'Gato',
    age: 3,
    weight: 4,
    height: 25,
    avatar: 'profile-10',
    isMainProfile: false,
  });
  assert.equal(p10.avatar, 'profile-10');

  const p14 = await ProfileService.createProfile({
    accountId: testAccount.id,
    name: 'Dandara',
    surname: 'Retinta',
    age: 31,
    weight: 68,
    height: 170,
    avatar: 'profile-14',
    isMainProfile: false,
  });
  assert.equal(p14.avatar, 'profile-14');

  // 5. Consultar perfis do IndexedDB e verificar integridade
  console.log('5. Consultando banco e validando integridade dos avatares persistidos...');
  const profiles = await ProfileService.getProfilesByAccount(testAccount.id);
  assert.equal(profiles.length, 4);

  const foundP4 = profiles.find((p) => p.id === p4.id);
  assert.equal(foundP4?.avatar, 'profile-04');

  const foundP7 = profiles.find((p) => p.id === p7.id);
  assert.equal(foundP7?.avatar, 'profile-07');

  const foundP10 = profiles.find((p) => p.id === p10.id);
  assert.equal(foundP10?.avatar, 'profile-10');

  const foundP14 = profiles.find((p) => p.id === p14.id);
  assert.equal(foundP14?.avatar, 'profile-14');

  // 6. Testar alternância de perfil ativo com novo avatar
  console.log('6. Testando ativação de perfil com novo avatar...');
  ProfileService.setActiveProfileId(p14.id);
  const activeId = ProfileService.getActiveProfileId();
  assert.equal(activeId, p14.id);
  const activeProfile = activeId ? await ProfileService.getProfileById(activeId) : null;
  assert.equal(activeProfile?.id, p14.id);
  assert.equal(activeProfile?.avatar, 'profile-14');

  console.log('--- TODOS OS TESTES DE NOVOS AVATARES PASSARAM COM SUCESSO! ---');
}

runNewAvatarsTests().catch((err) => {
  console.error('Falha nos testes de novos avatares:', err);
  process.exit(1);
});
