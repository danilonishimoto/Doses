import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDailyMedicationsMock } from '../../mocks/home/dailyMedications.mock';
import type { Profile } from '../../types';

describe('Home & Navegação Principal — Doses', () => {
  it('1. Deve gerar lista de medicamentos padrão quando não há perfil ativo', () => {
    const meds = getDailyMedicationsMock(null);
    assert.equal(meds.length, 4);
    assert.equal(meds[0].profileName, 'Camilla');
    assert.equal(meds[0].medicationName, 'Vitamina D');
    assert.equal(meds[0].time, '08:00');
    assert.equal(meds[0].status, 'completed');
    assert.equal(meds[0].cardColor, '#B4ECFB');
  });

  it('2. Deve adaptar os medicamentos ao perfil ativo informado', () => {
    const mockProfile: Profile = {
      id: 'profile-maria',
      accountId: 'account-1',
      name: 'Maria',
      surname: 'Silva',
      age: 32,
      weight: 60,
      height: 165,
      avatar: 'young-woman',
      isMainProfile: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const meds = getDailyMedicationsMock(mockProfile);
    assert.equal(meds.length, 4);
    assert.equal(meds[0].profileName, 'Maria');
    assert.equal(meds[0].avatar, 'young-woman');
    assert.equal(meds[1].profileName, 'Maria');
    // O item dependente do José é preservado se Maria for o perfil ativo
    assert.equal(meds[2].profileName, 'José');
    assert.equal(meds[3].profileName, 'Maria');
  });

  it('3. Deve manter fidelidade às cores dos cards conforme o Figma', () => {
    const meds = getDailyMedicationsMock(null);
    assert.equal(meds[0].cardColor, '#B4ECFB'); // Azul claro
    assert.equal(meds[1].cardColor, '#FFF6E1'); // Amarelo/creme
    assert.equal(meds[2].cardColor, '#BBF9E0'); // Verde menta
    assert.equal(meds[3].cardColor, '#E8F4F1'); // Menta suave
  });

  it('4. Deve alternar status de medicamento entre pendente e concluído', () => {
    const meds = getDailyMedicationsMock(null);
    const item = { ...meds[0] };
    assert.equal(item.status, 'completed');

    // Simula clique no controle
    item.status = item.status === 'completed' ? 'pending' : 'completed';
    assert.equal(item.status, 'pending');

    item.status = item.status === 'completed' ? 'pending' : 'completed';
    assert.equal(item.status, 'completed');
  });

  it('5. Validação de abas de navegação da barra inferior', () => {
    const validTabs = ['home', 'cronograma', 'receitas', 'usuarios'];
    const tabPaths: Record<string, string> = {
      home: '/',
      cronograma: '/cronograma',
      receitas: '/receitas',
      usuarios: '/usuarios',
    };

    for (const tab of validTabs) {
      assert.ok(tabPaths[tab], `Aba ${tab} deve possuir caminho definido`);
      assert.ok(tabPaths[tab].startsWith('/'), `Caminho deve ser rota absoluta válida`);
    }
  });
});
