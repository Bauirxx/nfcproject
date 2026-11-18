// Email transacional pelo Resend (CLAUDE.md, «Módulo de envio de contacto» e regra 5). Modelo fixo, texto do
// utilizador sempre escapado, VCF em anexo e cabeçalhos de cancelamento (RFC 8058).
import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ENV, type Env } from '../config/env';

export interface ContactEmail {
  to: string;
  subject: string;
  /** Mensagem já montada pelo modelo fixo (`buildShareMessage`). */
  text: string;
  cardUrl: string;
  unsubscribeUrl: string;
  vcf: { filename: string; content: string };
}

/** Escapa texto para HTML (nome, nota e mensagem do utilizador nunca entram como HTML). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Corpo HTML do modelo fixo: só o link do cartão e o link de cancelamento são ligações. */
export function renderContactEmailHtml(email: Pick<ContactEmail, 'text' | 'cardUrl' | 'unsubscribeUrl'>): string {
  const paragraphs = escapeHtml(email.text)
    .split('\n')
    .map((line) => (line === escapeHtml(email.cardUrl) ? `<a href="${escapeHtml(email.cardUrl)}">${line}</a>` : line))
    .join('<br>');
  return [
    '<!doctype html><html lang="pt"><body style="font-family:Arial,sans-serif;color:#0f172a">',
    `<p>${paragraphs}</p>`,
    '<p style="color:#64748b;font-size:12px">O contacto segue também em anexo (ficheiro .vcf).</p>',
    `<p style="color:#64748b;font-size:12px"><a href="${escapeHtml(email.unsubscribeUrl)}">Não quero receber mais contactos</a></p>`,
    '</body></html>',
  ].join('');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');
  private readonly apiKey: string | null;
  private readonly from: string;

  constructor(@Inject(ENV) env: Env) {
    this.apiKey = env.RESEND_API_KEY ?? null;
    this.from = env.EMAIL_FROM;
  }

  get configured(): boolean {
    return this.apiKey !== null;
  }

  /** Envia o email; qualquer falha do fornecedor é um 503 genérico (o envio não fica registado). */
  async sendContact(email: ContactEmail, fetcher: typeof fetch = fetch): Promise<void> {
    if (!this.apiKey) throw new ServiceUnavailableException({ error: { code: 'email_unavailable' } });
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [email.to],
        subject: email.subject,
        text: `${email.text}\n\nNão quer receber mais contactos? ${email.unsubscribeUrl}`,
        html: renderContactEmailHtml(email),
        attachments: [{ filename: email.vcf.filename, content: Buffer.from(email.vcf.content, 'utf8').toString('base64') }],
        headers: {
          'List-Unsubscribe': `<${email.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch((error: unknown) => {
      this.logger.error(`Resend indisponível: ${error instanceof Error ? error.message : 'erro'}`);
      return null;
    });
    if (!response?.ok) {
      if (response) this.logger.error(`Resend recusou o envio: estado ${response.status}`);
      throw new ServiceUnavailableException({ error: { code: 'email_unavailable' } });
    }
  }
}
