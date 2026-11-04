import test from 'node:test';
import assert from 'node:assert/strict';
import { FIGMA_RECEITAS_MOCK, getReceitasMock } from '../../mocks/receitas/receitas.mock';
import type { ReceitaMedicaItem, Profile } from '../../types';

test('Seção de Receitas Médicas — Doses', async (t) => {
  await t.test('1. Deve reproduzir com exatidão as 4 receitas médicas do Figma (Frame 222:296)', () => {
    assert.equal(FIGMA_RECEITAS_MOCK.length, 4, 'O mock do Figma deve conter 4 receitas');

    // Receita 1: Nutricionista
    const r1 = FIGMA_RECEITAS_MOCK[0];
    assert.equal(r1.specialty, 'Nutricionista');
    assert.equal(r1.doctorName, 'Dra. Ana Martins');
    assert.equal(r1.emissionDate, '15/10/2026');
    assert.deepEqual(r1.medications, ['Vitamina C', 'Vitamina D']);
    assert.equal(r1.cardColor, '#B4ECFB');

    // Receita 2: Cardiologista
    const r2 = FIGMA_RECEITAS_MOCK[1];
    assert.equal(r2.specialty, 'Cardiologista');
    assert.equal(r2.doctorName, 'Dr. Pedro Almeida');
    assert.equal(r2.emissionDate, '08/10/2026');
    assert.deepEqual(r2.medications, ['Losartana 50 mg']);
    assert.equal(r2.cardColor, '#BBF9E0');

    // Receita 3: Endocrinologista
    const r3 = FIGMA_RECEITAS_MOCK[2];
    assert.equal(r3.specialty, 'Endocrinologista');
    assert.equal(r3.doctorName, 'Dra. Júlia Costa');
    assert.equal(r3.emissionDate, '02/10/2026');
    assert.deepEqual(r3.medications, ['Amoxicilina 500 mg']);
    assert.equal(r3.cardColor, '#FBD4EC');

    // Receita 4: Ginecologista
    const r4 = FIGMA_RECEITAS_MOCK[3];
    assert.equal(r4.specialty, 'Ginecologista');
    assert.equal(r4.doctorName, 'Dra. Ana Martins');
    assert.equal(r4.emissionDate, '25/09/2026');
    assert.deepEqual(r4.medications, ['Loratadina 10 mg']);
    assert.equal(r4.cardColor, '#FFF4DA');
  });

  await t.test('2. Deve adaptar as receitas ao perfil ativo informado', () => {
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

    const joseReceitas = getReceitasMock(joseProfile);
    assert.ok(joseReceitas.length >= 2, 'José deve ter receitas geriátricas/neurológicas');
    assert.equal(joseReceitas[0].specialty, 'Neurologista');
    assert.equal(joseReceitas[0].profileName, 'José');
    assert.ok(joseReceitas[0].medications.includes('Prolopa 200 mg'));

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

    const amoraReceitas = getReceitasMock(amoraProfile);
    assert.equal(amoraReceitas.length, 1);
    assert.equal(amoraReceitas[0].specialty, 'Veterinário');
    assert.equal(amoraReceitas[0].profileName, 'Amora');
  });

  await t.test('3. Operações em memória: Cadastro, Edição e Exclusão de receitas', () => {
    let list: ReceitaMedicaItem[] = [...FIGMA_RECEITAS_MOCK];

    // Cadastro
    const novaReceita: ReceitaMedicaItem = {
      id: 'rec-test-new',
      profileName: 'Camilla',
      avatar: 'young-woman',
      specialty: 'Dermatologista',
      doctorName: 'Dr. Lucas Vieira',
      emissionDate: '20/10/2026',
      medications: ['Protetor Solar FPS 50', 'Hidratante Cerave'],
      cardColor: '#B4ECFB',
    };

    list = [novaReceita, ...list];
    assert.equal(list.length, 5, 'Lista deve conter 5 receitas após adição');
    assert.equal(list[0].specialty, 'Dermatologista');

    // Edição
    const atualizada: ReceitaMedicaItem = {
      ...novaReceita,
      specialty: 'Dermatologia Clínica',
      doctorName: 'Dr. Lucas Vieira Mendes',
    };
    list = list.map((r) => (r.id === atualizada.id ? atualizada : r));
    assert.equal(list[0].specialty, 'Dermatologia Clínica');
    assert.equal(list[0].doctorName, 'Dr. Lucas Vieira Mendes');

    // Exclusão
    list = list.filter((r) => r.id !== 'rec-test-new');
    assert.equal(list.length, 4, 'Lista volta a ter 4 receitas após exclusão');
    assert.equal(list.some((r) => r.id === 'rec-test-new'), false);
  });

  await t.test('4. Fidelidade visual das cores de card da paleta oficial do Doses', () => {
    const validColors = ['#B4ECFB', '#BBF9E0', '#FBD4EC', '#FFF4DA'];
    for (const r of FIGMA_RECEITAS_MOCK) {
      assert.ok(
        validColors.includes(r.cardColor),
        `A cor ${r.cardColor} deve pertencer à paleta de cards do Figma`
      );
    }
  });
});
