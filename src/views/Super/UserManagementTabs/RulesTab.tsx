import { Button, Card, Group, NumberInput, Stack, Switch, Text, Title } from '@mantine/core';
import type { RulesTabProps } from './types';

export default function RulesTab({
  initialCreditsConfig,
  adConfig,
  onInitialCreditsConfigChange,
  onSaveInitialCredits,
  onAdConfigChange,
  onSaveAdConfig,
}: RulesTabProps) {
  return (
    <Stack>
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="end">
          <div>
            <Title order={5}>Credito inicial para novos cadastros</Title>
            <Text c="dimmed" size="sm">
              Este valor sera aplicado automaticamente no primeiro acesso de cada novo usuario.
            </Text>
          </div>
          <Group align="end">
            <NumberInput
              label="Creditos iniciais"
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
          <Title order={5}>Recompensa por propaganda (app store)</Title>
          <Text c="dimmed" size="sm">
            Controle do super usuario para liberar 1 credito por propaganda vista.
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
              label="Creditos por propaganda"
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
              label="Limite diario por usuario"
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
    </Stack>
  );
}
