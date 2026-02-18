export type FaixaIdeal = Record<string, [number, number]>;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Normaliza um valor para escala visual de 0-200%.
 * 100% representa o limite superior da faixa ideal.
 */
export function normalizar200(
  valor: number,
  faixa: [number, number],
): number {
  const [min, max] = faixa;
  if (max <= min) return 0;
  const pct = ((valor - min) / (max - min)) * 100;
  return clamp(pct, 0, 200);
}

export function corDoStatus(
  valor: number,
  faixa: [number, number],
): 'red' | 'green' | 'blue' {
  const [min, max] = faixa;
  if (valor < min) return 'red';
  if (valor > max) return 'blue';
  return 'green';
}
