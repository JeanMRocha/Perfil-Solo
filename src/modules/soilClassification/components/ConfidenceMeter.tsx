import { memo } from 'react';
import { Badge, Group, Progress, Text } from '@mantine/core';

type ConfidenceMeterProps = {
  confidence: number;
  mode: 'deterministic' | 'probabilistic';
};

function resolveColor(confidence: number): 'red' | 'yellow' | 'green' {
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

export const ConfidenceMeter = memo(function ConfidenceMeter({
  confidence,
  mode,
}: ConfidenceMeterProps) {
  const safe = Math.max(0, Math.min(100, Math.round(confidence)));
  const color = resolveColor(safe);
  return (
    <div>
      <Group justify="space-between" mb={6}>
        <Text size="sm" fw={600}>
          Confianca da classificacao
        </Text>
        <Group gap={8}>
          <Badge size="sm" color={color} variant="light">
            {resolveLabel(safe)}
          </Badge>
          <Badge size="sm" variant="outline">
            {mode === 'deterministic' ? 'deterministico' : 'probabilistico'}
          </Badge>
        </Group>
      </Group>
      <Progress value={safe} color={color} radius="xl" />
      <Text size="xs" c="dimmed" mt={4}>
        Score tecnico: {safe}/100
      </Text>
    </div>
  );
});
