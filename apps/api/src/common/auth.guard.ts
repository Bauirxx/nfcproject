import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_WITHOUT_MFA_KEY } from './mfa.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SessionService, type ResolvedSession, type SessionUser } from './session.service';

export interface AuthedRequest extends Request {
  user?: SessionUser;
  session?: ResolvedSession;
}

/**
 * Guard global com negar por defeito (CLAUDE.md, regras 1 e 2):
 * - só as rotas `@Public()` respondem sem sessão;
 * - uma sessão com o segundo fator por verificar não conta como sessão (401);
 * - um administrador sem MFA configurado só chega às rotas `@AllowWithoutMfa()` (403 `mfa_setup_required`).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const session = await this.sessions.resolve(request);
    if (!session || session.mfaPending) throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
    if (session.mfaSetupRequired && !this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_MFA_KEY, targets)) {
      throw new ForbiddenException({ error: { code: 'mfa_setup_required' } });
    }
    request.user = session.user;
    request.session = session;
    return true;
  }
}
