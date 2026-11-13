import { useState } from 'react';
import { formatDayShort } from '@/shared/i18n/format';
import { analyticsTexts } from '@/shared/i18n/panel/analytics';
import { lineGeometry } from './chart-geometry';

const WIDTH = 360;
const HEIGHT = 140;
const PAD = { top: 16, right: 14, bottom: 22, left: 14 };

interface MetricLineChartProps {
  title: string;
  dates: readonly string[];
  values: readonly number[];
  total: number;
}

/**
 * Gráfico de linha de uma métrica ao longo do tempo (pequeno múltiplo, série única).
 * SVG desenhado localmente (ADR-0006, CSP estrita); uma cor semântica (sem paleta categórica).
 * O valor de cada dia é alcançável pelo rato e pelo teclado (círculos focáveis com `aria-label`).
 */
export function MetricLineChart({ title, dates, values, total }: MetricLineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = lineGeometry([...values], WIDTH, HEIGHT, PAD);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const summaryAria =
    firstDate && lastDate ? analyticsTexts.chart.summaryAria(title, formatDayShort(firstDate), formatDayShort(lastDate), geo.max) : title;

  const hovered = hover !== null ? geo.points[hover] : undefined;

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{total}</span>
      </figcaption>

      <div className="relative text-primary">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={summaryAria}>
          {/* linha de base */}
          <line
            x1={PAD.left}
            y1={HEIGHT - PAD.bottom}
            x2={WIDTH - PAD.right}
            y2={HEIGHT - PAD.bottom}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          {geo.area ? <path d={geo.area} fill="currentColor" fillOpacity={0.08} /> : null}
          {geo.line ? <path d={geo.line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" /> : null}

          {hovered ? (
            <line x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={HEIGHT - PAD.bottom} stroke="currentColor" strokeOpacity={0.3} />
          ) : null}

          {geo.points.map((point, index) => (
            <g key={index}>
              {hover === index ? <circle cx={point.x} cy={point.y} r={3.5} fill="currentColor" /> : null}
              {/* alvo invisível, focável, com o valor do dia para rato, teclado e leitores de ecrã */}
              <circle
                cx={point.x}
                cy={point.y}
                r={10}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={analyticsTexts.chart.point(formatDayShort(dates[index] ?? ''), values[index] ?? 0)}
                className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover((current) => (current === index ? null : current))}
                onFocus={() => setHover(index)}
                onBlur={() => setHover((current) => (current === index ? null : current))}
              />
            </g>
          ))}

          <text x={PAD.left} y={PAD.top - 4} className="fill-muted-foreground text-[10px]">
            {geo.max}
          </text>
          {firstDate ? (
            <text x={PAD.left} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]">
              {formatDayShort(firstDate)}
            </text>
          ) : null}
          {lastDate && dates.length > 1 ? (
            <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {formatDayShort(lastDate)}
            </text>
          ) : null}
        </svg>

        {hovered && hover !== null ? (
          <div
            // Posição em percentagem da caixa do SVG (responsivo, sem medir o DOM; CSP-safe via CSSOM do React).
            style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs shadow"
          >
            <div className="font-medium">{formatDayShort(dates[hover] ?? '')}</div>
            <div className="tabular-nums text-muted-foreground">{values[hover] ?? 0}</div>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
