# NFC Business — Prompt do frontend

Com base no prompt mestre do NFC Business (CLAUDE.md na raiz do projeto), desenvolve o frontend completo do sistema. Respeita a stack, as regras de segurança e o processo SCRCD já definidos.

## OBJETIVO

O frontend tem duas partes no mesmo projeto Vite:
- A página pública do cartão: rápida, leve, mobile-first, aberta a partir de um toque NFC ou de um QR Code.
- O painel: responsivo, claro e orientado a tarefas, para administradores, empresas e fornecedores.

## ECRÃS E ROTAS

**Página pública /c/:token.** Fotografia, nome, cargo, empresa, descrição e botões de ação (Guardar contacto em VCF, Ligar, WhatsApp, Email, Website, Localização). Também as redes sociais e um botão para partilhar ou mostrar o QR Code. Aplica o tema do perfil. Quando o dono do cartão tem sessão iniciada, aparece-lhe também o botão Enviar o meu contacto. O estado de cartão indisponível é uma página neutra, sem indicar o motivo. Opcional: /p/:slug com o mesmo conteúdo.

**Autenticação.** Login, verificação MFA, configuração de MFA (QR TOTP e códigos de recuperação), recuperar password, definir nova password e aceitar convite.

**Dashboard.** Resumo de visitas, cliques, downloads de VCF e contactos enviados. Inclui atalhos para as ações mais comuns, com Enviar contacto em destaque para o profile_owner.

**Empresas (só platform_admin).** Listar, criar, editar, carregar logótipo e definir a identidade visual.

**Membros (company_admin).** Listar, convidar por email, alterar papel e remover. Ações destrutivas pedem confirmação.

**Cartões.** Lista com pesquisa, filtros por estado e paginação. Criar cartão, associar a um perfil, ativar, desativar, marcar como perdido e bloquear, com confirmação. Ver o URL do chip e descarregar o QR Code em PNG e SVG. Histórico do cartão.

**Perfis.** Lista e editor com pré-visualização em tempo real em formato telemóvel. Campos do perfil, ordem dos contactos por drag-and-drop, um interruptor de visibilidade pública por campo e upload de fotografia com recorte.

**Enviar contacto.** Disponível no painel (no perfil e na lista de cartões) e na página pública, para o dono com sessão iniciada. O formulário é curto:
1. Escolher o perfil (pré-selecionado quando houver só um).
2. Indicar o nome do destinatário (opcional).
3. Indicar o número (com +258 por defeito) ou o email.
4. Escolher o canal: Email, WhatsApp ou SMS.
5. Escrever uma nota opcional de até 200 caracteres.
6. Ver a pré-visualização da mensagem antes de enviar.

Comportamento por canal:
- Email: envia pela API e mostra a confirmação.
- WhatsApp: abre wa.me com a mensagem e o link do cartão.
- SMS: abre sms: no dispositivo.

Inclui também o histórico de envios, com o destinatário mascarado, a data e o canal, e mensagens claras quando o limite de envios é atingido. O ecrã tem de funcionar bem com uma mão, num telemóvel, para o fornecedor o usar à frente do cliente.

**Temas e personalização.** Modelos, cores com verificação de contraste, logótipo e pré-visualização.

**Estatísticas.** Gráficos por período, cartão e empresa (visitas, cliques, VCF, contactos enviados) e exportação CSV.

**Auditoria (administradores).** Tabela filtrável de ações.

**Conta.** Dados pessoais, password, MFA e sessões ativas, com a opção de terminar todas.

**Páginas de erro.** 403, 404, 500 e sessão expirada.

## PERMISSÕES NA INTERFACE

O menu e as ações aparecem conforme o papel (platform_admin, company_admin, company_editor, profile_owner). Esconder elementos é só uma questão de usabilidade: a proteção real está sempre na API.

Trata de forma centralizada as respostas:
- 401: redireciona para o login.
- 403: mostra uma mensagem clara.
- 429: informa que o limite foi atingido.

## SEGURANÇA NO FRONTEND

- Todas as chamadas vão para /api na mesma origem, com credentials include.
- Nunca há tokens, chaves ou segredos no código, em variáveis VITE_ ou no armazenamento do browser.
- O cabeçalho X-CSRF-Token é enviado em todos os POST, PATCH e DELETE.
- dangerouslySetInnerHTML é proibido (regra react/no-danger no ESLint).
- O código tem de ser compatível com uma CSP estrita: sem scripts inline, sem CDNs externos, fontes e ícones servidos localmente, e QR Code gerado localmente.
- Links externos têm rel="noopener noreferrer" e só aceitam https.
- Os links wa.me e sms: são construídos a partir de dados já validados.
- Os schemas Zod são partilhados com o backend.
- Os uploads são validados no cliente (tipo, 2 MB, dimensões), sem SVG.
- As mensagens de erro são genéricas.
- Não há dados pessoais em logs nem em ferramentas de terceiros.
- O dev server do Vite corre só em 127.0.0.1.

## DESIGN E QUALIDADE

- Design profissional e sóbrio, com Tailwind e shadcn/ui, e modo claro e escuro no painel. Se houver ecrãs exportados do Google Stitch, segue esse design.
- A página pública tem de carregar em menos de 1,5 segundos em 4G e o JavaScript inicial deve ficar abaixo de 100 KB comprimido (o painel é carregado em lazy).
- Cumpre o WCAG 2.2 AA: contraste, navegação por teclado, foco visível, labels e textos alternativos.
- Todos os ecrãs com dados têm estados de carregamento, vazio e erro.
- A interface é em português, com textos centralizados para tradução futura.
- Funciona em Android e iPhone, a partir de 360 px de largura.

## ESTRUTURA E TESTES

Organiza o código por funcionalidade: src/features/auth, cards, profiles, companies, members, contact-sending, analytics, themes, audit e public-card, com src/shared para componentes, cliente da API, schemas e hooks.

Usa MSW para simular a API enquanto o backend não estiver pronto, seguindo os endpoints definidos no prompt mestre.

Testes:
- Vitest e Testing Library para componentes e formulários.
- axe para acessibilidade.
- Playwright para os fluxos principais:
  1. Login com MFA.
  2. Criar e ativar um cartão.
  3. Editar um perfil.
  4. Abrir a página pública e descarregar o VCF.
  5. Iniciar sessão, enviar o contacto por email e ver o envio no histórico.

## ORDEM DE TRABALHO

1. Base do projeto, layout, routing e cliente da API.
2. Autenticação.
3. Página pública.
4. Cartões e perfis.
5. Envio de contacto.
6. Empresas e membros.
7. Estatísticas, temas e auditoria.
8. Conta.
9. Testes finais.

Em cada passo, atualiza o PROJECT_STATE, o grafo e os ADRs, e só marca como concluído o que cumprir a Definition of Done.
