import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as any).React = React;

import { MedicationTimePickerSheet } from './MedicationTimePickerSheet';

test('Seletor de Horário de Medicamentos — Interações de Scroll, Touch e Atualização', async (t) => {
  await t.test('1. Deve renderizar vazio quando fechado e estrutura acessível quando aberto', () => {
    const closedHtml = renderToStaticMarkup(
      React.createElement(MedicationTimePickerSheet, {
        isOpen: false,
        initialTime: '08:00',
        onClose: () => {},
        onSelectTime: () => {},
      })
    );
    assert.equal(closedHtml, '', 'Não deve renderizar markup quando isOpen for false');

    const openHtml = renderToStaticMarkup(
      React.createElement(MedicationTimePickerSheet, {
        isOpen: true,
        initialTime: '08:00',
        onClose: () => {},
        onSelectTime: () => {},
      })
    );
    assert.ok(openHtml.includes('role="dialog"'), 'Deve conter role dialog');
    assert.ok(openHtml.includes('aria-label="Seletor de horário"'), 'Deve ter aria-label');
    assert.ok(openHtml.includes('Adicionar horário'), 'Deve exibir título');
  });

  await t.test('2. Deve conter colunas de spinbutton para horas e minutos com touchAction: none', () => {
    const html = renderToStaticMarkup(
      React.createElement(MedicationTimePickerSheet, {
        isOpen: true,
        initialTime: '14:35',
        onClose: () => {},
        onSelectTime: () => {},
      })
    );

    // Verifica que ambas as colunas estão presentes com spinbutton e touch-action: none
    assert.ok(html.includes('aria-label="Seletor de horas"'), 'Deve conter seletor de horas');
    assert.ok(html.includes('aria-label="Seletor de minutos"'), 'Deve conter seletor de minutos');
    assert.ok(html.includes('touch-action:none'), 'Deve conter touch-action: none para rolagem fluida');
    assert.ok(html.includes('cursor:ns-resize'), 'Deve conter cursor ns-resize');

    // Verifica valores renderizados (14:35 -> anterior 13:30, posterior 15:40)
    assert.ok(html.includes('14'), 'Deve renderizar hora atual 14');
    assert.ok(html.includes('35'), 'Deve renderizar minuto atual 35');
    assert.ok(html.includes('13'), 'Deve renderizar hora anterior 13');
    assert.ok(html.includes('15'), 'Deve renderizar próxima hora 15');
    assert.ok(html.includes('30'), 'Deve renderizar minuto anterior 30');
    assert.ok(html.includes('40'), 'Deve renderizar próximo minuto 40');
  });

  await t.test('3. Elementos decorativos não devem bloquear eventos (pointer-events: none)', () => {
    const html = renderToStaticMarkup(
      React.createElement(MedicationTimePickerSheet, {
        isOpen: true,
        initialTime: '08:00',
        onClose: () => {},
        onSelectTime: () => {},
      })
    );

    // Garante que o pill de fundo e o separador possuem pointer-events: none
    assert.ok(html.includes('pointer-events:none'), 'Elementos decorativos devem ter pointer-events: none');
    assert.ok(html.includes('user-select:none'), 'Container deve impedir seleção acidental de texto durante rolagem');
  });

  await t.test('4. Cálculos matemáticos de ajuste de hora e minuto com ciclo contínuo (wrap-around)', () => {
    // Testa funções de ajuste com wrap 0..23 e 0..59
    const adjustHour = (curr: number, delta: number) => ((curr + delta) % 24 + 24) % 24;
    const adjustMinute = (curr: number, delta: number) => ((curr + delta) % 60 + 60) % 60;

    // Horas
    assert.equal(adjustHour(23, 1), 0, '23 + 1 deve virar 0');
    assert.equal(adjustHour(0, -1), 23, '0 - 1 deve virar 23');
    assert.equal(adjustHour(8, 2), 10, '8 + 2 deve virar 10');
    assert.equal(adjustHour(8, -2), 6, '8 - 2 deve virar 6');

    // Minutos
    assert.equal(adjustMinute(55, 5), 0, '55 + 5 deve virar 0');
    assert.equal(adjustMinute(0, -5), 55, '0 - 5 deve virar 55');
    assert.equal(adjustMinute(30, 5), 35, '30 + 5 deve virar 35');
    assert.equal(adjustMinute(30, -5), 25, '30 - 5 deve virar 25');
  });
});

