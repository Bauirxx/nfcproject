import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import type { UploadPurpose } from '@nfc-business/shared/constants';
import { ENV, type Env } from '../config/env';
import { processImage } from './image-processing';

const WORKER_TIMEOUT_MS = 15_000;

/** Caminho da worker empacotada, ao lado de `dist/server.cjs` (esbuild.mjs). */
function workerPath(): string | null {
  const candidates = [
    typeof __dirname === 'string' ? join(__dirname, 'image-worker.cjs') : '',
    join(process.cwd(), 'dist', 'image-worker.cjs'),
    join(process.cwd(), 'apps', 'api', 'dist', 'image-worker.cjs'),
  ];
  return candidates.find((candidate) => candidate !== '' && existsSync(candidate)) ?? null;
}

/**
 * Processa imagens numa worker thread isolada: sem variáveis de ambiente (nenhum segredo chega ao código que
 * descodifica ficheiros enviados por utilizadores), com memória e tempo limitados, e uma worker por imagem.
 * Em produção a worker é obrigatória; em desenvolvimento e testes, sem o build, processa no próprio processo.
 */
@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger('ImageProcessor');
  private readonly production: boolean;

  constructor(@Inject(ENV) env: Env) {
    this.production = env.NODE_ENV === 'production';
  }

  async process(bytes: Uint8Array, purpose: UploadPurpose): Promise<Uint8Array> {
    const path = workerPath();
    if (!path) {
      if (this.production) throw new Error('image-worker.cjs em falta no build');
      this.logger.warn('Worker de imagens indisponível (desenvolvimento): a processar no próprio processo.');
      return this.fail(() => processImage(bytes, purpose));
    }
    return this.fail(() => this.inWorker(path, bytes, purpose));
  }

  private inWorker(path: string, bytes: Uint8Array, purpose: UploadPurpose): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path, {
        env: {},
        resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 64 },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error('tempo esgotado'));
      }, WORKER_TIMEOUT_MS);
      worker.once('message', (message: { ok: boolean; bytes?: Uint8Array }) => {
        clearTimeout(timer);
        void worker.terminate();
        if (message.ok && message.bytes) resolve(message.bytes);
        else reject(new Error('imagem inválida'));
      });
      worker.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.postMessage({ bytes, purpose });
    });
  }

  /** Qualquer falha de processamento é uma imagem inválida para o cliente (sem detalhes). */
  private async fail(work: () => Promise<Uint8Array>): Promise<Uint8Array> {
    try {
      return await work();
    } catch (error) {
      this.logger.warn(`Imagem recusada no processamento: ${error instanceof Error ? error.message : 'erro'}`);
      throw new UnprocessableEntityException({ error: { code: 'invalid_file' } });
    }
  }
}
