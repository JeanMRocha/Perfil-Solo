import { memo } from 'react';
import {
  Alert,
  Badge,
  Divider,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import type {
  SoilClassificationValidation,
  SoilResultResponse,
} from '@services/soilClassificationContractService';
import { ConfidenceMeter } from './ConfidenceMeter';
import { NextStepsPanel } from './NextStepsPanel';

type RuleEngineReportProps = {
  response: SoilResultResponse | null;
  validation: SoilClassificationValidation | null;
};

export const RuleEngineReport = memo(function RuleEngineReport({
  response,
  validation,
}: RuleEngineReportProps) {
  if (!response) {
    return (
      <Paper withBorder p="md" radius="md">
        <Text size="sm" c="dimmed">
          Execute a classificacao para exibir o relatorio tecnico.
        </Text>
      </Paper>
    );
  }

  const primary = response.result.primary;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="start">
          <div>
            <Title order={5}>Relatorio tecnico</Title>
            <Text size="sm" c="dimmed">
              Resultado auditavel da classificacao SiBCS.
            </Text>
          </div>
          <Badge size="lg" variant="filled">
            {primary.order}
          </Badge>
        </Group>

        <ConfidenceMeter confidence={primary.confidence} mode={primary.mode} />

        {validation && (!validation.valid || validation.warnings.length > 0) && (
          <Stack gap={6}>
            {!validation.valid && (
              <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                <Text size="sm" fw={600}>
                  Erros de validacao de entrada
                </Text>
                <List size="xs">
                  {validation.errors.map((item, index) => (
                    <List.Item key={`validation-error-${index}`}>{item}</List.Item>
                  ))}
                </List>
              </Alert>
            )}
            {validation.warnings.length > 0 && (
              <Alert color="yellow" icon={<IconAlertCircle size={16} />} variant="light">
                <Text size="sm" fw={600}>
                  Alertas de validacao
                </Text>
                <List size="xs">
                  {validation.warnings.map((item, index) => (
                    <List.Item key={`validation-warning-${index}`}>{item}</List.Item>
                  ))}
                </List>
              </Alert>
            )}
          </Stack>
        )}

        <Divider />

        <div>
          <Text size="sm" fw={600} mb={6}>
            Evidencias positivas
          </Text>
          <List size="sm" spacing="xs">
            {response.audit.positive_evidence.map((item, index) => (
              <List.Item key={`positive-${index}`} icon={<IconCircleCheck size={14} />}>
                {item.detail}
              </List.Item>
            ))}
          </List>
        </div>

        {response.audit.conflicts.length > 0 && (
          <div>
            <Text size="sm" fw={600} mb={6}>
              Conflitos
            </Text>
            <List size="sm" spacing="xs">
              {response.audit.conflicts.map((item, index) => (
                <List.Item key={`conflict-${index}`} icon={<IconAlertCircle size={14} />}>
                  {item.detail}
                </List.Item>
              ))}
            </List>
          </div>
        )}

        {response.alternatives.length > 0 && (
          <div>
            <Text size="sm" fw={600} mb={6}>
              Top alternativas
            </Text>
            <Stack gap={6}>
              {response.alternatives.map((alt, index) => (
                <Paper key={`alt-${index}`} withBorder p="xs" radius="sm">
                  <Group justify="space-between" align="center">
                    <Text size="sm" fw={600}>
                      {alt.order}
                    </Text>
                    <Badge variant="light">{alt.confidence}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {alt.why_competes}
                  </Text>
                </Paper>
              ))}
            </Stack>
          </div>
        )}

        {response.agronomic_alerts.length > 0 && (
          <div>
            <Text size="sm" fw={600} mb={6}>
              Alertas agronomicos
            </Text>
            <Stack gap={6}>
              {response.agronomic_alerts.map((alert, index) => (
                <Alert
                  key={`agro-alert-${index}`}
                  color={alert.severity === 'high' ? 'red' : alert.severity === 'medium' ? 'yellow' : 'blue'}
                  variant="light"
                >
                  <Text size="sm" fw={600}>
                    {alert.type}
                  </Text>
                  <Text size="xs">{alert.message}</Text>
                </Alert>
              ))}
            </Stack>
          </div>
        )}

        <NextStepsPanel nextSteps={response.next_steps} />
      </Stack>
    </Paper>
  );
});
