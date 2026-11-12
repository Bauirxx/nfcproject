import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Política que o alojamento deve aplicar em produção (ADR-0006). O `vite preview` aplica-a
// para que os testes de ponta a ponta falhem se o código deixar de ser compatível.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const mswWorkerFile = fileURLToPath(new URL('./mocks-static/mockServiceWorker.js', import.meta.url));

// O service worker do MSW fica fora de `public/` para nunca ser copiado para o build de produção.
function mswWorker(enabled: boolean): Plugin {
  return {
    name: 'nfc-business:msw-worker',
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(readFileSync(mswWorkerFile));
      });
    },
    generateBundle() {
      if (!enabled) return;
      this.emitFile({ type: 'asset', fileName: 'mockServiceWorker.js', source: readFileSync(mswWorkerFile) });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Prefixo vazio: estas variáveis só são lidas aqui, em Node. Ao browser só chegariam as VITE_, que não usamos.
  const env = loadEnv(mode, rootDir, '');
  const apiMocking = mode === 'e2e' || (mode === 'development' && env.API_MOCKING !== 'false');

  return {
    plugins: [react(), tailwindcss(), mswWorker(apiMocking)],
    define: {
      __API_MOCKING__: JSON.stringify(apiMocking),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: apiMocking
        ? undefined
        : { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3000', changeOrigin: false } },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      headers: {
        'Content-Security-Policy': CONTENT_SECURITY_POLICY,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      restoreMocks: true,
    },
  };
});
