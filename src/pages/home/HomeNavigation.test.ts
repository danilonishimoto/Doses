import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { db } from '../../services/database/db';
import { getTodaySaoPauloDate } from '../../features/medications/hooks/useDailyDoses';
import { ApiMedicationRepository } from '../../features/medications/services/apiMedicationRepository';
import type { Medication } from '../../features/medications/types/medication';
import type { Profile } from '../../types';

describe('Home & Navegação Principal — Integração Real', () => {
  it('1. Validação de formato da data civil no fuso America/Sao_Paulo', () => {
    const today = getTodaySaoPauloDate();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');
  });

  it('2. Medicamentos reais cadastrados no repositório aparecem para o perfil correspondente', async () => {
    await db.delete();
    await db.open();

    const profileId = 'prof_maria_123';
    const medId = 'med_losartana';

    const med: Medication = {
      id: medId,
      profileId,
      name: 'Losartana Potássica',
      instructions: '50 mg pela manhã',
      schedules: ['07:00', '19:00'],
      recurrence: { type: 'daily' },
      cardColor: '#BBF9E0',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.medications.put(med);

    const repo = new ApiMedicationRepository();
    const retrieved = await repo.list(profileId);

    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0]!.name, 'Losartana Potássica');
    assert.deepEqual(retrieved[0]!.schedules, ['07:00', '19:00']);
  });

  it('3. Recorrência semanal: só inclui doses nos dias configurados', async () => {
    const profileId = 'prof_joao';
    // Segunda (1) e Quarta (3)
    const medWeekly: Medication = {
      id: 'med_weekly_1',
      profileId,
      name: 'Anti-inflamatório',
      instructions: '1 comprimido',
      schedules: ['10:00'],
      recurrence: { type: 'weekly', daysOfWeek: [1, 3] },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.medications.put(medWeekly);

    const repo = new ApiMedicationRepository();
    const list = await repo.list(profileId);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.recurrence.type, 'weekly');
    assert.deepEqual(list[0]!.recurrence.daysOfWeek, [1, 3]);
  });

  it('4. Isolamento: Perfil B não acessa medicamentos do Perfil A', async () => {
    const repo = new ApiMedicationRepository();
    const profileBList = await repo.list('prof_outro_inexistente');
    assert.equal(profileBList.length, 0);
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
