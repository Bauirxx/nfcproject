# Chaves de demonstração

O projeto ainda não usa nenhuma chave real: não há `.env`, chaves de API nem credenciais do Supabase ou de email. Tudo o que está aqui é fictício (domínios `.test`) e só funciona na API simulada do frontend. A origem destes valores é `apps/web/src/mocks/credentials.ts` e `apps/web/src/mocks/seed.ts`; se mudarem lá, este ficheiro tem de ser atualizado.

Os ecrãs de login ainda não estão feitos, por isso estas contas só vão servir a partir do passo 2 (autenticação).

## Contas

| Papel | Nome | Email | Palavra-passe | Chave TOTP |
| --- | --- | --- | --- | --- |
| platform_admin | Marta Nhaca | admin@nfcbusiness.test | Plataforma#2026 | JBSWY3DPEHPK3PXP |
| company_admin (Acme) | Ana Macuácua | ana.admin@acme.test | Empresa#2026ok | KRSXG5CTMVRXEZLU |
| company_editor (Acme) | Eduardo Sitoe | edu.editor@acme.test | Editor#2026okay | sem MFA |
| profile_owner (Acme) | Paula Machava | paula.owner@acme.test | Perfil#2026okay | sem MFA |
| profile_owner (Acme) | Carlos Mondlane | carlos.owner@acme.test | Perfil#2026okay | sem MFA |
| company_admin (Beta), ainda sem MFA configurado | Nelson Tembe | novo.admin@beta.test | Empresa#2026ok | por configurar |
| profile_owner (Beta) | Rita Cossa | rita.owner@beta.test | Perfil#2026okay | sem MFA |

Para entrar com uma conta de administrador, adicione a chave TOTP a uma aplicação de autenticação (Google Authenticator, Authy ou outra) com «introduzir chave manualmente», tipo «baseada no tempo».

## Códigos de recuperação (uso único)

| Conta | Códigos |
| --- | --- |
| Marta Nhaca | NFCBP-M3T5W, NFCBP-A2B3C |
| Ana Macuácua | NFCBA-K7Q2M, NFCBA-D4E5F |

## Endereços de teste

| Para quê | Endereço |
| --- | --- |
| Página pública de um cartão ativo (Paula) | `/c/Zk3vQ9xLr2TnB7wYc1HdMg` |
| Cartão bloqueado (tem de mostrar a página neutra) | `/c/Bl0ckedCardT0ken000001` |
| Página pública pelo endereço amigável | `/p/paula-machava` |
| Definir nova palavra-passe (Paula) | `/definir-password?token=mock-reset-token-0001` |
| Aceitar convite (`convidado@acme.test`) | `/convite?token=mock-invite-token-0001` |

## Quando houver chaves reais

As chaves do Supabase, do fornecedor de email e do alojamento só vão existir com o backend. Nessa altura ficam em ficheiros `.env` fora do repositório e nunca em variáveis `VITE_` (CLAUDE.md, regra 9).
