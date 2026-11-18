# ADR-0013: Ligação do backend ao PostgreSQL do Supabase

- Estado: Aceite
- Data: 2026-11-18
- Relacionados: ADR-0010 (fundação do backend), ADR-0011 (Supabase Auth), ADR-0012 (empacotamento e deploy); CLAUDE.md, regra 3

## Contexto

As tabelas de negócio estão no schema `app`, fora da Data API, com RLS em todas as tabelas e sem políticas para `anon` ou `authenticated` (migração 0001). Só o backend lhes acede. Para isso precisa de uma ligação PostgreSQL direta que respeite as quatro condições seguintes:
- usar o papel `app_backend`, com privilégios mínimos e sem BYPASSRLS, e nunca a password do `postgres` nem a chave `service_role`;
- funcionar no Render, que só tem IPv4 (a ligação direta do Supabase só tem IPv6);
- não deixar passar o contexto de autorização de um pedido para outro;
- proteger a ligação contra quem se ponha no meio.

## Decisão

1. **Papel `app_backend` com login.** O dono do projeto corre `alter role app_backend with login nobypassrls password '…'` no SQL Editor. A password fica só no `DATABASE_URL`, no `.env` local (fora do Git) e nas variáveis do Render.
2. **Ligação pelo Session pooler (Supavisor, porta 5432)** com o utilizador `app_backend.<ref-do-projeto>`. O Session pooler suporta IPv4 e mantém a semântica de sessão necessária às transações.
3. **TLS verificado com a CA do Supabase.** O certificado público `prod-ca-2021.crt` está em `apps/api/certs/supabase-ca.crt`, com `rejectUnauthorized: true`. Sem o ficheiro a aplicação recusa ligar, porque a verificação nunca se desliga. Na base de dados está ativo o "Enforce SSL".
4. **Contexto por transação.** O `DatabaseService.withContext(contexto, trabalho)` abre uma transação e corre `set_config('app.company_id', …, true)` e `set_config('app.is_platform_admin', …, true)`. Executa o trabalho e termina com commit, ou com rollback em caso de erro. Com `true`, o valor é local à transação e desaparece antes de a ligação voltar ao pool. Sem empresa, o valor é `''`, que não corresponde a nenhuma linha. O contexto vem sempre da sessão no servidor e nunca do cliente.
5. **Limites.** Pool com no máximo `DATABASE_POOL_MAX` ligações (5 por defeito), `statement_timeout` de 10 s e tempo de ligação de 10 s.
6. **Configuração.** `DATABASE_URL` só aceita `postgres://` ou `postgresql://` e é obrigatório em produção.

## Alternativas

- **Supabase Data API (PostgREST) com `service_role`.** Rejeitada: ignoraria a RLS e põe a chave mais poderosa em runtime (regra 3).
- **Password do `postgres`.** Rejeitada: é superutilizador e ignora a RLS.
- **Ligação direta (porta 5432 do host `db.`).** Rejeitada: só tem IPv6 e não funciona no Render.
- **Transaction pooler (porta 6543).** Adiada: não suporta prepared statements com nome. O Session pooler chega para a carga atual.
- **`SET ROLE` a partir de um utilizador privilegiado.** Rejeitada: o utilizador da ligação continuaria a ter privilégios altos.
- **`rejectUnauthorized: false`.** Rejeitada: expõe a ligação a ataques de intermediário.

## Consequências

- O isolamento entre empresas é garantido pela base de dados (RLS) e também pelo código (`WHERE id AND company_id`), por isso existe em duas camadas.
- O ficheiro `apps/api/certs/supabase-ca.crt` vai para o repositório. É público, mas tem de ser renovado se o Supabase mudar de CA.
- O Render precisa da variável `DATABASE_URL`. O certificado vai com o código.
- Os testes de integração (`src/database/database.integration.test.ts`) correm só com `DB_INTEGRATION=1`, contra a base de dados real e sem escrever dados. Confirmam o papel, o contexto local à transação, a RLS a bloquear escritas e a ausência de acesso ao schema `auth`.
