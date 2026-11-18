# ADR-0017: Exceção isolada à regra 3: service_role num único serviço do backend

- Estado: Aceite (decisão do dono do produto, 2026-11-18)
- Data: 2026-11-18
- Substitui em parte: CLAUDE.md, regra 3 ("a chave service_role só é usada em migrações no CI"), apenas para as operações listadas abaixo
- Relacionados: ADR-0011, ADR-0013, ADR-0016

## Contexto

Três funcionalidades obrigatórias não são possíveis com a chave pública nem com o papel `app_backend`:
- **Convites:** criar uma empresa com o primeiro administrador e convidar membros exige criar contas no Supabase Auth (o registo é só por convite, regra 1).
- **Gestão de membros:** mudar o papel e remover contas exige escrever no `app_metadata` (só o servidor pode) e apagar utilizadores do Auth.
- **Storage:** carregar imagens para os buckets de quarentena e público (regra 8) sem dar permissões de Storage aos papéis `anon` ou `authenticated`.

As alternativas sem `service_role` exigiam abrir o registo público do Supabase ou criar políticas de Storage para os papéis públicos. As duas aumentavam a superfície de ataque.

## Decisão

1. A chave `SUPABASE_SERVICE_ROLE_KEY` fica **só** nas variáveis do Render e no `apps/api/.env` local. Nunca vai para o repositório nem para variáveis `VITE_`, e o frontend nunca a vê.
2. Só um ficheiro a usa: `apps/api/src/supabase/supabase-admin.service.ts` (`SupabaseAdminService`). Expõe apenas operações estreitas:
   - `invite`;
   - `setRole`;
   - `deleteUser`;
   - mais tarde, as operações de Storage.

   Nunca devolve o cliente nem a chave.
3. Quem chama o serviço já verificou a permissão (RBAC) e a posse (empresa da sessão) e regista a ação em `audit_logs`.
4. Sem a chave, as funcionalidades respondem 503 (`invites_unavailable`). O resto da aplicação continua a funcionar e o arranque não falha.
5. O espelho em `app.users` (estado `invited` ou `active`) é escrito pelo `app_backend` com RLS, na mesma transação. Se essa escrita falhar depois do convite, a conta criada é removida.
6. Os links de convite seguem o padrão da recuperação: o modelo de email do Supabase aponta para `<PUBLIC_APP_URL>/convite?token={{ .TokenHash }}`. O aceitar convite (`POST /api/auth/invite/accept`) usa `verifyOtp`, recusa passwords vazadas antes de gastar o token, define o nome e a password, ativa a conta e não inicia sessão.

## Alternativas

- **Convites próprios com o registo do Supabase ligado.** Rejeitada pelo dono: mais código e um registo público aberto, ainda que escondido.
- **Imagens na base de dados.** Rejeitada pelo dono: o CLAUDE.md prevê Storage com quarentena.
- **Políticas de Storage para `authenticated`.** Rejeitada: contraria o princípio de que só o backend fala com o Supabase.

## Consequências

- Um comprometimento do backend dá acesso administrativo ao Supabase. O risco é mitigado por:
  - o isolamento num único serviço;
  - a auditoria das ações;
  - o segredo guardado só no Render;
  - os testes, que garantem que nenhum outro módulo importa o cliente admin.

  É um ponto a rever no pentest (fase 5).
- A reposição do MFA de um membro (ADR-0016) pode passar a ser feita por este serviço. Fica para um bloco seguinte.
