import { useEffect, useState } from 'react';
import { publicTexts } from '@/shared/i18n/public';

const QUIET_ZONE = 2;

interface QrState {
  path: string;
  total: number;
}

/**
 * QR Code da página pública. O `uqr` é carregado a pedido (ADR-0003): só quando o visitante abre o QR.
 * Desenhado como SVG a partir da matriz (sem `dangerouslySetInnerHTML`).
 */
export function PublicQr({ value, title }: { value: string; title: string }) {
  const [qr, setQr] = useState<QrState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    import('uqr')
      .then(({ encode }) => {
        if (!active) return;
        const result = encode(value);
        const segments: string[] = [];
        for (let y = 0; y < result.size; y += 1) {
          const row = result.data[y];
          if (!row) continue;
          for (let x = 0; x < result.size; x += 1) {
            if (row[x]) segments.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
          }
        }
        setQr({ path: segments.join(''), total: result.size + QUIET_ZONE * 2 });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (failed) return <p className="text-sm text-muted-foreground">{publicTexts.qr.failed}</p>;
  if (!qr) return <p className="text-sm text-muted-foreground">{publicTexts.qr.loading}</p>;

  return (
    <svg
      viewBox={`0 0 ${qr.total} ${qr.total}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      className="mx-auto h-48 w-48"
    >
      <rect width={qr.total} height={qr.total} fill="#ffffff" />
      <path d={qr.path} fill="#000000" />
    </svg>
  );
}
