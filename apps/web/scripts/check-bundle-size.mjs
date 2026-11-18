// Orçamento do JavaScript inicial da página pública (RNF-FE-02, ADR-0003): abaixo de 100 KB comprimido (gzip).
// Soma o JavaScript que o index.html de produção carrega logo (script de entrada e modulepreload).
// O painel e os chunks carregados por import() ficam de fora, como previsto. Uso: depois de `pnpm build`.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_BYTES = 100 * 1024;
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

let html;
try {
  html = readFileSync(join(dist, 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html não existe: corra `pnpm --filter @nfc-business/web build` primeiro.');
  process.exit(1);
}

// Scripts de entrada e pré-carregamentos de módulos referenciados diretamente pelo HTML.
const pattern = /<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="([^"]+\.js)"/g;
const files = [...new Set([...html.matchAll(pattern)].map((match) => match[1]))];
if (files.length === 0) {
  console.error('Nenhum JavaScript inicial encontrado no index.html.');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const size = gzipSync(readFileSync(join(dist, file.replace(/^\//, '')))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}

const kb = (total / 1024).toFixed(1);
const budget = (BUDGET_BYTES / 1024).toFixed(0);
if (total > BUDGET_BYTES) {
  console.error(`FALHOU: JavaScript inicial ${kb} KB gzip, acima do orçamento de ${budget} KB.`);
  process.exit(1);
}
console.log(`OK: JavaScript inicial ${kb} KB gzip (orçamento ${budget} KB).`);
