import { Global, Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { EmailService } from '../email/email.service';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { AlertService } from './alerts';
import { CsrfService } from './csrf';
import { RequestMonitor } from './request-monitor';
import { SessionService } from './session.service';

const SHARED = [
  SupabaseAuthService,
  SupabaseAdminService,
  SessionService,
  DatabaseService,
  CsrfService,
  AuditService,
  EmailService,
  AlertService,
  RequestMonitor,
];

/** Serviços base disponíveis em toda a aplicação (sessão, CSRF, Supabase, base de dados, email e alertas). */
@Global()
@Module({ providers: SHARED, exports: SHARED })
export class CoreModule {}
