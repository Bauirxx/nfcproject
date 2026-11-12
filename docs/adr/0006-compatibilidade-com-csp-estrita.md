# ADR-0006 — Compatibilidade com CSP estrita

- Estado: Aceite
- Data: 2026-11-10

## Contexto

A regra 9 do prompt mestre exige `default-src 'self'` e `frame-ancestors 'none'`. Sem uma diretiva `style-src` própria, isto proíbe também elementos `<style>` criados em tempo de execução e atributos `style` no HTML. O alojamento é estático, por isso não há nonce por pedido. Várias bibliotecas comuns do ecossistema shadcn/ui injetam `<style>` em tempo de execução.

## Decisão

O frontend é construído para funcionar com esta política, sem `'unsafe-inline'` em scripts nem em estilos:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:;
font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Regras que daí resultam:

1. **Sem scripts inline.** O `index.html` só tem `<script type="module" src>`. O tema claro ou escuro é aplicado pelo módulo do painel.
2. **Sem `<style>` em tempo de execução.** Todo o CSS sai do Tailwind para ficheiros estáticos. Os estilos dinâmicos (cores do tema do perfil, posições) passam pela propriedade `style` do React, que escreve pelo CSSOM e não é bloqueada pela CSP.
3. **Componentes escolhidos por causa disto:**
   - Diálogos: Radix Dialog e AlertDialog com sobreposição própria. O `Overlay` do Radix monta o `react-remove-scroll`, que injeta um `<style>`; o bloqueio de scroll é feito com uma classe em `<html>`.
   - Menus: Radix DropdownMenu com `modal={false}`, pela mesma razão.
   - Seleção: `<select>` nativo com estilo shadcn. O Select do Radix injeta um `<style>`. O nativo é também melhor num telemóvel, com uma mão.
   - Notificações: componente próprio com região `aria-live`. O `sonner` injeta o seu CSS em tempo de execução.
   - Interruptores: `<input type="checkbox" role="switch">` nativo.
   - Gráficos: SVG próprio, sem biblioteca.
4. **Fontes do sistema.** Nenhuma fonte web é descarregada.
5. **Ícones locais.** `lucide-react`, incluído no bundle por ícone.
6. **QR Code local.** Gerado no browser com `uqr`.
7. **Imagens.** `img-src` aceita `https:` porque as fotografias vêm do armazenamento público. Quando o domínio for conhecido, a política deve restringir-se a ele.

A política é aplicada no `vite preview` e os testes Playwright falham se o browser reportar alguma violação.

## Alternativas

1. Permitir `style-src 'unsafe-inline'`: enfraquece a política e contraria «CSP estrita».
2. Nonce por pedido: exige um servidor ou função de edge a servir o HTML.
3. Substituir todo o Radix por elementos nativos: mais código próprio de acessibilidade para manter.

## Justificação

Verificar a CSP nos testes de ponta a ponta transforma «compatível com CSP estrita» num critério observável, em vez de uma intenção.

## Consequências

- Antes de acrescentar uma biblioteca de interface, confirmar que não injeta `<style>` nem usa `eval`.
- Os componentes shadcn/ui são copiados para `src/shared/components/ui` e adaptados; não se usa o CLI às cegas.
- O service worker do MSW só existe em desenvolvimento e no modo `e2e`; nunca entra no build de produção.
