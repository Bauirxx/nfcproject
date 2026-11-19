# Plano de resposta a incidentes

CLAUDE.md, regra 11: «Plano de resposta a incidentes escrito antes do lançamento». Versão 1, 2026-11-19. Rever depois de cada incidente e, no mínimo, antes da fase 5.

Este plano é para quem opera o NFC Business: hoje o dono do produto, que acumula todos os papéis. Está escrito para ser seguido sob pressão. Cada cenário tem os passos por ordem, e o objetivo dos primeiros passos é **conter**, não investigar.

## 1. Contactos e acessos (preencher pelo dono)

| Papel | Quem | Como contactar | Substituto |
|-------|------|----------------|------------|
| Responsável pelo incidente | _(preencher)_ | _(preencher)_ | _(preencher)_ |
| Técnico (backend, Supabase) | _(preencher)_ | _(preencher)_ | _(preencher)_ |
| Comunicação com as empresas clientes | _(preencher)_ | _(preencher)_ | _(preencher)_ |
| Assessoria jurídica (dados pessoais) | _(preencher)_ | _(preencher)_ | — |

**Contas que é preciso conseguir abrir num incidente.** Confirme que cada uma tem MFA ativo e que o acesso está num gestor de palavras-passe:

- GitHub
- Render
- Vercel
- Supabase
- Resend
- domínio e DNS, quando existirem
- o email que recebe os alertas (`ALERT_EMAIL_TO`)

## 2. Gravidade

| Nível | Exemplos | Reação |
|-------|----------|--------|
| **SEV-1, crítico** | Dados pessoais expostos ou exfiltrados. Segredo de produção exposto (`DATABASE_URL`, service_role, `RESEND_API_KEY`). Conta de administrador comprometida. Perda de dados. | Começar **de imediato**. Conter na primeira hora. |
| **SEV-2, alto** | Abuso do envio de contacto (spam a partir da plataforma). Vulnerabilidade alta explorável. Plataforma em baixo. Força bruta em curso. | Começar no mesmo dia. |
| **SEV-3, médio** | Vulnerabilidade média. Um cartão perdido ou roubado. Erros 5xx isolados. | Tratar no prazo da regra 10 (média: 30 dias) ou no dia útil seguinte. |

Na dúvida, trate como o nível acima. É fácil baixar a gravidade depois.

## 3. Fases (todos os incidentes)

1. **Detetar e registar.** Abra um registo do incidente (secção 7) com a hora, a origem e o primeiro `request_id` relevante. As origens possíveis são:
   - os alertas (ADR-0021): email ou campo `alert` nos logs do Render;
   - o CI vermelho, o Dependabot ou o gitleaks;
   - um aviso de um cliente ou de um investigador.
2. **Conter.** Use os interruptores de emergência (secção 4) e os passos do cenário (secção 5).
3. **Preservar provas, antes de apagar seja o que for:**
   - exporte os logs do Render do período (os logs do plano gratuito têm retenção curta);
   - copie as entradas de `audit_logs` relevantes;
   - faça uma cópia da base de dados com `scripts/backup/backup-db.ps1`.

   Nunca altere `audit_logs`: é append-only.
4. **Erradicar.** Corrija a causa: código, configuração, chave ou conta. Toda a alteração de código passa pelo CI.
5. **Recuperar.** Reponha o serviço e confirme:
   - `/api/health` dá 200;
   - o login funciona;
   - a página pública de um cartão ativo abre;
   - os alertas acalmaram.
6. **Comunicar** (secção 6).
7. **Rever.** No prazo de 5 dias úteis, faça a revisão sem culpados (secção 7). As ações que saírem da revisão viram tarefas em `docs/requirements.md` e, quando mudam decisões, ADRs.

## 4. Interruptores de emergência

