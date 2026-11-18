// Único ponto do backend com a chave service_role (exceção isolada à regra 3, ADR-0017).
// Só expõe operações estreitas: convidar, mudar o papel, remover contas e (mais tarde) o Storage.
// Nunca devolve a chave nem o cliente; todas as chamadas são auditadas por quem as usa.
import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { MemberRole, Role } from '@nfc-business/shared/constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, type Env } from '../config/env';

export type InviteResult = { status: 'invited'; userId: string } | { status: 'already_exists' };

@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger('SupabaseAdmin');
  private readonly client: SupabaseClient | null;

  constructor(@Inject(ENV) env: Env) {
    this.client =
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }

  get configured(): boolean {
    return this.client !== null;
  }

  private admin(code = 'invites_unavailable'): SupabaseClient {
    if (!this.client) throw new ServiceUnavailableException({ error: { code } });
    return this.client;
  }

  /**
   * Convida por email (o Supabase envia o link de uso único para `redirectTo`) e grava o papel e a empresa no
   * `app_metadata`, que só o servidor pode escrever. Um email já registado não é convidado de novo.
   */
  async invite(email: string, role: MemberRole, companyId: string, redirectTo: string | null): Promise<InviteResult> {
    const admin = this.admin();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error || !data.user) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'email_exists' || error?.status === 422) return { status: 'already_exists' };
      this.logger.error(`Convite falhou: ${error?.message ?? 'sem utilizador'}`);
      throw new ServiceUnavailableException({ error: { code: 'invites_unavailable' } });
    }
    await this.setRole(data.user.id, role, companyId);
    return { status: 'invited', userId: data.user.id };
  }

  /** Papel e empresa no `app_metadata` (lidos em cada sessão; o cliente não os pode alterar). */
  async setRole(userId: string, role: Role, companyId: string | null): Promise<void> {
    const { error } = await this.admin().auth.admin.updateUserById(userId, {
      app_metadata: { role, company_id: companyId },
    });
    if (error) {
      this.logger.error(`Atualização do papel falhou: ${error.message}`);
      throw new ServiceUnavailableException({ error: { code: 'invites_unavailable' } });
    }
  }

  // Storage (regra 8): só o backend escreve; os buckets não têm políticas para anon/authenticated.

  /** Grava um objeto (sem substituir um existente: os nomes são gerados pelo sistema). */
  async putObject(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.admin('uploads_unavailable').storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
    if (error) {
      this.logger.error(`Storage: falha a gravar em ${bucket}: ${error.message}`);
      throw new ServiceUnavailableException({ error: { code: 'uploads_unavailable' } });
    }
  }

  /** Apaga objetos (por exemplo, o original da quarentena depois do processamento). Falhas só ficam no log. */
  async removeObjects(bucket: string, paths: string[]): Promise<void> {
    const { error } = await this.admin('uploads_unavailable').storage.from(bucket).remove(paths);
    if (error) this.logger.warn(`Storage: falha a apagar de ${bucket}: ${error.message}`);
  }

  /** Remove a conta (as sessões terminam; `app.users` é apagado em cascata). */
  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.admin().auth.admin.deleteUser(userId);
    if (error) {
      this.logger.error(`Remoção falhou: ${error.message}`);
      throw new ServiceUnavailableException({ error: { code: 'invites_unavailable' } });
    }
  }
}
