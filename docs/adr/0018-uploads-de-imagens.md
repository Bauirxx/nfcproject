# ADR-0018: Uploads de imagens com quarentena e processamento isolado

- Estado: Aceite
- Data: 2026-11-18
- Relacionados: ADR-0017 (service_role isolada); CLAUDE.md, regra 8

## Decisão

1. **Pedido.** `POST /api/uploads/sign` exige a permissão do recurso de destino:
   - `profiles.edit` para a fotografia;
   - `themes.manage` para o logótipo do tema;
   - `companies.manage` para o logótipo da empresa.

   Regista o pedido em `app.uploads` (RLS por empresa, válido 15 minutos) e devolve `fileId` e `uploadUrl = /api/uploads/<fileId>`, na mesma origem.
2. **Receção.** `PUT /api/uploads/<fileId>` aceita um corpo binário só nesta rota (`express.raw`), até 2 MB e só JPEG, PNG ou WebP. Fora disso, o erro sai em JSON. Só o próprio utilizador e só uma vez. São verificados:
   - o tamanho exato anunciado;
   - o tipo pelos magic bytes, igual ao declarado e ao cabeçalho (o SVG é sempre recusado).
3. **Quarentena.** O original vai para o bucket privado `uploads-quarantine` e é apagado no fim do processamento, mesmo em erro.
4. **Processamento isolado.** O sharp corre numa worker thread (`dist/image-worker.cjs`):
   - lançada com `env: {}`, por isso sem segredos;
   - com memória limitada, 15 segundos no máximo e uma worker por imagem;
   - `limitInputPixels` de 40 MP, contra bombas de descompressão;
   - endireita pela orientação, limita a 800 px (fotografia) ou 512 px (logótipos) e grava em WebP **sem metadados** (EXIF, GPS).

   Em produção a worker é obrigatória. Sem o build, os testes processam no próprio processo.
5. **Publicação.** A imagem final vai para o bucket público `public-images` com um nome gerado pelo sistema (`<fim>/<uuid>.webp`).
6. **Consumo.** Os perfis e as empresas consomem o `fileId` uma única vez, do próprio utilizador e para o fim indicado, na transação da alteração. Qualquer outro caso dá 422 `invalid_file`.
7. **Storage.** Só o `SupabaseAdminService` (ADR-0017) escreve. Os buckets não têm políticas para `anon` nem para `authenticated`.

## Consequências

- A migração `0003_uploads.sql` cria a tabela e os buckets e tem de ser aplicada pelo dono.
- Os uploads pedidos e nunca concluídos ficam com o estado `pending` e expiram. A limpeza periódica fica para a fase 4.
- As imagens públicas são servidas pelo Storage do Supabase (https), aceite pela CSP `img-src https:` do frontend.
