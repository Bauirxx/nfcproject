import { defineConfig } from 'vitest/config';

// Testes unitários do backend em Node. O transformador do Vitest lê `experimentalDecorators` do `tsconfig.json`;
// os testes instanciam as classes diretamente, por isso não dependem do contentor de injeção do NestJS.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
