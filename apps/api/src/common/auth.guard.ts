import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SessionService, type SessionUser } from './session.service';

export interface AuthedRequest extends Request {
  user?: SessionUser;
}

/**
 * Guard global com negar por defeito (CLAUDE.md, regra 2; critério de saída da fase 1): só as rotas
 * marcadas com `@Public()` respondem sem sessão. As restantes exigem uma sessão válida.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.sessions.getUser(request);
    if (!user) throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
    request.user = user;
    return true;
  }
}
