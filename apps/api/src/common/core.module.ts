import { Global, Module } from '@nestjs/common';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { SessionService } from './session.service';

/** Serviços base disponíveis em toda a aplicação (sessão e ponte para o Supabase Auth). */
@Global()
@Module({
  providers: [SupabaseAuthService, SessionService],
  exports: [SupabaseAuthService, SessionService],
})
export class CoreModule {}
