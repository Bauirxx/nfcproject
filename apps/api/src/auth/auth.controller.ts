import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import {
  loginRequestSchema,
  type LoginRequest,
  type LoginResponse,
  type SessionResponse,
} from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { clearSessionCookies, setSessionCookies } from '../common/cookies';
import { CsrfService } from '../common/csrf';
import { Public } from '../common/public.decorator';
import { SessionService } from '../common/session.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { readAal, SupabaseAuthService } from '../supabase/supabase-auth.service';

/** Autenticação por BFF (CLAUDE.md, regra 1): o backend chama o Supabase Auth e guarda a sessão em cookies HttpOnly. */
@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    @Inject(SupabaseAuthService) private readonly supabaseAuth: SupabaseAuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CsrfService) private readonly csrf: CsrfService,
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
  ): Promise<LoginResponse> {
    const result = await this.supabaseAuth.signIn(body.email, body.password);
    if (!result) throw new UnauthorizedException({ error: { code: 'invalid_credentials' } });
    setSessionCookies(res, result.accessToken, result.refreshToken, this.secure);
    const session = await this.sessions.toSession(result.identity, readAal(result.accessToken));
    if (session.mfaPending) return { status: 'mfa_required' };
    return { status: 'authenticated', user: session.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookies(res, this.secure);
  }

  /**
   * Sessão atual e token CSRF (contrato `sessionResponseSchema`, ADR-0005). Anónimos, ou sessões com o
   * segundo fator por verificar, recebem `user: null` com estado 200.
   */
  @Public()
  @Get('session')
  async session(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionResponse> {
    res.setHeader('Cache-Control', 'no-store');
    return { user: await this.sessions.getUser(req), csrfToken: this.csrf.tokenForRequest(req) };
  }
}
