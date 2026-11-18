// Proteção CSRF (CLAUDE.md, regra 7): além do SameSite=Strict, os pedidos que alteram dados têm de trazer
// o cabeçalho X-CSRF-Token e, quando a origem pública está configurada, um cabeçalho Origin igual a ela.
// O token é um HMAC ligado ao access token do cookie (ou à ausência de sessão): não é guardado em lado nenhum
// e muda quando a sessão muda. O cliente obtém-no em GET /api/auth/session (ADR-0005).
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env';
import { developmentIpSecret } from './ip-hash';
import { ACCESS_TOKEN_COOKIE, readCookie } from './session.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfService {
  private readonly secret: string;
  readonly allowedOrigin: string | null;

  constructor(@Inject(ENV) env: Env) {
    // Separação de domínio: o mesmo segredo de servidor, com um prefixo próprio para o CSRF.
    this.secret = `csrf:${env.IP_HASH_SECRET ?? developmentIpSecret()}`;
    this.allowedOrigin = env.PUBLIC_APP_URL ?? null;
  }

  /** Token para o access token dado (ou para quem ainda não tem sessão). */
  tokenFor(accessToken: string | null): string {
    return createHmac('sha256', this.secret).update(accessToken ?? 'anonymous').digest('base64url');
  }

  /** Token esperado para o pedido, a partir do cookie de sessão. */
  tokenForRequest(request: Request): string {
    return this.tokenFor(readCookie(request.headers.cookie, ACCESS_TOKEN_COOKIE));
  }

  /** Comparação em tempo constante do token recebido com o esperado. */
  isValid(request: Request): boolean {
    const received = request.headers['x-csrf-token'];
    if (typeof received !== 'string' || received === '') return false;
    const expected = Buffer.from(this.tokenForRequest(request));
    const actual = Buffer.from(received);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

/** Guard global: aplica-se a todos os pedidos que alteram dados, públicos ou não. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(CsrfService) private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (this.csrf.allowedOrigin && request.headers.origin !== this.csrf.allowedOrigin) {
      throw new ForbiddenException({ error: { code: 'origin_invalid' } });
    }
    if (!this.csrf.isValid(request)) throw new ForbiddenException({ error: { code: 'csrf_invalid' } });
    return true;
  }
}
