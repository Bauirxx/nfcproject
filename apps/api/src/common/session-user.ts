/** Utilizador da sessão exposto aos handlers. O papel fica como `string` até à ligação do contrato partilhado. */
export interface SessionUser {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
}
