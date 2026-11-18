import { defineConfig } from 'vitest/config';

// Testes unitários do backend em Node. O transformador do Vitest lê `experimentalDecorators` do `tsconfig.json`;
// os testes instanciam as classes diretamente, por isso não dependem do contentor de injeção do NestJS.
// Com DB_INTEGRATION=1 os ficheiros correm um de cada vez: os testes de integração partilham a base de dados real.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    fileParallelism: process.env.DB_INTEGRATION !== '1',
    // Cada consulta à base de dados real faz uma ida e volta ao pooler: os testes de integração precisam de mais tempo.
    testTimeout: process.env.DB_INTEGRATION === '1' ? 60_000 : 5_000,
  },
});
