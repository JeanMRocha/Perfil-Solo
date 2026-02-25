// src/views/AnaliseSolo/GraficoAnalise.tsx
import { normalizar200, corDoStatus, FaixaIdeal } from './soilConfig';

type Props = {
  valores: Record<string, number>;
  faixas: FaixaIdeal;
  onSelectNutriente?: (id: string) => void;
};

function NutrientBar({
  id,
  valor,
  faixa,
  onClick,
}: {
  id: string;
  valor: number;
  faixa: [number, number];
  onClick?: () => void;
}) {
  const pct = normalizar200(valor, faixa); // 0–200%
  const [min, max] = faixa;
  const minPct = normalizar200(min, faixa);
  const maxPct = normalizar200(max, faixa);
  const color = corDoStatus(valor, faixa);

  const bgColor =
    color === 'red'
      ? 'rgba(239,68,68,0.9)'
      : color === 'blue'
        ? 'rgba(59,130,246,0.9)'
        : 'rgba(34,197,94,0.9)';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{id}</span>
        <span className="text-sm text-muted-foreground">
          {valor.toFixed(2)} (ideal {min}–{max})
        </span>
      </div>

      <div
        onClick={onClick}
        title={`${pct.toFixed(0)}% do alvo`}
        className="relative h-3.5 cursor-pointer overflow-hidden rounded-lg"
        style={{
          background:
            'linear-gradient(90deg, rgba(120,120,120,.12) 0%, rgba(120,120,120,.12) 100%)',
        }}
      >
        {/* sombra: faixa ideal em verde-claro */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${Math.min(minPct, maxPct)}%`,
            width: `${Math.abs(maxPct - minPct)}%`,
            background: 'rgba(34,197,94,.25)',
          }}
        />

        {/* barra do valor atual */}
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            background: bgColor,
          }}
        />
      </div>
    </div>
  );
}

export function GraficoAnalise({ valores, faixas, onSelectNutriente }: Props) {
  const ids = Object.keys(valores);

  return (
    <div className="flex flex-col gap-4">
      <span className="font-bold">Interpretação (0–200%)</span>
      <div className="flex flex-col gap-3">
        {ids.map((id) => (
          <NutrientBar
            key={id}
            id={id}
            valor={valores[id]}
            faixa={faixas[id as keyof FaixaIdeal] ?? [0, 0]}
            onClick={() => onSelectNutriente?.(id)}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Verde = dentro do ideal, Vermelho = abaixo, Azul = acima. A faixa
        esverdeada representa o intervalo ideal para o parâmetro selecionado.
      </p>
    </div>
  );
}

export default GraficoAnalise;
