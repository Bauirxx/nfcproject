import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import {
  loginRequestSchema,
  type LoginRequest,
  type LoginResponse,
  type SessionResponse,
} from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { auditActorOf } from '../common/access';
import { clearSessionCookies, REFRESH_TOKEN_COOKIE, setSessionCookies } from '../common/cookies';
import { CsrfService } from '../common/csrf';
import { Public } from '../common/public.decorator';
import { readCookie, SessionService } from '../common/session.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { readAal, SupabaseAuthService } from '../supabase/supabase-auth.service';
import { AuditService } from '../audit/audit.service';
import { enforceRateLimit, FixedWindowRateLimiter } from '../common/rate-limiter';
import { clientIp } from '../public/public.controller';

/** Tentativas de login por minuto, por IP e por email (CLAUDE.md, regra 1). */
export const LOGIN_ATTEMPTS_PER_MINUTE = 5;

/** Autenticação por BFF (CLAUDE.md, regra 1): o backend chama o Supabase Auth e guarda a sessão em cookies HttpOnly. */
@Controller('auth')
export class AuthController {
  private readonly secure: boolean;
  private readonly loginAttempts = new FixedWindowRateLimiter(LOGIN_ATTEMPTS_PER_MINUTE, 60_000);

  constructor(
    @Inject(SupabaseAuthService) private readonly supabaseAuth: SupabaseAuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ENV) env: Env,
  ) {
    this.secure = env.NODE_ENV !== 'development';
  }

  /**
   * Login. Com MFA ativo, a sessão fica a meio (aal1) e a resposta é `mfa_required`: só depois de verificar
   * o segundo fator há sessão (regra 1). Respostas no contrato `loginResponseSchema`.
   */
  @Public()
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<LoginResponse> {
    // 5 tentativas por minuto por IP e por email (regra 1); a mensagem é sempre genérica.
    enforceRateLimit(this.loginAttempts, `ip:${clientIp(req)}`, res);
    enforceRateLimit(this.loginAttempts, `email:${body.email.toLowerCase()}`, res);
    const result = await this.supabaseAuth.signIn(body.email, body.password);
    if (!result) {
      // Só o email tentado (nunca a palavra-passe); sem empresa, porque o autor não está identificado.
      await this.audit.record({
        action: 'auth.login_failed',
        actor: { id: null, name: '', email: body.email, companyId: null, isPlatformAdmin: false },
      });
      throw new UnauthorizedException({ error: { code: 'invalid_credentials' } });
    }
    setSessionCookies(res, result.accessToken, result.refreshToken, this.secure);
    const session = await this.sessions.toSession(result.identity, readAal(result.accessToken));
    if (session.mfaPending) return { status: 'mfa_required' };
    await this.audit.record({
      action: 'auth.login',
      actor: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        companyId: session.user.companyId,
        isPlatformAdmin: session.user.role === 'platform_admin',
      },
    });
    return { status: 'authenticated', user: session.user };
  }

  /** Termina a sessão: revoga-a no Supabase (o refresh token deixa de servir), regista e apaga os cookies. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const accessToken = this.sessions.accessToken(req);
    const refreshToken = readCookie(req.headers.cookie, REFRESH_TOKEN_COOKIE);
    if (accessToken && refreshToken) {
      const user = await this.sessions.getUser(req);
      await this.supabaseAuth.revoke({ accessToken, refreshToken });
      if (user) await this.audit.record({ action: 'auth.logout', actor: auditActorOf(user) });
    }
    clearSessionCookies(res, this.secure);
  }

  /**
   * Renova a sessão com o refresh token (cookie HttpOnly restrito a /api/auth, ADR-0005). O Supabase roda o
   * refresh token e mantém o nível de garantia (aal). Sem refresh token válido: 401 e os cookies são apagados.
   */
  @Public()
  @Post('refresh')
  @HttpCode(204)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = readCookie(req.headers.cookie, REFRESH_TOKEN_COOKIE);
    const result = refreshToken ? await this.supabaseAuth.refresh(refreshToken) : null;
    if (!result) {
      clearSessionCookies(res, this.secure);
      throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
    }
    setSessionCookies(res, result.accessToken, result.refreshToken, this.secure);
  }

  /**
   * Sessão atual e token CSRF (contrato `sessionResponseSchema`, ADR-0005). Anónimos, ou sessões com o
   * segundo fator por verificar, recebem `user: null` com estado 200.
   */
  @Public()
  @Get('session')
  async session(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionResponse> {
    res.setHeader('Cache-Control', 'no-store');
    const user = await this.sessions.getUser(req);
    const response: SessionResponse = { user, csrfToken: this.csrf.tokenForRequest(req) };
    // Sem sessão mas com refresh token: o cliente deve renovar (ADR-0005).
    if (!user && readCookie(req.headers.cookie, REFRESH_TOKEN_COOKIE)) response.refreshable = true;
    return response;
  }
}
