# ADR-0021: Logs JSON com request_id e alertas de operação

- Estado: Aceite
- Data: 2026-11-19
- Relacionados: CLAUDE.md, regra 11 («Logs JSON com request_id e alertas, incluindo picos de envios») e fase 4; ADR-0019 (envio de contacto), ADR-0014 (limites em memória)

## Contexto

O backend escrevia os logs em texto, com o formato por defeito do Nest. Não havia forma de ligar uma linha a um pedido, nem nenhum alerta. O Render guarda o stdout do processo e pode reencaminhá-lo (Log Streams) para uma ferramenta de logs, mas não alerta sobre o conteúdo.

## Decisão

1. **Logger JSON** (`common/json-logger.ts`), passado ao `NestFactory`:
   - escreve uma linha JSON por evento, com `time`, `level`, `context`, `msg` e `request_id`;
   - os `new Logger('X')` existentes passam a sair neste formato sem alterações;
   - só aceita campos simples (texto, número, booleano, data), para não despejar objetos com dados pessoais ou segredos;
   - os campos reservados não podem ser substituídos;
   - o `JSON.stringify` impede que um valor forje outra linha;
   - em produção, o nível mínimo é `info`.
2. **request_id** (`common/request-context.ts`, `common/request-logging.ts`):
   - é gerado pelo servidor (UUID) em cada pedido e **nunca** aceite do cliente;
   - acompanha todo o código assíncrono do pedido (`AsyncLocalStorage`);
   - volta no cabeçalho `X-Request-Id`;
   - o `x-vercel-id` só entra como `edge_id`, se tiver um formato inofensivo.
3. **Log de acesso**, uma linha por pedido terminado:
   - campos: método, **rota padrão** (`/api/public/cards/:token`), estado, duração e, com sessão, `user_id` e `company_id`;
   - nunca entram o caminho concreto, a query string, o IP nem os cabeçalhos. Assim, tokens de cartões, códigos de cancelamento e de convite não ficam nos logs;
   - o `/api/health` com sucesso não é registado, porque o Render chama-o a cada poucos segundos.
4. **Alertas** (`common/alerts.ts`, `common/request-monitor.ts`). São regras sobre os pedidos terminados, sem mexer nos serviços:

   | Alerta | Quando |
   |--------|--------|
   | `server_error` | qualquer resposta 5xx (por rota) |
   | `contact_spike` | ≥ 50 envios de contacto da mesma empresa em 15 minutos, ou ≥ 200 em toda a plataforma |
   | `contact_rate_limited` | um envio recusado com 429 (por empresa) |
   | `auth_rate_limited` | 429 no login, recuperação, MFA ou mudança de palavra-passe (por rota) |

   - **Destino:** cada alerta sai no log com nível `error` e campo `alert`. Se `ALERT_EMAIL_TO` e `RESEND_API_KEY` estiverem definidos, segue também por email.
   - **Repetição:** o mesmo alerta (tipo e chave) fica em silêncio 15 minutos.
   - **Conteúdo:** o email leva só o tipo, contagens, identificadores e o `request_id`, sem dados pessoais.
5. **Limiares assumidos.** Os limiares do pico (50 por empresa, 10% do limite diário de 500; 200 na plataforma) são valores assumidos, a ajustar com o uso real.
6. **Em memória.** Os contadores ficam em memória, como os limitadores do ADR-0014. Servem a instância única do Render; com várias instâncias, passam para a base de dados.
7. **Build.** O `EmailService` passa para o `CoreModule`, para ser partilhado pelo envio de contacto e pelos alertas. O esbuild mantém os nomes das classes (`keepNames`), que são o `context` dos logs.

## Alternativas consideradas

- **pino / nestjs-pino:** mais funcionalidades, mas uma dependência nova para algo que cabe em ~100 linhas testadas. O `ConsoleLogger({ json: true })` do Nest não junta o `request_id`.
- **Aceitar o `X-Request-Id` do cliente:** permitiria forjar ou misturar pedidos nos logs.
- **Ferramenta externa de alertas (Better Stack, Grafana):** pode ser ligada mais tarde pelos Log Streams do Render (o campo `alert` serve de filtro). O email pelo Resend, que já existe, não acrescenta fornecedores.

## Consequências

- Para receber alertas por email, o dono define `ALERT_EMAIL_TO` no Render, e o `RESEND_API_KEY` tem de estar configurado.
- Um 5xx com causa contínua gera no máximo um email por rota a cada 15 minutos; o log continua a registar cada pedido.
- Os contadores perdem-se num reinício. Um pico que atravesse um reinício pode não alertar, mas os limites de envio na base de dados mantêm-se.
