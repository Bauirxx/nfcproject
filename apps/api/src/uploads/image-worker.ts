// Worker isolada do processamento de imagens (regra 8): é lançada com `env: {}` (sem segredos) e com limites de
// memória. Recebe um pedido, processa e responde; qualquer erro volta como mensagem genérica.
import { parentPort } from 'node:worker_threads';
import type { UploadPurpose } from '@nfc-business/shared/constants';
import { processImage } from './image-processing';

interface WorkerRequest {
  bytes: Uint8Array;
  purpose: UploadPurpose;
}

parentPort?.on('message', (request: WorkerRequest) => {
  processImage(request.bytes, request.purpose)
    .then((output) => parentPort?.postMessage({ ok: true, bytes: output }, [output.buffer as ArrayBuffer]))
    .catch(() => parentPort?.postMessage({ ok: false }));
});
