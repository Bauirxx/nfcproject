import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuthGuard } from './common/auth.guard';
import { CoreModule } from './common/core.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, CoreModule, HealthModule, AuthModule],
  providers: [
    // Guard global: negar por defeito (CLAUDE.md, regra 2).
    { provide: APP_GUARD, useClass: AuthGuard },
    // Erros sempre no formato do contrato `{ error: { code } }`.
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