| Ação | Onde | Efeito | Para desfazer |
|------|------|--------|---------------|
| **Parar o backend** | Render > serviço > **Suspend** | A API deixa de responder; a página pública e o painel deixam de funcionar | **Resume** |
| **Voltar a uma versão anterior do backend** | Render > Deploys > deploy anterior > **Rollback** | Repõe o código anterior | Novo deploy |
| **Voltar a uma versão anterior do frontend** | Vercel > Deployments > deploy anterior > **Promote to Production** (Instant Rollback) | Repõe o frontend anterior | Promover o mais recente |
| **Cortar o email** | Resend > API Keys > **revogar** a chave | O canal email responde 503 `email_unavailable`; WhatsApp e SMS continuam | Criar uma nova chave, pô-la no Render |
| **Cortar convites e uploads** | Supabase > Settings > API Keys > revogar a chave secreta (service_role) | Convites e uploads respondem 503; o resto funciona | Nova chave em `SUPABASE_SERVICE_ROLE_KEY` no Render |
| **Cortar o acesso do backend à base de dados** | SQL Editor: `alter role app_backend nologin;` | O backend deixa de ler e escrever (só falham as rotas com base de dados) | `alter role app_backend login;` |
| **Terminar todas as sessões de um utilizador** | Supabase > Authentication > Users > utilizador > **Sign out user** (ou apagar o utilizador) | O utilizador tem de voltar a entrar | — |
| **Desativar um cartão** | Painel > Cartões > cartão > **Perdido** (reversível) ou **Bloquear** (definitivo) | A página pública devolve a página neutra (404) | **Perdido**: Painel > **Ativar**. **Bloqueado**: não se desfaz; é preciso um cartão novo |
| **Remover um membro** | Painel > Membros > **Remover** (company_admin) | O membro perde o acesso à empresa | Novo convite |

## 5. Cenários

### 5.1 Segredo exposto (SEV-1)

Exemplos: uma captura de ecrã, um commit, uma mensagem de chat, um log ou um portátil perdido. **Um segredo exposto é tratado como comprometido, mesmo que «ninguém tenha visto».** Apagar a mensagem ou o commit não chega.

1. **Rode o segredo primeiro e investigue depois:**

   | Segredo | Rotação | Cuidados |
   |---------|---------|----------|
   | Palavra-passe do `app_backend` (no `DATABASE_URL`) | SQL Editor: `alter role app_backend with password '<nova, 32+ aleatórios>';` → atualizar `DATABASE_URL` no Render e no `apps/api/.env` dos dois PCs | O backend falha até o Render ter a nova palavra-passe |
   | Palavra-passe do `postgres` | Supabase > Database > Settings > **Reset database password** | Usada só nas cópias de segurança |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase > API Keys: criar uma chave secreta nova e **revogar** a antiga → Render | Convites e uploads falham até à troca |
   | `SUPABASE_ANON_KEY` (publishable) | Supabase > API Keys: nova chave publishable, revogar a antiga → Render | É pública por natureza; rodar só se houver abuso |
   | `RESEND_API_KEY` | Resend > API Keys: revogar e criar → Render | Ver a lista de emails enviados no Resend para detetar uso indevido |
   | `IP_HASH_SECRET` | Render > Environment: gerar um valor novo (32+ caracteres) | **Invalida os links de cancelamento dos emails já enviados**, os tokens CSRF (o frontend obtém um novo na sessão seguinte) e a deduplicação das estatísticas. Os cancelamentos já feitos mantêm-se. Rodar só se este segredo estiver exposto. |
   | Token ou sessão do GitHub, Render, Vercel ou Supabase | Revogar na conta respetiva e terminar as outras sessões | Confirmar o MFA da conta |

2. **Procure uso indevido** desde a hora da exposição:
   - logs do Render: pedidos estranhos e alertas;
   - `audit_logs`: convites, mudanças de papel, cartões bloqueados ou ativados;
   - registos de acesso do Supabase (Logs > Postgres, Auth);
   - emails enviados no Resend.
3. **Se houve acesso a dados pessoais:** passa a ser uma fuga de dados (5.3).

> **Incidente aberto INC-0001 (2026-11-18):** a palavra-passe do `app_backend` ficou visível numa captura de ecrã durante a configuração do Render. Siga o passo 1 da tabela para essa linha e feche o incidente com a data da rotação.

### 5.2 Conta comprometida (SEV-1 se for administrador, SEV-2 nos outros casos)

