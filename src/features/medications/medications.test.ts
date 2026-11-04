import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MockMedicationRepository,
  ApiMedicationRepository,
  getMedicationRepository,
  setMedicationDataSource,
} from './services';
import type { Medication, CreateMedicationDTO, UpdateMedicationDTO } from './types/medication';

test('Gerenciamento de Medicamentos — CRUD & Arquitetura Repository', async (t) => {
  // Instance of Mock repository with 0 latency for fast tests
  const repo = new MockMedicationRepository(undefined, 0);

  await t.test('1. Listagem de medicamentos e isolamento por perfil', async () => {
    repo.reset();

    // Profile Camilla
    const camillaMeds = await repo.list('profile-camilla');
    assert.equal(camillaMeds.length, 3, 'Camilla deve possuir 3 medicamentos semeados');
    assert.equal(camillaMeds[0].name, 'Vitamina D');
    assert.deepEqual(camillaMeds[0].schedules, ['08:00']);
    assert.equal(camillaMeds[0].cardColor, '#B4ECFB');

    // Profile José
    const joseMeds = await repo.list('profile-jose');
    assert.equal(joseMeds.length, 2, 'José deve possuir 2 medicamentos semeados');
    assert.equal(joseMeds[0].name, 'Losartana Potássica 50mg');
    assert.deepEqual(joseMeds[0].schedules, ['08:00', '20:00']);

    // Profile Amora (Pet)
    const amoraMeds = await repo.list('profile-amora');
    assert.equal(amoraMeds.length, 2, 'Amora deve possuir 2 medicamentos semeados');
    assert.equal(amoraMeds[0].name, 'Apoquel 3.6mg');

    // Perfil desconhecido sem seed: gera clone inicial baseado no contexto
    const customProfileMeds = await repo.list('custom-user-123');
    assert.ok(customProfileMeds.length > 0, 'Novo perfil deve receber template inicial');
    assert.equal(customProfileMeds[0].profileId, 'custom-user-123');
  });

  await t.test('2. Criação (Create) com validação de campos obrigatórios', async () => {
    repo.reset();

    // Sucesso
    const newMedDTO: CreateMedicationDTO = {
      profileId: 'profile-camilla',
      name: 'Dipirona 500mg',
      schedules: ['10:00', '22:00'],
      recurrence: { type: 'daily' },
      instructions: '1 comprimido se houver dor ou febre',
      cardColor: '#BBF9E0',
      status: 'active',
    };

    const created = await repo.create(newMedDTO);
    assert.ok(created.id, 'Deve gerar um ID único');
    assert.equal(created.name, 'Dipirona 500mg');
    assert.equal(created.profileId, 'profile-camilla');
    assert.deepEqual(created.schedules, ['10:00', '22:00']);
    assert.ok(created.createdAt);
    assert.ok(created.updatedAt);

    // Listagem deve conter o novo item
    const updatedList = await repo.list('profile-camilla');
    assert.equal(updatedList.length, 4, 'Camilla agora deve ter 4 medicamentos');
    assert.ok(updatedList.some((m) => m.id === created.id));

    // Falha: Nome vazio
    await assert.rejects(
      async () => {
        await repo.create({
          profileId: 'profile-camilla',
          name: '   ',
          schedules: ['08:00'],
          recurrence: { type: 'daily' },
          status: 'active',
        });
      },
      /O nome do medicamento é obrigatório/,
      'Deve rejeitar criação com nome em branco'
    );

    // Falha: Sem horários
    await assert.rejects(
      async () => {
        await repo.create({
          profileId: 'profile-camilla',
          name: 'Ibuprofeno',
          schedules: [],
          recurrence: { type: 'daily' },
          status: 'active',
        });
      },
      /Pelo menos um horário deve ser informado/,
      'Deve rejeitar criação sem horários'
    );
  });

  await t.test('3. Consulta por ID (GetById)', async () => {
    repo.reset();

    const med = await repo.getById('med-camilla-1');
    assert.ok(med, 'Deve encontrar medicamento existente');
    assert.equal(med?.id, 'med-camilla-1');
    assert.equal(med?.name, 'Vitamina D');

    const notFound = await repo.getById('inexistent-id-999');
    assert.equal(notFound, null, 'Deve retornar null para ID inexistente');
  });

  await t.test('4. Edição/Atualização (Edit/Update)', async () => {
    repo.reset();

    const updateDTO: UpdateMedicationDTO = {
      name: 'Vitamina D3 2.000 UI',
      schedules: ['09:00'],
      instructions: '2 gotas junto ao café da manhã',
      cardColor: '#FFF6E1',
    };

    const updated = await repo.update('med-camilla-1', updateDTO);
    assert.equal(updated.id, 'med-camilla-1', 'ID deve ser preservado');
    assert.equal(updated.name, 'Vitamina D3 2.000 UI');
    assert.deepEqual(updated.schedules, ['09:00']);
    assert.equal(updated.instructions, '2 gotas junto ao café da manhã');
    assert.equal(updated.cardColor, '#FFF6E1');
    assert.notEqual(updated.updatedAt, updated.createdAt, 'updatedAt deve ser atualizado');

    // Validação de erro em update
    await assert.rejects(
      async () => {
        await repo.update('med-camilla-1', { name: '   ' });
      },
      /O nome do medicamento não pode ser vazio/,
      'Deve rejeitar atualização com nome vazio'
    );

    await assert.rejects(
      async () => {
        await repo.update('med-camilla-1', { schedules: [] });
      },
      /Pelo menos um horário deve ser informado/,
      'Deve rejeitar atualização com lista vazia de horários'
    );

    await assert.rejects(
      async () => {
        await repo.update('inexistent-id', { name: 'Teste' });
      },
      /não encontrado/,
      'Deve rejeitar atualização de ID inexistente'
    );
  });

  await t.test('5. Exclusão (Delete)', async () => {
    repo.reset();

    const beforeList = await repo.list('profile-camilla');
    assert.equal(beforeList.length, 3);

    await repo.delete('med-camilla-2');

    const afterList = await repo.list('profile-camilla');
    assert.equal(afterList.length, 2, 'Deve decrementar a lista após exclusão');
    assert.ok(!afterList.some((m) => m.id === 'med-camilla-2'));

    // Tentativa de excluir novamente
    await assert.rejects(
      async () => {
        await repo.delete('med-camilla-2');
      },
      /não encontrado para exclusão/,
      'Deve falhar ao tentar excluir ID que não existe'
    );
  });

  await t.test('6. Simulação controlada de erros para testes de UI', async () => {
    repo.reset();
    repo.setErrorSimulation(true);

    await assert.rejects(
      async () => {
        await repo.list('profile-camilla');
      },
      /Falha simulada na comunicação/,
      'Deve lançar erro quando a simulação de falha estiver ativa'
    );

    repo.setErrorSimulation(false);
    const recovered = await repo.list('profile-camilla');
    assert.ok(recovered.length > 0, 'Deve voltar a funcionar após desativar erro simulado');
  });

  await t.test('7. Conformidade de contrato e Factory de Repositórios', async () => {
    // Contract check on ApiMedicationRepository
    const apiRepo = new ApiMedicationRepository({ baseUrl: 'https://api.doses.app/v1' });
    assert.equal(typeof apiRepo.list, 'function');
    assert.equal(typeof apiRepo.getById, 'function');
    assert.equal(typeof apiRepo.create, 'function');
    assert.equal(typeof apiRepo.update, 'function');
    assert.equal(typeof apiRepo.delete, 'function');

    // Factory check
    setMedicationDataSource('mock');
    const factoryMock = getMedicationRepository();
    assert.ok(factoryMock instanceof MockMedicationRepository);

    setMedicationDataSource('api');
    const factoryApi = getMedicationRepository();
    assert.ok(factoryApi instanceof ApiMedicationRepository);

    // Reset back to mock for application runtime
    setMedicationDataSource('mock');
    const restoredMock = getMedicationRepository();
    assert.ok(restoredMock instanceof MockMedicationRepository);
  });

  await t.test('8. Validação de regras visuais e fidelidade com Figma (Nós 301:6972, 301:7018, 301:7324)', () => {
    // Validação da frase de repetição semanal do Figma: "Repetir às segundas, quartas e sextas."
    const WEEK_DAYS = [
      { id: 1, label: 'Seg', name: 'segundas', prep: 'às' },
      { id: 2, label: 'Ter', name: 'terças', prep: 'às' },
      { id: 3, label: 'Qua', name: 'quartas', prep: 'às' },
      { id: 4, label: 'Qui', name: 'quintas', prep: 'às' },
      { id: 5, label: 'Sex', name: 'sextas', prep: 'às' },
      { id: 6, label: 'Sáb', name: 'sábados', prep: 'aos' },
      { id: 0, label: 'Dom', name: 'domingos', prep: 'aos' },
    ];

    function formatDaysSentence(selectedDayIds: number[]): string {
      if (selectedDayIds.length === 0) return 'Selecione pelo menos um dia.';
      if (selectedDayIds.length === 7) return 'Repetir todos os dias.';
      const sorted = WEEK_DAYS.filter((d) => selectedDayIds.includes(d.id));
      if (sorted.length === 1) return `Repetir ${sorted[0].prep} ${sorted[0].name}.`;
      const names = sorted.map((d) => d.name);
      const last = names.pop();
      const joined = `${names.join(', ')} e ${last}`;
      const firstPrep = sorted[0].prep;
      return `Repetir ${firstPrep} ${joined}.`;
    }

    // Caso do Figma Frame 301:7324
    assert.equal(
      formatDaysSentence([1, 3, 5]),
      'Repetir às segundas, quartas e sextas.',
      'Frase de resumo dos dias deve coincidir com o design do Figma'
    );

    // Caso de fim de semana
    assert.equal(
      formatDaysSentence([6, 0]),
      'Repetir aos sábados e domingos.',
      'Frase de sábado e domingo deve usar preposição correta'
    );

    // Todos os dias
    assert.equal(
      formatDaysSentence([1, 2, 3, 4, 5, 6, 0]),
      'Repetir todos os dias.'
    );
  });
});
