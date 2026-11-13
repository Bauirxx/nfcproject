import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuthGuard } from './common/auth.guard';
import { SessionService } from './common/session.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule],
  providers: [
    SessionService,
    // Guard global: negar por defeito (CLAUDE.md, regra 2).
    { provide: APP_GUARD, useClass: AuthGuard },
    // Erros sempre no formato do contrato `{ error: { code } }`.
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
