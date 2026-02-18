import { Stack, Text, Title } from '@mantine/core';
import CadastroAnaliseSolo from './CadastroAnaliseSolo';

export default function DashboardAnaliseSolo() {
  return (
    <Stack gap="md">
      <div>
        <Title order={3} c="green.8">
          Analises de Solo
        </Title>
        <Text size="sm" c="dimmed">
          Cadastro, interpretacao e historico da area.
        </Text>
      </div>
      <CadastroAnaliseSolo />
    </Stack>
  );
}
