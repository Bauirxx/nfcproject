import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  accountUpdateRequestSchema,
  passwordChangeRequestSchema,
  type AccountUpdateRequest,
  type AuthSessionList,
  type PasswordChangeRequest,
  type SessionUser,
} from '@nfc-business/shared/schemas';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { auditActorOf, requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import { isBreachedPassword } from '../common/breached-password';
import { clearSessionCookies, REFRESH_TOKEN_COOKIE } from '../common/cookies';
import { enforceRateLimit, FixedWindowRateLimiter } from '../common/rate-limiter';
import { readCookie, SessionService } from '../common/session.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { readAal, SupabaseAuthService, type SessionTokens } from '../supabase/supabase-auth.service';

/** Resumo do dispositivo a partir do User-Agent, por exemplo «Chrome em Android» (sem guardar o User-Agent). */
export function describeDevice(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'dispositivo desconhecido';
  return `${browser} em ${os}`;
}

/** Instante de emissão (`iat`) do access token, para a data da sessão atual. */
function issuedAt(accessToken: string): string {
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { iat?: number };
    if (typeof claims.iat === 'number') return new Date(claims.iat * 1000).toISOString();
  } catch {
    // Token sem claims legíveis: usa a hora atual.
  }
  return new Date().toISOString();
}

/** Conta do próprio utilizador (ecrã «Conta»): nome, palavra-passe e sessões. */
@Controller('auth')
export class AccountController {
  private readonly secure: boolean;
  private readonly passwordAttempts = new FixedWindowRateLimiter(5, 60_000);

  constructor(
    @Inject(SupabaseAuthService) private readonly supabaseAuth: SupabaseAuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ENV) env: Env,
  ) {
    this.secure = env.NODE_ENV !== 'development';
  }

  @Patch('account')
  async updateAccount(
    @Body(new ZodValidationPipe(accountUpdateRequestSchema)) body: AccountUpdateRequest,
    @Req() req: AuthedRequest,
  ): Promise<SessionUser> {
    requirePermission(req, 'account.manage');
    const tokens = this.tokens(req);
    if (!(await this.supabaseAuth.updateName(tokens, body.name))) {
      throw new ServiceUnavailableException({ error: { code: 'account_unavailable' } });
    }
    const identity = await this.supabaseAuth.getUser(tokens.accessToken);
    if (!identity) throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
    return (await this.sessions.toSession(identity, readAal(tokens.accessToken))).user;
  }

  /** Muda a palavra-passe: confirma a atual, exige 12+ caracteres (schema) e recusa as vazadas (regra 1). */
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @Body(new ZodValidationPipe(passwordChangeRequestSchema)) body: PasswordChangeRequest,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = requirePermission(req, 'account.manage');
    enforceRateLimit(this.passwordAttempts, `user:${user.id}`, res);
    if (!(await this.supabaseAuth.checkPassword(user.email, body.currentPassword))) {
      throw new UnprocessableEntityException({ error: { code: 'invalid_current_password' } });
    }
    if (await isBreachedPassword(body.newPassword)) {
      throw new UnprocessableEntityException({ error: { code: 'weak_password' } });
    }
    if (!(await this.supabaseAuth.updatePassword(this.tokens(req), body.newPassword))) {
      throw new UnprocessableEntityException({ error: { code: 'weak_password' } });
    }
    await this.audit.record({ action: 'auth.password_changed', actor: auditActorOf(user) });
  }

  /**
   * Sessões ativas. O Supabase só lista as sessões de um utilizador pela API de administração (service_role,
   * proibida em runtime pela regra 3), por isso devolve-se a sessão atual. «Terminar todas» revoga todas.
   */
  @Get('sessions')
  listSessions(@Req() req: AuthedRequest): AuthSessionList {
    requirePermission(req, 'account.manage');
    const { accessToken } = this.tokens(req);
    const createdAt = issuedAt(accessToken);
    return {
      items: [
        {
          id: 'current',
          device: describeDevice(req.headers['user-agent']),
          createdAt,
          lastSeenAt: new Date().toISOString(),
          current: true,
        },
      ],
    };
  }

  /** Termina todas as sessões, incluindo a atual. */
  @Delete('sessions')
  @HttpCode(204)
  async revokeSessions(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const user = requirePermission(req, 'account.manage');
    if (!(await this.supabaseAuth.revokeAll(this.tokens(req)))) {
      throw new ServiceUnavailableException({ error: { code: 'account_unavailable' } });
    }
    await this.audit.record({ action: 'auth.sessions_revoked', actor: auditActorOf(user) });
    clearSessionCookies(res, this.secure);
  }

  private tokens(req: AuthedRequest): SessionTokens {
    const accessToken = this.sessions.accessToken(req);
    const refreshToken = readCookie(req.headers.cookie, REFRESH_TOKEN_COOKIE);
    if (!accessToken || !refreshToken) throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
    return { accessToken, refreshToken };
  }
}
