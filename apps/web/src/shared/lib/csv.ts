// Geração de CSV protegida contra injeção de fórmulas (CLAUDE.md, regra 6 e modelo de ameaças §5):
// células que começam por =, +, -, @, tabulação ou retorno são neutralizadas com uma plica inicial.

export type CsvCell = string | number;

const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutraliza uma célula contra injeção de fórmulas e aplica as aspas do RFC 4180 quando preciso. */
export function escapeCsvCell(value: CsvCell): string {
  let text = typeof value === 'number' ? String(value) : value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Constrói um CSV (com cabeçalho) a partir de linhas de células. Linhas separadas por CRLF. */
export function buildCsv(headers: readonly CsvCell[], rows: ReadonlyArray<readonly CsvCell[]>): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return lines.join('\r\n');
}