1. **Termine as sessões do utilizador e bloqueie o acesso.** No Supabase, abra Authentication > Users > *Sign out user*. Para um administrador da plataforma, troque também a palavra-passe pela recuperação.
2. **Reponha o MFA**, porque o atacante pode ter registado o seu próprio fator. Ainda não há este ecrã no painel (está pendente). Faça-o no Supabase > Authentication > Users > utilizador > apagar os fatores MFA. O utilizador volta a configurar o MFA no próximo login.
3. **Veja em `audit_logs` o que a conta fez** desde o primeiro acesso suspeito: convites, mudanças de papel, alterações de perfis e cartões, envios de contacto. Reverta o que for malicioso.
4. Se a conta convidou outras pessoas, trate essas contas também como suspeitas.

### 5.3 Fuga ou acesso indevido a dados pessoais (SEV-1)

1. **Contenha.** Parar o backend é a opção mais segura enquanto a causa é desconhecida. A seguir, corrija a causa: um defeito de autorização, um segredo exposto (5.1) ou uma conta comprometida (5.2).
2. **Determine o âmbito:**
   - que empresas foram afetadas;
   - que dados saíram: contactos dos perfis, destinatários dos envios (só os últimos 90 dias têm dados completos), emails dos utilizadores;
   - em que período.

   Os testes de isolamento entre empresas (fase 2) ajudam a confirmar se uma empresa pôde ver dados de outra.
3. **Obrigações legais.** **Confirme com assessoria jurídica**, antes de comunicar, que obrigações de notificação se aplicam: à autoridade competente, aos titulares e aos clientes. Dependem da lei aplicável (Moçambique e o país dos titulares) e dos contratos com as empresas. Este plano não substitui esse parecer.
4. **Comunique** às empresas afetadas (secção 6), com o que se sabe, o que se fez e o que devem fazer.

### 5.4 Abuso do envio de contacto (SEV-2)

**Origem típica:** os alertas `contact_spike` ou `contact_rate_limited`, ou uma queixa de um destinatário.

1. **Identifique a conta.** O alerta traz `company_id`. No log de acesso, a rota `POST /api/contact-shares` traz o `user_id`.
2. **Contenha a conta.** O company_admin remove o membro no painel. Se for o próprio administrador da empresa ou se não responder, o dono termina as sessões e apaga o utilizador no Supabase (5.2). Pelo P-06, o platform_admin não gere membros no painel.
3. **Se for generalizado:** corte o email (revogar a `RESEND_API_KEY`). WhatsApp e SMS saem do telemóvel do próprio utilizador, por isso não geram spam a partir da plataforma.
4. **Reveja os limites.** Os limites de 10 por hora e 50 por dia por utilizador, e 500 por dia por empresa, estão no ADR-0019, e os limiares de alerta no ADR-0021. Mudá-los é uma alteração de código e passa pelo CI.
5. **Destinatários que se queixam:** confirme que o link de cancelamento funciona. Em último caso, insira o hash do email em `app.email_suppressions`.
6. **Reputação do domínio:** acompanhe no Resend as taxas de queixas e devoluções.

### 5.5 Vulnerabilidade numa dependência ou no código (SEV-1 a SEV-3)

**Origem típica:** CI vermelho no job `dependencies` ou `sast`, um alerta do Dependabot, ou um aviso externo.

1. **Classifique.**
   - **Explorável e exposto em produção:** trate como SEV-1 ou SEV-2.
   - **Só em desenvolvimento:** SEV-3.
2. **Prazos (regra 10):**
   - CISA KEV ou crítica exposta: **72 horas**;
   - alta: **14 dias**;
   - média: **30 dias**.
3. **Corrija.** Atualize a dependência ou use um `overrides` com uma versão de 7 ou mais dias. Os passos estão em `docs/ci.md`, secção 3.
4. **Se não houver correção a tempo:** mitigue (desligar a funcionalidade, uma regra no edge) e registe a exceção com prazo num ADR.

### 5.6 Plataforma em baixo (SEV-2)

**Origem típica:** o alerta `server_error`, o health check do Render ou queixas dos utilizadores.

