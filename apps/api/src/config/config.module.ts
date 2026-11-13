import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './env';

/** Configuração validada, disponível em toda a aplicação pelo símbolo `ENV`. */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
