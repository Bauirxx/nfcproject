import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { loginRequestSchema, type LoginRequest } from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { clearSessionCookies, setSessionCookies } from '../common/cookies';
import { Public } from '../common/public.decorator';
import { SessionService, type SessionUser } from '../common/session.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';

/** Autenticação por BFF (CLAUDE.md, regra 1): o backend chama o Supabase Auth e guarda a sessão em cookies HttpOnly. */
@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly sessions: SessionService,
    @Inject(ENV) env: Env,
  ) {
    this.secure = env.NODE_ENV !== 'development';
  }

  @Public()
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: 'authenticated'; user: SessionUser }> {
    const result = await this.supabaseAuth.signIn(body.email, body.password);
    if (!result) throw new UnauthorizedException({ error: { code: 'invalid_credentials' } });
    setSessionCookies(res, result.accessToken, result.refreshToken, this.secure);
    return { status: 'authenticated', user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookies(res, this.secure);
  }

  // Sessão atual: anónimos recebem `user: null` com estado 200 (ADR-0005).
  @Public()
  @Get('session')
  async session(@Req() req: Request): Promise<{ user: SessionUser | null }> {
    return { user: await this.sessions.getUser(req) };
  }
}
