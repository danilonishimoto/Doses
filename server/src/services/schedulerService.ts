import Database from 'better-sqlite3';
import { OccurrenceGeneratorService, GenerateOccurrencesResult } from './occurrenceGeneratorService.js';
import { PushDispatcherService, DispatchBatchResult } from './pushDispatcherService.js';
import { getDatabase } from '../db/connection.js';

export interface SchedulerOptions {
  db?: Database.Database;
  generator?: OccurrenceGeneratorService;
  dispatcher?: PushDispatcherService;
  intervalMs?: number; // Padrão: 30000 (30 segundos)
  horizonDays?: number; // Padrão: 2 (hoje e amanhã)
  logger?: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
}

export interface SchedulerCycleResult {
  cycleId: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  generatorResult?: GenerateOccurrencesResult;
  dispatcherResult?: DispatchBatchResult;
  skippedOverlapping?: boolean;
  error?: string;
}

export class SchedulerService {
  private db: Database.Database;
  private generator: OccurrenceGeneratorService;
  private dispatcher: PushDispatcherService;
  private intervalMs: number;
  private horizonDays: number;
  private logger: NonNullable<SchedulerOptions['logger']>;

  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isCycleRunning = false;
  private isShuttingDown = false;
  private cycleCounter = 0;
  private activeCyclePromise: Promise<SchedulerCycleResult | null> | null = null;

  constructor(options?: SchedulerOptions) {
    this.db = options?.db || getDatabase();
    this.generator = options?.generator || new OccurrenceGeneratorService(this.db);
    this.dispatcher = options?.dispatcher || new PushDispatcherService({ db: this.db });
    this.intervalMs = options?.intervalMs ?? 30000;
    this.horizonDays = options?.horizonDays ?? 2;
    this.logger = options?.logger || {
      info: (msg, ...args) => console.log(`[Scheduler] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[Scheduler] ⚠️ ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[Scheduler] ❌ ${msg}`, ...args),
    };
  }

  /**
   * Inicia o agendador contínuo em segundo plano.
   * Executa o ciclo inicial imediatamente e configura o ticker a cada `intervalMs`.
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Tentativa de iniciar scheduler que já está em execução.');
      return;
    }

    this.isRunning = true;
    this.isShuttingDown = false;
    this.logger.info(`Iniciado com ticker a cada ${this.intervalMs / 1000}s (horizonte: ${this.horizonDays} dias).`);

    // Executa o primeiro ciclo em segundo plano logo no início
    this.runCycle().catch((err) => {
      this.logger.error('Erro no ciclo inicial do scheduler:', err);
    });

    // Configura o ticker periódico
    this.timer = setInterval(() => {
      if (!this.isRunning || this.isShuttingDown) return;
      this.runCycle().catch((err) => {
        this.logger.error('Erro não tratado no ciclo periódico:', err);
      });
    }, this.intervalMs);

    // Desassocia do loop de eventos para não prender encerramentos em scripts/testes
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Executa um único ciclo do scheduler:
   * 1. Previne execuções sobrepostas (overlap protection).
   * 2. Geração de ocorrências para hoje e amanhã (resiliente).
   * 3. Despacho das ocorrências elegíveis cujo instante UTC chegou (resiliente).
   * 4. Log estruturado com tempos e estatísticas.
   */
  async runCycle(): Promise<SchedulerCycleResult | null> {
    if (this.isCycleRunning) {
      this.logger.warn('Ciclo anterior ainda em andamento. Ciclo sobreposto ignorado.');
      return {
        cycleId: this.cycleCounter,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        skippedOverlapping: true,
      };
    }

    if (this.isShuttingDown) {
      return null;
    }

    this.isCycleRunning = true;
    const cycleId = ++this.cycleCounter;
    const startMs = Date.now();
    const startedAt = new Date(startMs).toISOString();

    const currentPromise = (async (): Promise<SchedulerCycleResult> => {
      let genResult: GenerateOccurrencesResult | undefined;
      let dispResult: DispatchBatchResult | undefined;
      let cycleError: string | undefined;

      // 1. Etapa de Geração
      try {
        genResult = this.generator.generateOccurrences(this.horizonDays);
      } catch (err: any) {
        cycleError = `Falha na geração: ${err.message || String(err)}`;
        this.logger.error(`[Ciclo #${cycleId}] Erro ao gerar ocorrências:`, err);
      }

      // 2. Etapa de Despacho (executa mesmo se a geração reportou erro ou 0 geradas)
      try {
        dispResult = await this.dispatcher.dispatchEligibleOccurrences();
      } catch (err: any) {
        const dispErr = `Falha no despacho: ${err.message || String(err)}`;
        cycleError = cycleError ? `${cycleError} | ${dispErr}` : dispErr;
        this.logger.error(`[Ciclo #${cycleId}] Erro ao despachar ocorrências:`, err);
      }

      const endMs = Date.now();
      const finishedAt = new Date(endMs).toISOString();
      const durationMs = endMs - startMs;

      // Log estruturado: registra se houve trabalho ou a cada ciclo informativo
      if (genResult?.generatedCount || dispResult?.evaluatedCount || cycleError) {
        this.logger.info(
          `[Ciclo #${cycleId}] Concluído em ${durationMs}ms | Novas ocorrências: ${genResult?.generatedCount ?? 0} | Avaliadas p/ envio: ${dispResult?.evaluatedCount ?? 0} | Despachadas: ${dispResult?.dispatchedCount ?? 0} | Pushes enviados: ${dispResult?.totalPushSent ?? 0}${cycleError ? ` | Erros: ${cycleError}` : ''}`
        );
      }

      return {
        cycleId,
        startedAt,
        finishedAt,
        durationMs,
        generatorResult: genResult,
        dispatcherResult: dispResult,
        error: cycleError,
      };
    })();

    this.activeCyclePromise = currentPromise;

    try {
      return await currentPromise;
    } finally {
      this.isCycleRunning = false;
      this.activeCyclePromise = null;
    }
  }

  /**
   * Encerramento gracioso:
   * Limpa o timer, impede novos ciclos e aguarda o ciclo em andamento até timeoutMs.
   */
  async stop(timeoutMs: number = 5000): Promise<void> {
    this.isShuttingDown = true;
    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.isCycleRunning && this.activeCyclePromise) {
      this.logger.info(`Aguardando ciclo em andamento finalizar (timeout: ${timeoutMs}ms)...`);
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, timeoutMs));
      await Promise.race([this.activeCyclePromise, timeoutPromise]);
    }

    this.logger.info('Scheduler encerrado graciosamente.');
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getIsCycleRunning(): boolean {
    return this.isCycleRunning;
  }

  getCycleCount(): number {
    return this.cycleCounter;
  }
}
