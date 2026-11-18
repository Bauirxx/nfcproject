# ADR-0019: Envio de contacto no backend

- Estado: Aceite
- Data: 2026-11-18
- Relacionados: ADR-0004 (contrato), ADR-0014 (página pública); CLAUDE.md, «Módulo de envio de contacto» e regras 5, 6 e 11

## Decisão

1. **`POST /api/contact-shares`** (autenticado, `contact.send`) faz tudo numa transação com um lock por utilizador (`pg_advisory_xact_lock`):
   - verificação de posse: o perfil tem de ser da empresa da sessão e, para o dono, um perfil seu; caso contrário 404;
   - o perfil tem de ter um cartão ativo, senão 409 `profile_without_card`;
   - os limites (ver ponto 2);
   - o registo em `contact_shares`, com o destinatário completo para o envio e o valor mascarado para a interface;
   - o evento `contact_sent`, registado só pelo backend;
   - no canal email, o envio.

   Se o email falhar, a transação desfaz-se e nada fica registado. A auditoria regista `contact.sent` com o perfil e o canal, sem o destinatário.
2. **Limites duráveis.** Contam-se na própria tabela e não em memória, por isso valem entre reinícios e entre instâncias:
   - 10 por hora e 50 por dia por utilizador;
   - **500 por dia por empresa**, um valor assumido para a regra 5 que o dono pode ajustar.

   Acima do limite, a resposta é 429 `rate_limited` com `scope` (`hour`, `day` ou `company`) e `Retry-After`. O filtro de erros passa a devolver esse `scope` (ADR-0004).
3. **WhatsApp e SMS.** O backend regista e o frontend abre o `wa.me`/`sms:` no dispositivo do utilizador, que envia da sua conta. O envio de SMS pelo servidor continua fora da v1.
4. **Email (Resend).**
   - Modelo fixo (`buildShareMessage`), com o texto do utilizador sempre escapado em HTML; só o link do cartão e o de cancelamento são ligações.
   - O VCF segue em anexo, gerado no servidor a partir da vista pública.
   - Cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post` (RFC 8058).
   - Sem `RESEND_API_KEY` ou `PUBLIC_APP_URL`, o canal email responde 503 `email_unavailable`.
5. **Cancelamento.** `/api/public/unsubscribe?h=<sha256 do email>&t=<HMAC>`:
   - o GET só mostra a confirmação, para que leitores e antivírus que abrem links não cancelem nada;
   - o POST cancela e é `@SkipCsrf`, autorizado pelo código assinado.

   Guarda-se só o hash em `email_suppressions`. Um envio para um email cancelado dá 422 `recipient_unsubscribed`.
6. **Remetente sem chave estrangeira.** A migração 0004 retira a chave estrangeira de `contact_shares.sender_user_id` para `app.users`, porque nem todos os utilizadores estão espelhados (o platform_admin inicial, por exemplo).
7. **Anonimização.** Os dados do destinatário são anonimizados aos 90 dias pelo pg_cron (migração 0002).

## Consequências

- Para o email, o dono precisa de uma conta no Resend com o domínio verificado (SPF, DKIM e DMARC, fase 5). O remetente de teste `onboarding@resend.dev` só entrega no email do dono da conta Resend.
- O platform_admin não envia, porque não tem empresa (404), como na API simulada.
