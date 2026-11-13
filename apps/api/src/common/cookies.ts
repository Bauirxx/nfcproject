import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_COOKIE } from './session.service';

/** Cookie HttpOnly do refresh token, restrito a /api/auth (CLAUDE.md, regra 1). */
export const REFRESH_TOKEN_COOKIE = 'nfc_refresh';

const ACCESS_MAX_AGE = 15 * 60 * 1000; // 15 minutos
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias

function base(secure: boolean): CookieOptions {
  // HttpOnly, Secure e SameSite=Strict (CLAUDE.md, regra 1). Secure fica desligado em desenvolvimento (http local).
  return { httpOnly: true, secure, sameSite: 'strict' };
}

/** Grava os cookies da sessão: access token geral, refresh token restrito a /api/auth. */
export function setSessionCookies(res: Response, accessToken: string, refreshToken: string, secure: boolean): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...base(secure), path: '/', maxAge: ACCESS_MAX_AGE });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...base(secure), path: '/api/auth', maxAge: REFRESH_MAX_AGE });
}

/** Limpa os cookies da sessão (logout). */
export function clearSessionCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base(secure), path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base(secure), path: '/api/auth' });
}
