import { getDatabase, closeDatabase } from '../src/db/connection.js';
import { runVersionedMigrations } from '../src/db/migrator.js';
import { configureVapid } from '../src/config/vapid.js';
import { OccurrenceGeneratorService } from '../src/services/occurrenceGeneratorService.js';
import { PushDispatcherService } from '../src/services/pushDispatcherService.js';

async function runDispatchOnce() {
  console.log('================================================================');
  console.log('       Doses — Execução Manual de Ciclo de Despacho (3C)        ');
  console.log('================================================================');

  // 1. Configura credenciais VAPID
  const vapidConfigured = configureVapid();
  if (!vapidConfigured) {
    console.warn('⚠️ [Aviso] VAPID não configurado. Notificações reais podem falhar.');
  }

  // 2. Conecta ao banco de dados e aplica migrações pendentes
  const db = getDatabase();
  runVersionedMigrations(db);

  // 3. Executa o gerador de ocorrências para garantir que todas as programações tenham slots
  console.log('\n[1/2] Sincronizando ocorrências com o gerador da Etapa 3B...');
  const generator = new OccurrenceGeneratorService(db);
  const genResult = generator.generateOccurrences(2); // Garante hoje e amanhã
  console.log(`✓ Gerador concluído: ${genResult.generatedCount} novas ocorrências geradas (horizonte: ${genResult.startDate} até ${genResult.endDate})`);

  // 4. Executa o despacho pontual das ocorrências elegíveis
  console.log('\n[2/2] Processando ocorrências elegíveis para envio Web Push...');
  const dispatcher = new PushDispatcherService({ db });
  const batchResult = await dispatcher.dispatchEligibleOccurrences();

  console.log('\n================================================================');
  console.log('                 RELATÓRIO DO CICLO DE DESPACHO                 ');
  console.log('================================================================');
  console.log(`• Ocorrências avaliadas no instante: ${batchResult.evaluatedCount}`);
  console.log(`• Ocorrências despachadas com sucesso: ${batchResult.dispatchedCount}`);
  console.log(`• Ocorrências ignoradas (já enviadas/concorrentes): ${batchResult.skippedCount}`);
  console.log(`• Ocorrências com falha transitória: ${batchResult.failedCount}`);
  console.log(`• Total de notificações Web Push enviadas: ${batchResult.totalPushSent}`);
  console.log(`• Total de falhas no envio: ${batchResult.totalPushFailed}`);

  if (batchResult.results.length > 0) {
    console.log('\nDetalhes por ocorrência:');
    for (const r of batchResult.results) {
      console.log(
        `  - [${r.occurrenceId.slice(0, 8)}] Status: ${r.status || (r.skipped ? 'SKIPPED' : 'FAILED')} | Dispositivos enviados: ${r.sentCount} | Falhas: ${r.failedCount}${r.reason ? ` (${r.reason})` : ''}`
      );
    }
  }

  console.log('================================================================\n');
  closeDatabase();
}

runDispatchOnce().catch((err) => {
  console.error('\n❌ Erro durante a execução do despacho:', err);
  closeDatabase();
  process.exit(1);
});
