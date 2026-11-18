import { Global, Module } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { CsrfService } from './csrf';
import { SessionService } from './session.service';

/** Serviços base disponíveis em toda a aplicação (sessão, CSRF, Supabase Auth e base de dados). */
@Global()
@Module({
  providers: [SupabaseAuthService, SessionService, DatabaseService, CsrfService],
  exports: [SupabaseAuthService, SessionService, DatabaseService, CsrfService],
})
export class CoreModule {}
