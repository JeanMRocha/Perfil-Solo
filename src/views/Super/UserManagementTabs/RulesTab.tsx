import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type { RulesTabProps } from './types';

function formatLimit(value: number | null): string {
  if (value == null) return 'Sem limite';
  return String(value);
}

export default function RulesTab({
  initialCreditsConfig,
  adConfig,
  engagementRules,
  engagementPerformanceRows,
  onInitialCreditsConfigChange,
  onSaveInitialCredits,
  onAdConfigChange,
  onSaveAdConfig,
  onEngagementRuleChange,
  onSaveEngagementRules,
}: RulesTabProps) {
  return (
    <Stack>
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="end">
          <div>
            <Title order={5}>Credito inicial legado (opcional)</Title>
            <Text c="dimmed" size="sm">
              Mantido para compatibilidade. Recomendado manter 0 e usar regras de conquista.
            </Text>
          </div>
          <Group align="end">
            <NumberInput
              label="Créditos iniciais"
              min={0}
              value={initialCreditsConfig}
              onChange={(value) =>
                onInitialCreditsConfigChange(typeof value === 'number' ? value : '')
              }
              w={180}
            />
            <Button color="yellow" onClick={onSaveInitialCredits}>
              Salvar
            </Button>
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Regras de conquista por evento real</Title>
          <Text c="dimmed" size="sm">
            Defina creditos e limites por usuario. Limite 0 significa sem limite.
          </Text>

          {engagementRules.map((rule) => (
            <Card key={rule.id} withBorder radius="md" p="sm">
              <Stack gap={6}>
                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Text fw={700}>{rule.label}</Text>
                    <Text c="dimmed" size="xs">
                      {rule.description}
                    </Text>
                  </div>
                  <Badge color={rule.enabled ? 'teal' : 'gray'} variant={rule.enabled ? 'filled' : 'light'}>
                    {rule.enabled ? 'Ativa' : 'Desativada'}
                  </Badge>
                </Group>

                <Group align="end" grow>
                  <Switch
                    label="Habilitar regra"
                    checked={rule.enabled}
                    onChange={(event) =>
                      onEngagementRuleChange(rule.id, {
                        enabled: event.currentTarget.checked,
                      })
                    }
                  />

                  <NumberInput
                    label="Créditos"
                    min={0}
                    value={rule.credits}
                    onChange={(value) =>
                      onEngagementRuleChange(rule.id, {
                        credits: typeof value === 'number' ? value : rule.credits,
                      })
                    }
                  />

                  <NumberInput
                    label="Limite por usuário"
                    min={0}
                    value={rule.max_claims_per_user ?? 0}
                    onChange={(value) =>
                      onEngagementRuleChange(rule.id, {
                        max_claims_per_user:
                          typeof value === 'number'
                            ? value <= 0
                              ? null
                              : value
                            : rule.max_claims_per_user,
                      })
                    }
                  />
                </Group>
              </Stack>
            </Card>
          ))}

          <Group justify="flex-end">
            <Button color="teal" onClick={onSaveEngagementRules}>
              Salvar regras de conquista
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Recompensa por propaganda (app store)</Title>
          <Text c="dimmed" size="sm">
            Controle do super usuario para ganhos por visualizacao de propaganda.
          </Text>
          <Group align="end" grow>
            <Switch
              label="Habilitar recompensa"
              checked={adConfig.enabled}
              onChange={(event) =>
                onAdConfigChange({ ...adConfig, enabled: event.currentTarget.checked })
              }
            />
            <NumberInput
              label="Créditos por propaganda"
              min={1}
              value={adConfig.credits_per_view}
              onChange={(value) =>
                onAdConfigChange({
                  ...adConfig,
                  credits_per_view:
                    typeof value === 'number' ? value : adConfig.credits_per_view,
                })
              }
            />
            <NumberInput
              label="Limite diario por usuário"
              min={1}
              value={adConfig.daily_limit_per_user}
              onChange={(value) =>
                onAdConfigChange({
                  ...adConfig,
                  daily_limit_per_user:
                    typeof value === 'number' ? value : adConfig.daily_limit_per_user,
                })
              }
            />
            <NumberInput
              label="Cooldown (min)"
              min={0}
              value={adConfig.cooldown_minutes}
              onChange={(value) =>
                onAdConfigChange({
                  ...adConfig,
                  cooldown_minutes:
                    typeof value === 'number' ? value : adConfig.cooldown_minutes,
                })
              }
            />
          </Group>
          <Group justify="flex-end">
            <Button color="teal" onClick={onSaveAdConfig}>
              Salvar regras de propaganda
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Desempenho por usuario</Title>
          <Text c="dimmed" size="sm">
            Acompanhe quantas conquistas foram aplicadas por regra.
          </Text>

          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Total creditos</Table.Th>
                <Table.Th>Total conquistas</Table.Th>
                {engagementRules.map((rule) => (
                  <Table.Th key={rule.id}>{rule.label}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {engagementPerformanceRows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={3 + engagementRules.length}>
                    <Text c="dimmed">Sem dados de desempenho no momento.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                engagementPerformanceRows.map((row) => (
                  <Table.Tr key={row.user_id}>
                    <Table.Td>
                      <Text fw={600}>{row.user_name}</Text>
                      <Text size="xs" c="dimmed">
                        {row.user_email || row.user_id}
                      </Text>
                    </Table.Td>
                    <Table.Td>{row.total_credits}</Table.Td>
                    <Table.Td>{row.total_claims}</Table.Td>
                    {engagementRules.map((rule) => {
                      const perf = row.by_rule[rule.id];
                      return (
                        <Table.Td key={`${row.user_id}:${rule.id}`}>
                          {perf.count} / {formatLimit(perf.max_claims_per_user)}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>
    </Stack>
  );
}
