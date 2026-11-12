// Geração de QR Code localmente (ADR-0006). `uqr` dá a matriz; aqui montamos um SVG completo
// para transferência. Para renderizar no ecrã usa-se o componente `ui/qr-code` (desenha a matriz em JSX).
import { encode } from 'uqr';

export interface QrSvgOptions {
  /** Pixels por módulo (define a dimensão final do SVG). */
  scale?: number;
  /** Margem (quiet zone) em módulos. */
  margin?: number;
}

/** SVG completo (com `xmlns`), próprio para gravar como ficheiro `.svg`. Preto sobre branco. */
export function qrSvgMarkup(value: string, options: QrSvgOptions = {}): string {
  const scale = options.scale ?? 8;
  const margin = options.margin ?? 2;
  const { size, data } = encode(value);
  const dimension = size + margin * 2;

  let rects = '';
  for (let y = 0; y < size; y += 1) {
    const row = data[y];
    if (!row) continue;
    for (let x = 0; x < size; x += 1) {
      if (row[x]) rects += `<rect x="${x + margin}" y="${y + margin}" width="1" height="1"/>`;
    }
  }

  const pixelSize = dimension * scale;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" ` +
    `width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges">` +
    `<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects}</g></svg>`
  );
}
