import { useMemo } from 'react';
import { encode } from 'uqr';

interface QrCodeProps {
  value: string;
  /** Descrição para leitores de ecrã. */
  title: string;
  className?: string;
}

const QUIET_ZONE = 2;

/**
 * QR Code desenhado localmente como SVG (ADR-0006: sem CDNs nem `dangerouslySetInnerHTML`).
 * Cada módulo escuro é um quadrado num único `path`. As cores são fixas (preto sobre branco) para
 * garantir o contraste que os leitores de QR precisam, em qualquer tema.
 */
export function QrCode({ value, title, className }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const result = encode(value);
    const segments: string[] = [];
    for (let y = 0; y < result.size; y += 1) {
      const row = result.data[y];
      if (!row) continue;
      for (let x = 0; x < result.size; x += 1) {
        if (row[x]) segments.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
      }
    }
    return { size: result.size, path: segments.join('') };
  }, [value]);

  const total = size + QUIET_ZONE * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
