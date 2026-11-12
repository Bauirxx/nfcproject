// Dados fictícios da API simulada: só existem em desenvolvimento, nos testes e no build de e2e.
// Não são credenciais reais (domínios .test) e nunca chegam ao build de produção.
// Sem dependências: também é importado pelos testes de ponta a ponta, que correm em Node.

export const MOCK_USERS = {
  platformAdmin: { email: 'admin@nfcbusiness.test', password: 'Plataforma#2026', totpSecret: 'JBSWY3DPEHPK3PXP' },
  companyAdmin: { email: 'ana.admin@acme.test', password: 'Empresa#2026ok', totpSecret: 'KRSXG5CTMVRXEZLU' },
  editor: { email: 'edu.editor@acme.test', password: 'Editor#2026okay', totpSecret: null },
  owner: { email: 'paula.owner@acme.test', password: 'Perfil#2026okay', totpSecret: null },
  /** Administrador que ainda não configurou a verificação em dois passos. */
  newAdmin: { email: 'novo.admin@beta.test', password: 'Empresa#2026ok', totpSecret: null },
} as const;

export type MockUserKey = keyof typeof MOCK_USERS;

/** Um código de recuperação de uso único por conta com verificação em dois passos. */
export const MOCK_RECOVERY_CODES = {
  platformAdmin: 'NFCBP-M3T5W',
  companyAdmin: 'NFCBA-K7Q2M',
} as const;

export const MOCK_TOKENS = {
  /** Cartão ativo da Paula: página pública em /c/<token>. */
  activeCard: 'Zk3vQ9xLr2TnB7wYc1HdMg',
  blockedCard: 'Bl0ckedCardT0ken000001',
  ownerSlug: 'paula-machava',
  /** Link de recuperação válido da Paula: /definir-password?token=<token>. */
  reset: 'mock-reset-token-0001',
  /** Convite pendente: /convite?token=<token>. */
  invite: 'mock-invite-token-0001',
} as const;

/** Passwords recusadas pela API simulada como «expostas em fugas de dados». */
export const MOCK_BREACHED_PASSWORDS: readonly string[] = ['password1234', '123456789012', 'qwertyuiop12'];
