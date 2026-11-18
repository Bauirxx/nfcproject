import type { Role } from '@nfc-business/shared/constants';
import type { SessionUser as ContractSessionUser } from '@nfc-business/shared/schemas';

/** Utilizador da sessão exposto ao cliente: exatamente o contrato partilhado (`sessionUserSchema`). */
export type SessionUser = ContractSessionUser;

/** Identidade lida do Supabase Auth, antes de completar com o nome da empresa. */
export interface AuthIdentity {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  /** Tem um fator TOTP verificado no Supabase. */
  mfaEnabled: boolean;
}

/** Nível de garantia da autenticação do Supabase: `aal2` depois de verificar o segundo fator. */
export type AuthAssurance = 'aal1' | 'aal2';

/** Sessão resolvida no servidor a partir do cookie (nunca a partir de dados do cliente). */
export interface ResolvedSession {
  user: SessionUser;
  aal: AuthAssurance;
  /** Tem MFA ativo mas ainda não o verificou nesta sessão: não conta como sessão (regra 1). */
  mfaPending: boolean;
  /** Papel que exige MFA (administradores) sem MFA configurado: só pode configurá-lo. */
  mfaSetupRequired: boolean;
}
