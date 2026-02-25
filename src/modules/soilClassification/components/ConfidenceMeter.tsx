import { memo } from 'react';
import { Badge } from '@components/ui/badge';
import { Progress } from '@components/ui/progress';
import { cn } from 'lib/utils';

type ConfidenceMeterProps = {
  confidence: number;
  mode: 'deterministic' | 'probabilistic';
};

function resolveColor(confidence: number): string {
  if (confidence >= 80) return 'green';
  if (confidence >= 60) return 'yellow';
  return 'red';
}

function resolveLabel(confidence: number): string {
  if (confidence >= 80) return 'Alta confianca';
  if (confidence >= 60) return 'Boa confianca';
  if (confidence >= 40) return 'Confianca moderada';
  return 'Confianca baixa';
}

const colorMap: Record<string, { badge: string; progress: string }> = {
  green: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    progress: '[&>div]:bg-green-500',
  },
  yellow: {
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    progress: '[&>div]:bg-yellow-500',
  },
  red: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    progress: '[&>div]:bg-red-500',
  },
};

export const ConfidenceMeter = memo(function ConfidenceMeter({
  confidence,
  mode,
}: ConfidenceMeterProps) {
  const safe = Math.max(0, Math.min(100, Math.round(confidence)));
  const color = resolveColor(safe);
  const colors = colorMap[color] ?? colorMap.green;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold">
          Confianca da classificacao
        </span>
        <div className="flex items-center gap-2">
          <Badge className={colors.badge} variant="secondary">
            {resolveLabel(safe)}
          </Badge>
          <Badge variant="outline">
            {mode === 'deterministic' ? 'deterministico' : 'probabilistico'}
          </Badge>
        </div>
      </div>
      <Progress value={safe} className={cn('h-2 rounded-full', colors.progress)} />
      <p className="mt-1 text-xs text-muted-foreground">
        Score tecnico: {safe}/100
      </p>
    </div>
  );
});
