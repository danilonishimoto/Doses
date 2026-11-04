import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getScheduleForDate,
  getMedicationCountForDate,
  formatDateToDateKey,
} from '../../mocks/cronograma/cronograma.mock';
import type { Profile } from '../../types';

test('Seção de Cronograma e Calendário Interativo — Doses', async (t) => {
  await t.test('1. Deve reproduzir a programação do dia 19 de outubro de 2026 conforme o Figma (Frame 241:7636)', () => {
    const date19 = new Date(2026, 9, 19);
    const schedule19 = getScheduleForDate(date19);

    assert.equal(schedule19.length, 3, 'Dia 19 de outubro deve conter 3 medicações');
    assert.equal(schedule19[0].time, '08:00');
    assert.equal(schedule19[0].medicationName, 'Vitamina D');
    assert.equal(schedule19[0].status, 'completed');
    assert.equal(schedule19[0].cardColor, '#B4ECFB');

    assert.equal(schedule19[1].time, '12:00');
    assert.equal(schedule19[1].medicationName, 'Vitamina C');
    assert.equal(schedule19[1].status, 'completed');
    assert.equal(schedule19[1].cardColor, '#BBF9E0');

    assert.equal(schedule19[2].time, '18:00');
    assert.equal(schedule19[2].medicationName, 'Losartana');
    assert.equal(schedule19[2].status, 'pending');
    assert.equal(schedule19[2].cardColor, '#FBD4EC');
  });

  await t.test('2. Deve reproduzir a programação do dia 20 de outubro de 2026 conforme o Figma (Frame 241:7170)', () => {
    const date20 = new Date(2026, 9, 20);
    const schedule20 = getScheduleForDate(date20);

    assert.equal(schedule20.length, 4, 'Dia 20 de outubro deve conter 4 medicações');
    assert.equal(schedule20[0].time, '08:00');
    assert.equal(schedule20[0].medicationName, 'Vitamina D');

    assert.equal(schedule20[1].time, '12:00');
    assert.equal(schedule20[1].medicationName, 'Vitamina C');

    assert.equal(schedule20[2].time, '14:00');
    assert.equal(schedule20[2].medicationName, 'Paracetamol');

    assert.equal(schedule20[3].time, '18:00');
    assert.equal(schedule20[3].medicationName, 'Losartana');
  });

  await t.test('3. Indicadores de pontos do calendário devem refletir a contagem exata de medicações', () => {
    const date19 = new Date(2026, 9, 19);
    assert.equal(getMedicationCountForDate(date19), 3);

    const date20 = new Date(2026, 9, 20);
    assert.equal(getMedicationCountForDate(date20), 4);

    // Dia vazio configurado (dia 5 ou 21)
    const dateEmpty = new Date(2026, 9, 21);
    assert.equal(getMedicationCountForDate(dateEmpty), 0);
  });

  await t.test('4. Deve adaptar medicações do cronograma conforme o perfil selecionado', () => {
    const joseProfile: Profile = {
      id: 'prof-jose',
      accountId: 'acc-1',
      name: 'José',
      surname: 'Silva',
      age: 72,
      weight: 68,
      height: 165,
      avatar: 'senior-person',
      isMainProfile: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const date = new Date(2026, 9, 19);
    const joseSchedule = getScheduleForDate(date, joseProfile);
    assert.ok(joseSchedule.length > 0);
    assert.equal(joseSchedule[0].profileName, 'José');
    assert.equal(joseSchedule[0].medicationName, 'Prolopa BD');

    const amoraProfile: Profile = {
      id: 'prof-amora',
      accountId: 'acc-1',
      name: 'Amora',
      surname: 'Pet',
      age: 3,
      weight: 8,
      height: 35,
      avatar: 'doguinho-fofo',
      isMainProfile: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const amoraSchedule = getScheduleForDate(new Date(2026, 9, 18), amoraProfile);
    assert.ok(amoraSchedule.length > 0);
    assert.equal(amoraSchedule[0].profileName, 'Amora');
  });

  await t.test('5. Formatação consistente de chaves de data YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 19); // Mês 9 = Outubro
    const key = formatDateToDateKey(d);
    assert.equal(key, '2026-10-19');
  });
});
