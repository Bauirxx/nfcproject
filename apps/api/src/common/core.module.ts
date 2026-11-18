import { Global, Module } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { SessionService } from './session.service';

/** Serviços base disponíveis em toda a aplicação (sessão, Supabase Auth e base de dados). */
@Global()
@Module({
  providers: [SupabaseAuthService, SessionService, DatabaseService],
  exports: [SupabaseAuthService, SessionService, DatabaseService],
})
export class CoreModule {}
