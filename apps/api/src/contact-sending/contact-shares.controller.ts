import { Body, Controller, Get, Inject, Post, Query, Req, Res } from '@nestjs/common';
import {
  contactShareListQuerySchema,
  contactShareRequestSchema,
  type ContactShare,
  type ContactSharePage,
  type ContactShareRequest,
} from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { auditActorOf, requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import { SkipCsrf } from '../common/csrf';
import { Public } from '../common/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { escapeHtml } from '../email/email.service';
import { ContactSendingService } from './contact-sending.service';

type ContactShareListQuery = z.output<typeof contactShareListQuerySchema>;

/** Envio de contacto pelo painel e pela página pública do dono (sempre autenticado, `contact.send`). */
@Controller('contact-shares')
export class ContactSharesController {
  constructor(
    @Inject(ContactSendingService) private readonly sending: ContactSendingService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Post()
  async send(
    @Body(new ZodValidationPipe(contactShareRequestSchema)) body: ContactShareRequest,
    @Req() req: AuthedRequest,
  ): Promise<ContactShare> {
    const user = requirePermission(req, 'contact.send');
    const { share, profileName } = await this.sending.send(user, body);
    // Na auditoria fica o perfil e o canal; o destinatário fica só mascarado na tabela de envios.
    await this.audit.record({
      action: 'contact.sent',
      actor: auditActorOf(user),
      target: profileName,
      metadata: { channel: body.channel },
    });
    return share;
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(contactShareListQuerySchema)) query: ContactShareListQuery,
    @Req() req: AuthedRequest,
  ): Promise<ContactSharePage> {
    const user = requirePermission(req, 'contact.send');
    return this.sending.list(user, query.page, query.pageSize, query.profileId);
  }
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#0f172a"><h1 style="font-size:1.25rem">${escapeHtml(title)}</h1>${body}</body></html>`;
}

/**
 * Cancelamento dos emails de contacto (regra 5). Autorizado pelo código assinado do link, não por sessão.
 * GET só mostra a confirmação (os leitores de email abrem links sozinhos); POST cancela, incluindo o
 * «cancelar com um clique» dos clientes de email (RFC 8058), que não envia cabeçalhos da aplicação.
 */
@Public()
@Controller('public/unsubscribe')
export class UnsubscribeController {
  constructor(@Inject(ContactSendingService) private readonly sending: ContactSendingService) {}

  @Get()
  confirm(@Query('h') hash: string, @Query('t') token: string, @Res() res: Response): void {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html');
    if (!this.sending.isValidUnsubscribe(String(hash ?? ''), String(token ?? ''))) {
      res.status(404).send(page('Link inválido', '<p>Este link de cancelamento não é válido.</p>'));
      return;
    }
    const action = `?h=${encodeURIComponent(hash)}&t=${encodeURIComponent(token)}`;
    res.send(
      page(
        'Deixar de receber contactos',
        `<p>Confirme que não quer receber mais emails de contacto enviados através do NFC Business.</p><form method="post" action="${escapeHtml(action)}"><button type="submit" style="padding:.6rem 1rem">Confirmar</button></form>`,
      ),
    );
  }

  @SkipCsrf()
  @Post()
  async unsubscribe(@Query('h') hash: string, @Query('t') token: string, @Req() _req: Request, @Res() res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html');
    if (!this.sending.isValidUnsubscribe(String(hash ?? ''), String(token ?? ''))) {
      res.status(404).send(page('Link inválido', '<p>Este link de cancelamento não é válido.</p>'));
      return;
    }
    await this.sending.unsubscribe(hash);
    res.send(page('Pedido registado', '<p>Não voltará a receber emails de contacto enviados através do NFC Business.</p>'));
  }
}
