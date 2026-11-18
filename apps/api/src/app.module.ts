import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuthGuard } from './common/auth.guard';
import { CoreModule } from './common/core.module';
import { CsrfGuard } from './common/csrf';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [ConfigModule, CoreModule, HealthModule, AuthModule, PublicModule],
  providers: [
    // CSRF primeiro (regra 7): Origin e X-CSRF-Token em todos os pedidos que alteram dados.
    { provide: APP_GUARD, useClass: CsrfGuard },
    // Guard global: negar por defeito e MFA obrigatório para administradores (regras 1 e 2).
    { provide: APP_GUARD, useClass: AuthGuard },
    // Erros sempre no formato do contrato `{ error: { code } }`.
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
