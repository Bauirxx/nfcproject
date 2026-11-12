# Modelação de ameaças do frontend (STRIDE)

Âmbito: funcionalidades críticas do frontend, conforme o processo SCRCD do `CLAUDE.md`. A proteção real está sempre na API; aqui registam-se os controlos que o frontend tem de cumprir e o que fica a cargo do backend.

Legenda: **S** spoofing, **T** tampering, **R** repudiation, **I** information disclosure, **D** denial of service, **E** elevation of privilege.

## 1. Autenticação e sessão (RF-FE-03 a 06, RF-FE-20)

| Ameaça | STRIDE | Controlo no frontend | Controlo esperado no backend |
|--------|--------|----------------------|------------------------------|
| Roubo de tokens por XSS | I, E | Nenhum token em JavaScript nem no armazenamento do browser; `react/no-danger`; CSP estrita | Cookies HttpOnly, Secure, SameSite=Strict |
| CSRF | S, T | `X-CSRF-Token` em todos os POST, PATCH e DELETE; token só em memória | SameSite=Strict, validação do token e do cabeçalho Origin |
| Enumeração de contas | I | Mensagens genéricas no login e na recuperação; mesma resposta exista ou não a conta | Respostas e tempos uniformes; rate limit |
| Força bruta | D, E | Mostra o limite atingido (429) sem detalhar | 5 tentativas por minuto por IP e por email |
| Redirecionamento aberto depois do login | S | O parâmetro `next` só aceita caminhos internos que começam por `/` e não por `//` | — |
| Fuga do token de recuperação ou de convite | I | Lido do URL, guardado só em memória e removido da barra de endereço; `Referrer-Policy` | Uso único, validade de 1 hora |
| Códigos de recuperação de MFA expostos | I | Mostrados uma vez, nunca guardados nem registados | Guardados só como hash |
| Sessão que fica aberta depois de expirar | E | 401 tenta renovar uma vez; se falhar, limpa a cache de dados e vai para o login | Access token de 15 minutos |

## 2. Página pública do cartão (RF-FE-01, RF-FE-02, RF-FE-16)

| Ameaça | STRIDE | Controlo no frontend | Controlo esperado no backend |
|--------|--------|----------------------|------------------------------|
| Enumeração de cartões e do seu estado | I | A mesma página neutra para qualquer falha, sem indicar o motivo | Mesma resposta 404 para tudo o que não seja `active`; token de 128 bits |
| XSS por dados do perfil | T, E | Texto sempre renderizado por React; sem HTML bruto | Validação e limites de tamanho |
| Links maliciosos (`javascript:`, domínios falsos) | S, T | Só `https`; redes sociais só de domínios permitidos; `rel="noopener noreferrer"`; `tel:`, `mailto:`, `wa.me` construídos de valores validados | Mesma lista de domínios (pacote partilhado) |
| Campos privados expostos | I | Mostra apenas o que a API pública devolve | Vista `public_profiles` |
| Envio para destinatários arbitrários por anónimos | E | O botão «Enviar o meu contacto» só carrega para o dono com sessão | `POST /api/contact-shares` autenticado, com verificação de posse |
| Inflação de estatísticas | T | Lista fechada de eventos; um `view` por carregamento | Deduplicação de 30 minutos, rate limit, hash do IP |
| Clickjacking | S | — | `frame-ancestors 'none'` |

## 3. Envio de contacto (RF-FE-14, RF-FE-15)

| Ameaça | STRIDE | Controlo no frontend | Controlo esperado no backend |
|--------|--------|----------------------|------------------------------|
| Spam por conta comprometida | D | Mostra o limite atingido; não tenta de novo automaticamente | 10 por hora, 50 por dia, limite por empresa |
| Injeção de links ou HTML na nota | T | Nota em texto simples, até 200 caracteres, rejeitada se tiver links ou marcação (schema partilhado) | Mesma validação; modelo fixo |
| Manipulação do link `wa.me` ou `sms:` | T | Número validado em E.164 e texto codificado com `encodeURIComponent` | — |
| Envio de um perfil alheio | E | A lista de perfis vem da API da sessão | Verificação de posse e de `company_id` |
| Exposição de dados do destinatário | I | Histórico mostra só o valor mascarado devolvido pela API; nada em logs | Mascaramento e eliminação aos 90 dias |
| Negação do envio | R | — | `audit_logs` e evento `contact_sent` |

## 4. Uploads (RF-FE-08, RF-FE-13, RF-FE-17)

| Ameaça | STRIDE | Controlo no frontend | Controlo esperado no backend |
|--------|--------|----------------------|------------------------------|
| Ficheiro malicioso ou SVG com script | T, E | Só JPEG, PNG e WebP, verificados por tipo e por magic bytes; SVG rejeitado; a fotografia é recodificada num canvas depois do recorte | Magic bytes, recodificação com sharp, quarentena |
| Ficheiro enorme | D | Máximo de 2 MB e limites de dimensões antes do envio | Limite no servidor |
| Envio para um destino externo | T, I | O URL assinado tem de ser um caminho `/api/` na mesma origem; qualquer outro é recusado | URL assinado de curta duração |
| Metadados EXIF com localização | I | O recorte em canvas elimina os metadados | sharp remove EXIF |

## 5. Painel em geral (RF-FE-22)

| Ameaça | STRIDE | Controlo no frontend | Controlo esperado no backend |
|--------|--------|----------------------|------------------------------|
| Acesso a ecrãs de outro papel | E | Menu e rotas por papel, apenas como usabilidade | Guard global, negar por defeito, RBAC |
| Acesso a dados de outra empresa | I, E | Nunca envia `company_id`; mostra 404 genérico | `company_id` da sessão; 404 entre empresas |
| Injeção de fórmulas no CSV exportado | T | Células que começam por `=`, `+`, `-`, `@`, tabulação ou CR são neutralizadas | — |
| Dependência comprometida | T, E | `ignoreScripts`, atraso de 7 dias, lockfile congelado, poucas dependências (ADR-0007) | Pipeline com auditoria e SBOM |
