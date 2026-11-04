import assert from 'node:assert';
import { validateRecurrence } from './recurrenceValidator.js';

console.log('================================================================');
console.log('  Suíte de Testes da Validação Estrita de Recorrência (3B.1)    ');
console.log('================================================================\n');

function runTests() {
  let passed = 0;

  // 1. Recorrência diária válida ('DAILY' ou 'daily')
  {
    const r1 = validateRecurrence('DAILY');
    assert.strictEqual(r1.valid, true);
    assert.strictEqual(r1.normalized, 'DAILY');

    const r2 = validateRecurrence('daily');
    assert.strictEqual(r2.valid, true);
    assert.strictEqual(r2.normalized, 'DAILY');
    console.log('✓ Cenário 1: "DAILY" e "daily" aceitos e normalizados para DAILY');
    passed++;
  }

  // 2. Recorrência diária em JSON válido
  {
    const r = validateRecurrence('{"type":"daily"}');
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.normalized, 'DAILY');
    console.log('✓ Cenário 2: JSON {"type":"daily"} aceito e normalizado');
    passed++;
  }

  // 3. Recorrência semanal válida compacta ('WEEKLY:1,3,5')
  {
    const r = validateRecurrence('WEEKLY:1,3,5');
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.normalized, 'WEEKLY:1,3,5');
    console.log('✓ Cenário 3: "WEEKLY:1,3,5" aceito e normalizado');
    passed++;
  }

  // 4. Recorrência semanal em JSON válido
  {
    const r = validateRecurrence('{"type":"weekly","daysOfWeek":[1,3,5]}');
    assert.strictEqual(r.valid, true);
    assert.ok(r.normalized?.includes('weekly'));
    console.log('✓ Cenário 4: JSON {"type":"weekly","daysOfWeek":[1,3,5]} aceito');
    passed++;
  }

  // 5. String vazia ou apenas espaços (rejeitada)
  {
    const r1 = validateRecurrence('');
    assert.strictEqual(r1.valid, false);
    assert.ok(r1.error?.includes('vazia'));

    const r2 = validateRecurrence('   ');
    assert.strictEqual(r2.valid, false);
    console.log('✓ Cenário 5: String vazia ou com espaços rejeitada com erro explícito');
    passed++;
  }

  // 6. String desconhecida ("semanal", "mensal", etc. rejeitadas)
  {
    const r1 = validateRecurrence('semanal');
    assert.strictEqual(r1.valid, false);
    assert.ok(r1.error?.includes('não suportado'));

    const r2 = validateRecurrence('diario');
    assert.strictEqual(r2.valid, false);
    console.log('✓ Cenário 6: Termos arbitrários como "semanal" e "diario" rejeitados (sem fallback silencioso)');
    passed++;
  }

  // 7. Estrutura incompleta ('WEEKLY:' sem dias)
  {
    const r = validateRecurrence('WEEKLY:');
    assert.strictEqual(r.valid, false);
    assert.ok(r.error?.includes('ao menos um dia'));
    console.log('✓ Cenário 7: "WEEKLY:" sem dias rejeitado');
    passed++;
  }

  // 8. Dias da semana inválidos ou fora do intervalo 0-7
  {
    const r1 = validateRecurrence('WEEKLY:1,8');
    assert.strictEqual(r1.valid, false);
    assert.ok(r1.error?.includes('inválido'));

    const r2 = validateRecurrence('WEEKLY:-1,3');
    assert.strictEqual(r2.valid, false);
    console.log('✓ Cenário 8: Dias fora do intervalo 0-7 rejeitados');
    passed++;
  }

  // 9. Dias da semana duplicados
  {
    const r = validateRecurrence('WEEKLY:1,3,1');
    assert.strictEqual(r.valid, false);
    assert.ok(r.error?.includes('duplicado'));
    console.log('✓ Cenário 9: Dias duplicados ("WEEKLY:1,3,1") rejeitados');
    passed++;
  }

  // 10. JSON malformado ou campos incompletos
  {
    const r1 = validateRecurrence('{type: weekly}');
    assert.strictEqual(r1.valid, false);
    assert.ok(r1.error?.includes('malformado'));

    const r2 = validateRecurrence('{"type":"weekly","daysOfWeek":[]}');
    assert.strictEqual(r2.valid, false);
    assert.ok(r2.error?.includes('pelo menos um dia'));
    console.log('✓ Cenário 10: JSON malformado ou com daysOfWeek vazio rejeitado');
    passed++;
  }

  console.log(`\n================================================================`);
  console.log(`  RESULTADO: ${passed} de 10 testes de Recorrência APROVADOS!    `);
  console.log(`================================================================`);
}

runTests();
