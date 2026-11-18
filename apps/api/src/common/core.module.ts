import { Global, Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { CsrfService } from './csrf';
import { SessionService } from './session.service';

/** Serviços base disponíveis em toda a aplicação (sessão, CSRF, Supabase Auth e base de dados). */
@Global()
@Module({
  providers: [SupabaseAuthService, SupabaseAdminService, SessionService, DatabaseService, CsrfService, AuditService],
  exports: [SupabaseAuthService, SupabaseAdminService, SessionService, DatabaseService, CsrfService, AuditService],
})
export class CoreModule {}
