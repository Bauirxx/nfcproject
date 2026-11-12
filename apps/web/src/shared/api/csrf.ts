// O token CSRF vive só em memória (ADR-0005): nunca em localStorage, sessionStorage nem cookies escritos pelo cliente.
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}
