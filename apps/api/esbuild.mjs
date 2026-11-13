// Empacota o backend NestJS num único ficheiro executável (dist/server.cjs), com o pacote partilhado
// incluído. A injeção de dependências é explícita (`@Inject`), por isso não dependemos de `emitDecoratorMetadata`.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/server.cjs',
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
  // Dependências opcionais que o NestJS carrega só se existirem (não as usamos): ficam de fora do pacote.
  external: [
    '@nestjs/microservices',
    '@nestjs/websockets',
    '@nestjs/websockets/socket-module',
    '@nestjs/platform-socket.io',
    'class-transformer',
    'class-transformer/storage',
    'class-validator',
    'cache-manager',
    '@fastify/static',
  ],
});

console.log('Backend empacotado em dist/server.cjs');