1. **Veja onde está a falha.** Consulte as páginas de estado do Render, do Supabase e do Vercel, e o `/api/health`.
2. **Se começou num deploy:** volte a uma versão anterior (secção 4) e investigue depois.
3. **Se é a base de dados:** confirme os limites do plano Free do Supabase (o projeto pode estar em pausa por inatividade) e as ligações do pooler.
4. **Informe os clientes** se a falha passar de 1 hora.

Os cartões físicos não precisam de nada: o URL não muda e a página volta quando o serviço voltar.

### 5.7 Perda ou corrupção de dados (SEV-1)

Siga `docs/backup.md`, secção 5:
1. pare as escritas;
2. escolha a cópia;
3. ensaie o restauro num projeto de teste;
4. restaure.

**Lembrete:** no plano Free não há cópias automáticas (ADR-0022). Só existem as cópias manuais do dono.

### 5.8 Força bruta ou negação de serviço (SEV-2)

**Origem típica:** o alerta `auth_rate_limited`, ou muitos 429 na página pública.

1. **Para cada IP, os limites já estão ativos:** 5 por minuto no login e na recuperação, 60 por minuto na página pública.
2. **Se o tráfego deitar o serviço abaixo:** ative a proteção do Vercel (Firewall, *Attack Challenge Mode*) para o frontend e o `/api`.
3. **Se uma conta concreta for o alvo:** avise o titular e confirme que tem MFA. Os administradores têm MFA obrigatório.

### 5.9 Cartão NFC perdido, roubado ou clonado (SEV-3)

1. No painel, marque o cartão como **Perdido** (se puder aparecer, e for reativável) ou **Bloqueado** (roubado ou clonado: **definitivo**, não se reativa). O URL passa a dar a página neutra.
2. Crie um cartão novo e associe-o ao perfil. É um token novo, gravado num chip novo e bloqueado contra regravação.
3. Um chip clonado tem o mesmo URL: ao bloquear o cartão, a cópia também deixa de funcionar.

## 6. Comunicação

- **Regras:**
  - comunique factos confirmados;
  - nunca prometa o que não está verificado;
  - nunca inclua segredos, tokens nem dados pessoais de terceiros na comunicação.
- **Quem informar:**
  - **empresas clientes afetadas:** o company_admin de cada empresa, por email;
  - **visitantes:** não há comunicação pública, salvo exigência legal (5.3).
- **Modelo para as empresas clientes:**

  > Assunto: [NFC Business] Incidente de segurança — <data>
  >
  > Em <data e hora>, detetámos <descrição curta e factual>. Afetou <âmbito: dados, funcionalidades, período>. Já fizemos <medidas de contenção>. Recomendamos que <ações para o cliente, por exemplo rever os membros e terminar sessões>. Vamos enviar uma atualização até <data>. Contacto: <contacto do responsável>.

## 7. Registo do incidente e revisão

Abra um ficheiro por incidente em `docs/incidents/INC-AAAA-NNN.md`. Esse ficheiro **não pode conter segredos nem dados pessoais**; para os utilizadores, use ids.

```markdown
# INC-AAAA-NNN: <título>
- Gravidade: SEV-n | Estado: aberto / contido / resolvido / revisto
- Detetado: <data hora> por <origem>   Contido: <data hora>   Resolvido: <data hora>
## Cronologia
- <hora> — <facto> (request_id / audit_log se houver)
## Impacto
<empresas, dados, período>
## Causa
<causa técnica e porque não foi apanhada antes>
## Ações
- [ ] <ação> — <responsável> — <prazo> — <tarefa/ADR>
## Lições
<o que correu bem, o que mudar neste plano>
```

## 8. Manter este plano vivo

- **Simulação de mesa uma vez por trimestre**, e antes da fase 5. Escolha um cenário, por exemplo 5.1 com a `RESEND_API_KEY`, e percorra os passos sem os executar, para confirmar acessos e tempos.
- **Teste de restauro mensal** (`docs/backup.md`), que serve também de ensaio para o 5.7.
- **Quando atualizar este plano:**
  - ao mudar de alojamento, de fornecedor de email ou de plano Supabase;
  - quando se ligar o domínio próprio, para acrescentar o cenário de DNS e de falsificação de email (SPF, DKIM, DMARC na fase 5).
