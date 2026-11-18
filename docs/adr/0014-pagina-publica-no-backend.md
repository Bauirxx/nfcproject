# ADR-0014: Página pública, VCF e eventos no backend real

- Estado: Aceite
- Data: 2026-11-18
- Relacionados: ADR-0004 (contrato), ADR-0013 (ligação à base de dados); CLAUDE.md, regras 4 e 6

## Contexto

As rotas públicas `GET /api/public/cards/:token`, `GET /api/public/cards/:token/contact.vcf`, `GET /api/public/profiles/:slug` (e o respetivo `.vcf`) e `POST /api/public/events` não têm sessão. Têm de respeitar as regras 4 e 6 e manter o comportamento que o frontend já usa contra a API simulada (ADR-0009).

## Decisão

1. **Leitura só pela vista `app.public_cards`** (migração 0002). A vista mostra apenas cartões `active` e só os campos públicos de cada perfil. Tudo o resto dá o mesmo 404 `not_found`, com `Cache-Control: no-store`: token desconhecido ou mal formado, cartão inativo, perdido ou bloqueado, perfil sem cartão ativo. Tokens e endereços mal formados são recusados antes de chegar à base de dados.
2. **Defesa em profundidade na saída** (`toPublicCard`). Só saem tipos de contacto conhecidos e redes sociais em https de domínios permitidos. As imagens passam por `toSafeImageUrl`. O tema completa-se com `DEFAULT_THEME`. Por fim, o resultado é validado com o `publicCardSchema` partilhado e, se falhar, a resposta é o 404 neutro. O `company_id` nunca sai para o cliente.
3. **Gerador de VCF partilhado.** O gerador de vCard 4.0 passou da API simulada para `@nfc-business/shared/vcard`, por isso o backend e a API simulada usam o mesmo código e os mesmos testes. O link do cartão no VCF usa `PUBLIC_APP_URL`. Sem essa variável, o link é omitido.
4. **Cabeçalhos.** As respostas válidas levam `Cache-Control: public, max-age=60`. Todas as rotas públicas levam `X-Robots-Tag: noindex, nofollow`. O VCF vai como anexo, com o nome `<slug>.vcf`, que é seguro porque o slug só tem `[a-z0-9-]`.
5. **Rate limit de 60 pedidos por minuto por IP**, com janela fixa em memória (`FixedWindowRateLimiter`) e um máximo de chaves para limitar a memória. Acima do limite, a resposta é 429 `rate_limited` com `Retry-After`. As páginas e os eventos têm contadores separados.
6. **IP real atrás de proxies.** O Express usa `trust proxy = TRUST_PROXY_HOPS`. No caminho Vercel → Render há 2 proxies, e o `render.yaml` define 2.
7. **Eventos (regra 6).**
   - Aceitam só a lista fechada do schema partilhado; qualquer outro tipo dá 422.
   - Respondem sempre 204, exista ou não o cartão.
   - Ficam registados na empresa do cartão, que o servidor resolve pela vista e nunca recebe do cliente.
   - Guarda-se o `ip_hash` (HMAC-SHA256 com um sal diário derivado de `IP_HASH_SECRET`) e nunca o IP.
   - A deduplicação de 30 minutos faz-se no `insert … where not exists` (mesmo cartão, tipo e hash).
   - O `IP_HASH_SECRET` é obrigatório em produção. No Render é gerado automaticamente.

## Alternativas

- **Rate limit na base de dados ou em Redis.** Adiado. Com uma única instância no Render, a memória chega e não acrescenta carga à base de dados. Passa a ser necessário se houver várias instâncias.
- **`@nestjs/throttler`.** Rejeitado por agora: seria mais uma dependência para um limitador de poucas linhas, e o projeto pede o mínimo de dependências.
- **Ler as tabelas com um contexto especial em vez da vista.** Rejeitado: a vista limita as colunas na base de dados, por isso um erro no código não consegue expor campos privados.

## Consequências

- O limite em memória recomeça quando o serviço reinicia e não é partilhado entre instâncias. Fica registado como limitação conhecida.
- O valor de `TRUST_PROXY_HOPS` tem de ser confirmado depois do primeiro deploy, comparando o IP registado com o real. Se for alto demais, o cliente pode falsificar o `X-Forwarded-For`; se for baixo demais, todos os visitantes partilham o IP do proxy.
- Faltam o cache na edge (CDN) e o `Retry-After` específico de cada página, que ficam para a fase 4.
