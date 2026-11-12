/// <reference types="vite/client" />

/**
 * Verdadeiro em desenvolvimento e no modo `e2e`, quando a API é simulada com MSW.
 * É uma constante de compilação definida em `vite.config.ts`, não uma variável `VITE_`.
 */
declare const __API_MOCKING__: boolean;
