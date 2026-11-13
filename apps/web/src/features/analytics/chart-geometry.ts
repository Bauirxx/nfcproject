// Geometria pura de um gráfico de linha (sem DOM), para desenhar em SVG e para testar.

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LineGeometry {
  points: Array<{ x: number; y: number }>;
  /** Caminho SVG da linha (`M … L …`). */
  line: string;
  /** Caminho SVG da área sob a linha, fechada à base. */
  area: string;
  /** Máximo usado na escala vertical (nunca inferior a 1). */
  max: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Escala os valores para a caixa dada. Um único ponto é colocado no centro horizontal. */
export function lineGeometry(
  values: readonly number[],
  width: number,
  height: number,
  padding: ChartPadding,
): LineGeometry {
  const max = Math.max(1, ...values);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const baseline = height - padding.bottom;

  const x = (index: number): number => {
    if (values.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (values.length - 1)) * innerWidth;
  };
  const y = (value: number): number => baseline - (value / max) * innerHeight;

  const points = values.map((value, index) => ({ x: round(x(index)), y: round(y(value)) }));
  if (points.length === 0) {
    return { points, line: '', area: '', max };
  }

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const area = `${line} L${last.x} ${round(baseline)} L${first.x} ${round(baseline)} Z`;
  return { points, line, area, max };
}
