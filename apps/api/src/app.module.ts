import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuthGuard } from './common/auth.guard';
import { SessionService } from './common/session.service';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { SupabaseAuthService } from './supabase/supabase-auth.service';

@Module({
  imports: [ConfigModule, HealthModule],
  providers: [
    SupabaseAuthService,
    SessionService,
    // Guard global: negar por defeito (CLAUDE.md, regra 2).
    { provide: APP_GUARD, useClass: AuthGuard },
    // Erros sempre no formato do contrato `{ error: { code } }`.
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
