import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { publicEventRequestSchema, type PublicCard, type PublicEventRequest } from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { developmentIpSecret, hashIp } from '../common/ip-hash';
import { Public } from '../common/public.decorator';
import { enforceRateLimit, FixedWindowRateLimiter } from '../common/rate-limiter';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { PublicCardService, type PublicLookup, type PublicTarget } from './public-card.service';

/** 60 pedidos por minuto por IP nas rotas públicas (regra 4). */
export const PUBLIC_RATE_LIMIT = 60;
const CACHE_CONTROL = 'public, max-age=60';

/**
 * Rotas públicas, sem sessão (regras 4 e 6): página do cartão, VCF e eventos. Respostas em cache durante 60 s,
 * `noindex` por defeito e o mesmo 404 neutro para tudo o que não seja um cartão ativo.
 */
@Public()
@Controller('public')
export class PublicController {
  private readonly pageLimiter = new FixedWindowRateLimiter(PUBLIC_RATE_LIMIT, 60_000);
  private readonly eventLimiter = new FixedWindowRateLimiter(PUBLIC_RATE_LIMIT, 60_000);
  private readonly ipSecret: string;
  private readonly publicOrigin: string | null;

  constructor(
    @Inject(PublicCardService) private readonly cards: PublicCardService,
    @Inject(ENV) env: Env,
  ) {
    this.ipSecret = env.IP_HASH_SECRET ?? developmentIpSecret();
    this.publicOrigin = env.PUBLIC_APP_URL ?? null;
  }

  @Get('cards/:token')
  cardByToken(@Param('token') token: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.card({ token }, req, res);
  }

  @Get('cards/:token/contact.vcf')
  vcfByToken(@Param('token') token: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.vcf({ token }, req, res);
  }

  @Get('profiles/:slug')
  cardBySlug(@Param('slug') slug: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.card({ slug }, req, res);
  }

  @Get('profiles/:slug/contact.vcf')
  vcfBySlug(@Param('slug') slug: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.vcf({ slug }, req, res);
  }

  /** Lista fechada de eventos. Responde sempre 204, exista ou não o cartão, para não revelar nada. */
  @Post('events')
  @HttpCode(204)
  async event(
    @Body(new ZodValidationPipe(publicEventRequestSchema)) body: PublicEventRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    enforceRateLimit(this.eventLimiter, clientIp(req), res);
    res.setHeader('Cache-Control', 'no-store');
    const target = await this.cards.find('token' in body ? { token: body.token } : { slug: body.slug });
    if (target) await this.cards.recordEvent(target, body.type, hashIp(this.ipSecret, clientIp(req)));
  }

  private async card(lookup: PublicLookup, req: Request, res: Response): Promise<PublicCard> {
    const target = await this.resolve(lookup, req, res);
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return target.card;
  }

  private async vcf(lookup: PublicLookup, req: Request, res: Response): Promise<string> {
    const target = await this.resolve(lookup, req, res);
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    // O slug só tem [a-z0-9-] (isSlug), por isso é seguro no nome do ficheiro.
    res.setHeader('Content-Disposition', `attachment; filename="${target.slug}.vcf"`);
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return this.cards.buildVcf(target, this.publicOrigin);
  }

  private async resolve(lookup: PublicLookup, req: Request, res: Response): Promise<PublicTarget> {
    enforceRateLimit(this.pageLimiter, clientIp(req), res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const target = await this.cards.find(lookup);
    if (!target) {
      res.setHeader('Cache-Control', 'no-store');
      throw new NotFoundException({ error: { code: 'not_found' } });
    }
    return target;
  }
}

/** IP do cliente segundo o Express (respeita `trust proxy`, configurado no arranque). */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
