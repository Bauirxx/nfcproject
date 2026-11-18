// Empacota o backend NestJS num único ficheiro executável (dist/server.cjs), com o pacote partilhado
// incluído. A injeção de dependências é explícita (`@Inject`), por isso não dependemos de `emitDecoratorMetadata`.
import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
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
    // Ligação nativa opcional do `pg` (usamos a implementação em JavaScript).
    'pg-native',
    // Módulo nativo: carregado de node_modules em runtime (binário da plataforma instalado pelo pnpm).
    'sharp',
  ],
};

await build({ ...shared, entryPoints: ['src/main.ts'], outfile: 'dist/server.cjs' });
// Worker isolada do processamento de imagens (regra 8): ficheiro à parte, lançado sem variáveis de ambiente.
await build({ ...shared, entryPoints: ['src/uploads/image-worker.ts'], outfile: 'dist/image-worker.cjs' });

console.log('Backend empacotado em dist/server.cjs e dist/image-worker.cjs');
