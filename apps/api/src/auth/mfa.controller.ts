import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  mfaConfirmRequestSchema,
  mfaDisableRequestSchema,
  mfaVerifyRequestSchema,
  type MfaConfirmRequest,
  type MfaConfirmResponse,
  type MfaDisableRequest,
  type MfaSetupResponse,
  type MfaVerifyRequest,
  type MfaVerifyResponse,
} from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import type { AuthedRequest } from '../common/auth.guard';
import { REFRESH_TOKEN_COOKIE, setSessionCookies } from '../common/cookies';
import { AllowWithoutMfa } from '../common/mfa.decorator';
import { Public } from '../common/public.decorator';
import { enforceRateLimit, FixedWindowRateLimiter } from '../common/rate-limiter';
import { readCookie, SessionService, type SessionUser } from '../common/session.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { clientIp } from '../public/public.controller';
import { readAal, SupabaseAuthService, type SessionTokens } from '../supabase/supabase-auth.service';

/** 5 tentativas de código por minuto por utilizador e por IP (ADR-0004, segundo passo). */
export const MFA_ATTEMPTS_PER_MINUTE = 5;

/**
 * MFA por TOTP com o Supabase (CLAUDE.md, regra 1; ADR-0016). Sem códigos de recuperação: quem perde a
 * aplicação pede a reposição a um administrador. Respostas e erros iguais ao contrato da API simulada.
 */
@Controller('auth/mfa')
export class MfaController {
  private readonly secure: boolean;
  private readonly attempts = new FixedWindowRateLimiter(MFA_ATTEMPTS_PER_MINUTE, 60_000);

  constructor(
    @Inject(SupabaseAuthService) private readonly supabaseAuth: SupabaseAuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ENV) env: Env,
  ) {
    this.secure = env.NODE_ENV !== 'development';
  }

  /** Inicia a configuração: segredo e URI otpauth. Disponível a administradores ainda sem MFA. */
  @AllowWithoutMfa()
  @Post('setup')
  async setup(@Req() req: AuthedRequest): Promise<MfaSetupResponse> {
    const user = this.requireUser(req);
    if (user.mfaEnabled) throw new ConflictException({ error: { code: 'mfa_already_enabled' } });
    const result = await this.supabaseAuth.enrollTotp(this.tokens(req));
    if (!result) throw new ServiceUnavailableException({ error: { code: 'mfa_unavailable' } });
    return result;
  }

  /** Confirma o fator com um código: o MFA fica ativo e a sessão sobe a aal2. */
  @AllowWithoutMfa()
  @Post('confirm')
  async confirm(
    @Body(new ZodValidationPipe(mfaConfirmRequestSchema)) body: MfaConfirmRequest,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MfaConfirmResponse> {
    const user = this.requireUser(req);
    if (user.mfaEnabled) throw new ConflictException({ error: { code: 'mfa_already_enabled' } });
    this.limit(req, user.id, res);
    const result = await this.supabaseAuth.verifyTotp(this.tokens(req), body.code, 'pending');
    if (!result) throw new UnprocessableEntityException({ error: { code: 'invalid_code' } });
    setSessionCookies(res, result.accessToken, result.refreshToken, this.secure);
    const session = await this.sessions.toSession(result.identity, readAal(result.accessToken));
    await this.audit.record({ action: 'auth.mfa_enabled', actor: actorOf(session.user) });
    return { user: session.user };
  }

  /**
   * Segundo passo do login. É `@Public()` porque uma sessão aal1 com MFA ativo ainda não é sessão;
   * exige os cookies desse login a meio e um código válido.
   */
  @Public()
  @Post('verify')
  async verify(
    @Body(new ZodValidationPipe(mfaVerifyRequestSchema)) body: MfaVerifyRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MfaVerifyResponse> {
    const pending = await this.sessions.resolve(req);
    const tokens = this.tokens(req);
    if (!pending || !pending.user.mfaEnabled) {
      throw new UnauthorizedException({ error: { code: 'mfa_challenge_expired' } });
    }
    this.limit(req, pending.user.id, res);
    const result = await this.supabaseAuth.verifyTotp(tokens, body.code, 'verified');
    if (!result) {
      await this.audit.record({
        action: 'auth.login_failed',
        actor: actorOf(pending.user),
        metadata: { step: 'mfa' },
      });
      throw new UnauthorizedException({ error: { code: 'invalid_code' } });
    }
    setSessionCookies(res, result.accessToken, result.refreshToken, this.secure);
    const session = await this.sessions.toSession(result.identity, readAal(result.accessToken));
    await this.audit.record({ action: 'auth.login', actor: actorOf(session.user), metadata: { mfa: true } });
    return { user: session.user };
  }

  /** Desativa o MFA (só papéis que não o exigem), confirmando a palavra-passe atual. */
  @Post('disable')
  @HttpCode(204)
  async disable(
    @Body(new ZodValidationPipe(mfaDisableRequestSchema)) body: MfaDisableRequest,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = this.requireUser(req);
    if (user.mfaRequired) throw new ForbiddenException({ error: { code: 'mfa_required_for_role' } });
    this.limit(req, user.id, res);
    if (!(await this.supabaseAuth.checkPassword(user.email, body.password))) {
      throw new UnprocessableEntityException({ error: { code: 'invalid_current_password' } });
    }
    if (!user.mfaEnabled) throw new ConflictException({ error: { code: 'mfa_not_enabled' } });
    if (!(await this.supabaseAuth.unenrollTotp(this.tokens(req)))) {
      throw new ServiceUnavailableException({ error: { code: 'mfa_unavailable' } });
    }
  }

  private requireUser(req: AuthedRequest): SessionUser {
    if (!req.user) throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
    return req.user;
  }

  /** Tokens da sessão a partir dos cookies (o refresh token só existe em /api/auth). */
  private tokens(req: Request): SessionTokens {
    const accessToken = this.sessions.accessToken(req);
    const refreshToken = readCookie(req.headers.cookie, REFRESH_TOKEN_COOKIE);
    if (!accessToken || !refreshToken) throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
    return { accessToken, refreshToken };
  }

  private limit(req: Request, userId: string, res: Response): void {
    enforceRateLimit(this.attempts, `user:${userId}`, res);
    enforceRateLimit(this.attempts, `ip:${clientIp(req)}`, res);
  }
}

function actorOf(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyId: user.companyId,
    isPlatformAdmin: user.role === 'platform_admin',
  };
}
