import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { resolveError } from '../common/api-exception.filter';
import { loadEnv } from '../config/env';
import type { DatabaseService } from '../database/database.service';
import { EmailService, escapeHtml, renderContactEmailHtml } from '../email/email.service';
import type { PublicCardService } from '../public/public-card.service';
import { ContactSendingService, emailHash } from './contact-sending.service';

describe('email do envio de contacto', () => {
  it('escapa o texto do utilizador: nome e nota nunca entram como HTML', () => {
    const html = renderContactEmailHtml({
      text: 'Olá <b>Zé</b>,\nAna partilhou consigo o seu cartão de visita digital:\nhttps://app.exemplo.com/c/abc\n\n"><script>x</script>',
      cardUrl: 'https://app.exemplo.com/c/abc',
      unsubscribeUrl: 'https://app.exemplo.com/api/public/unsubscribe?h=1&t=2',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Zé</b>');
    expect(html).toContain('&lt;b&gt;Zé&lt;/b&gt;');
    expect(html).toContain('<a href="https://app.exemplo.com/c/abc">');
    expect(escapeHtml(`a&"'<>`)).toBe('a&amp;&quot;&#39;&lt;&gt;');
  });

  it('envia pelo Resend com o VCF em anexo e o cancelamento em um clique; sem chave responde 503', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    const service = new EmailService(loadEnv({ RESEND_API_KEY: 're_teste_1234567890' }));
    await service.sendContact(
      {
        to: 'cliente@exemplo.test',
        subject: 'Ana partilhou consigo o seu cartão de visita',
        text: 'Olá',
        cardUrl: 'https://app.exemplo.com/c/abc',
        unsubscribeUrl: 'https://app.exemplo.com/api/public/unsubscribe?h=1&t=2',
        vcf: { filename: 'ana.vcf', content: 'BEGIN:VCARD\r\nEND:VCARD\r\n' },
      },
      fetcher as unknown as typeof fetch,
    );
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.attachments).toEqual([{ filename: 'ana.vcf', content: Buffer.from('BEGIN:VCARD\r\nEND:VCARD\r\n').toString('base64') }]);
    expect(body.headers).toMatchObject({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

    const failing = vi.fn(async () => new Response('erro', { status: 500 }));
    await expect(service.sendContact({ to: 'x@y.test', subject: 's', text: 't', cardUrl: 'c', unsubscribeUrl: 'u', vcf: { filename: 'a.vcf', content: '' } }, failing as unknown as typeof fetch)).rejects.toMatchObject({
      response: { error: { code: 'email_unavailable' } },
    });
    await expect(
      new EmailService(loadEnv({})).sendContact({ to: 'x@y.test', subject: 's', text: 't', cardUrl: 'c', unsubscribeUrl: 'u', vcf: { filename: 'a.vcf', content: '' } }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe('cancelamento', () => {
  const service = new ContactSendingService(
    {} as DatabaseService,
    {} as EmailService,
    {} as PublicCardService,
    loadEnv({ IP_HASH_SECRET: 's'.repeat(32) }),
  );

  it('o hash ignora maiúsculas e espaços; o código assinado só vale para esse hash', () => {
    const hash = emailHash(' Cliente@Exemplo.test ');
    expect(hash).toBe(emailHash('cliente@exemplo.test'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const token = service.unsubscribeToken(hash);
    expect(service.isValidUnsubscribe(hash, token)).toBe(true);
    expect(service.isValidUnsubscribe(emailHash('outro@exemplo.test'), token)).toBe(false);
    expect(service.isValidUnsubscribe(hash, `${token}x`)).toBe(false);
    expect(service.isValidUnsubscribe('nao-e-hash', token)).toBe(false);
  });
});

describe('filtro de erros', () => {
  it('mantém o scope dos limites de envio e o Retry-After, e nada mais', () => {
    const error = new HttpException({ error: { code: 'rate_limited', scope: 'hour', extra: 'x' }, retryAfter: 120.4 }, 429);
    expect(resolveError(error)).toEqual({ status: 429, code: 'rate_limited', scope: 'hour', retryAfter: 121 });
    const odd = new HttpException({ error: { code: 'rate_limited', scope: 'hack' } }, 429);
    expect(resolveError(odd)).toEqual({ status: 429, code: 'rate_limited' });
  });
});
