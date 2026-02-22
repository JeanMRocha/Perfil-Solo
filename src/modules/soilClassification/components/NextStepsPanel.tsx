import { memo } from 'react';
import { Badge, List, Paper, Stack, Text, Title } from '@mantine/core';
import type { SoilResultResponse } from '@services/soilClassificationContractService';

type NextStepsPanelProps = {
  nextSteps: SoilResultResponse['next_steps'];
};

export const NextStepsPanel = memo(function NextStepsPanel({
  nextSteps,
}: NextStepsPanelProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Title order={6}>Proximos passos</Title>
        {!nextSteps.length && (
          <Text size="sm" c="dimmed">
            Sem pendencias no momento.
          </Text>
        )}
        {nextSteps.length > 0 && (
          <List spacing="xs" size="sm">
            {nextSteps.map((step, index) => (
              <List.Item key={`next-step-${index}`}>
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {step.what}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {step.why}
                  </Text>
                  <div>
                    <Badge size="xs" variant="light" mr={6}>
                      {step.action === 'lab_test' ? 'Teste de laboratorio' : 'Validacao de campo'}
                    </Badge>
                    <Badge size="xs" variant="outline">
                      {step.expected_impact === 'resolve_conflict' ? 'Resolver conflito' : 'Aumentar confianca'}
                    </Badge>
                  </div>
                </Stack>
              </List.Item>
            ))}
          </List>
        )}
      </Stack>
    </Paper>
  );
});
