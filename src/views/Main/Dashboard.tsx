import {
  Box,
  Button,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconFlask, IconMapPin2, IconUsersGroup } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <Box
      p={{ base: 'md', sm: 'lg' }}
      style={{
        minHeight: 420,
        borderRadius: 16,
        border: '1px solid rgba(22, 163, 74, 0.2)',
        background:
          'radial-gradient(circle at 20% 20%, rgba(34, 197, 94, 0.12), transparent 45%), radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.12), transparent 42%)',
      }}
    >
      <Stack gap="md" maw={760}>
        <Text size="sm" fw={700} c="green.7">
          FASE 1
        </Text>
        <Title order={2}>Painel em reconstrucao gamificada</Title>
        <Text c="dimmed">
          O painel antigo foi limpo. Nesta etapa, removemos cards e graficos para iniciar um
          novo fluxo visual mais dinamico.
        </Text>

        <Group gap="sm" mt="sm" wrap="wrap">
          <Button
            leftSection={<IconMapPin2 size={16} />}
            onClick={() => navigate('/propriedades')}
          >
            Abrir Propriedades
          </Button>
          <Button
            variant="light"
            leftSection={<IconFlask size={16} />}
            onClick={() => navigate('/analise-solo')}
          >
            Abrir Analises
          </Button>
          <Button
            variant="light"
            leftSection={<IconUsersGroup size={16} />}
            onClick={() => navigate('/cadastros/pessoas/busca')}
          >
            Abrir Pessoas
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
