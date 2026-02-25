import { Check, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from '@components/ui/card';
import { cn } from '@/lib/utils';
import type { AnaliseSolo } from '../../data/analisesMock';

/**
 * 🌿 RecomendacaoCard
 * Exibe um diagnóstico rápido de cada nutriente
 * com barras de progresso coloridas e tooltips.
 */
export default function RecomendacaoCard({
  analise,
}: {
  analise: AnaliseSolo;
}) {
  const nutrientes = Object.keys(analise.nutrientes);

  const classificar = (valor: number, min: number, max: number) => {
    if (valor < min)
      return { status: 'baixo', color: 'red', icon: <ArrowDown className="h-4 w-4" /> };
    if (valor > max)
      return { status: 'alto', color: 'violet', icon: <ArrowUp className="h-4 w-4" /> };
    return { status: 'ideal', color: 'green', icon: <Check className="h-4 w-4" /> };
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <span className="mb-3 block text-lg font-semibold text-brand">
          Diagnóstico resumido
        </span>

        {nutrientes.map((key) => {
          const valor = analise.nutrientes[key];
          const [min, max] = analise.faixaIdeal[key];
          const { status, color, icon } = classificar(valor, min, max);

          const percentual = Math.min(
            100,
            Math.max(0, ((valor - min) / (max - min)) * 100),
          );

          const tooltipMsg =
            status === 'baixo'
              ? `Baixo teor de ${key}. Avaliar adubação corretiva.`
              : status === 'alto'
                ? `Excesso de ${key}. Reduzir dose ou espaçar aplicações.`
                : `Nível ideal de ${key}. Manter manejo atual.`;

          const colorClasses = {
            red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
            green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
          };

          const barColors = {
            red: 'bg-red-500',
            violet: 'bg-violet-500',
            green: 'bg-green-500',
          };

          return (
            <div key={key} title={tooltipMsg} className="border-b border-border py-2 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded', colorClasses[color as keyof typeof colorClasses])}>
                    {icon}
                  </span>
                  <span className="font-medium">{key}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {valor.toFixed(2)} (ideal {min}–{max})
                </span>
              </div>

              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', barColors[color as keyof typeof barColors])}
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
