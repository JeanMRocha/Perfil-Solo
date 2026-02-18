import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Text,
  Group,
  AppShell,
  NavLink,
  Card,
  Button,
  SimpleGrid,
  Divider,
  Title,
} from '@mantine/core';
import {
  IconHome,
  IconFlask,
  IconMap,
  IconUser,
  IconGraph,
  IconSettings,
  IconMenu2,
  IconBuilding,
} from '@tabler/icons-react';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useStore($currUser);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      {/* 🌿 HEADER SUPERIOR */}
      <AppShell.Header>
        <Group justify="space-between" px="md" h="100%">
          <Group>
            <Title order={3} c="green.8">
              🌱 PerfilSolo
            </Title>
          </Group>

          <Group>
            <Text fw={500} fz="md" c="gray.8">
              {user?.user_metadata?.name || user?.email || 'Usuário'}
            </Text>
            <Button
              variant="light"
              color="red"
              onClick={() => {
                // dispara erro proposital para testar ErrorBoundary + logger
                throw new Error('Erro de teste disparado via botão');
              }}
            >
              Testar ErrorBoundary
            </Button>
            <ActionIcon
              variant="light"
              color="green"
              size="lg"
              radius="md"
              onClick={() => navigate('/user')}
            >
              <IconMenu2 size={20} />
            </ActionIcon>

            <ActionIcon
              variant="light"
              color="gray"
              size="lg"
              radius="md"
              onClick={() => navigate('/config')}
            >
              <IconSettings size={20} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      {/* 🌾 MENU LATERAL */}
      <AppShell.Navbar p="md">
        <NavLink
          label="Dashboard"
          leftSection={<IconHome size={18} />}
          active
          onClick={() => navigate('/dashboard')}
        />
        <NavLink
          label="Propriedades"
          leftSection={<IconMap size={18} />}
          onClick={() => navigate('/propriedades')}
        />
        <NavLink
          label="Análises de Solo"
          leftSection={<IconFlask size={18} />}
          onClick={() => navigate('/analise-solo')}
        />
        <NavLink
          label="Relatórios"
          leftSection={<IconGraph size={18} />}
          onClick={() => navigate('/relatorios')}
        />
        <NavLink
          label="Clientes"
          leftSection={<IconUser size={18} />}
          onClick={() => navigate('/clientes')}
        />
      </AppShell.Navbar>

      {/* 🌍 CONTEÚDO PRINCIPAL */}
      <AppShell.Main>
        <Title order={3} mb="md" c="green.8">
          Painel Geral
        </Title>
        <Divider mb="lg" />

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {/* CARD 1 */}
          <Card
            shadow="md"
            radius="md"
            withBorder
            p="xl"
            style={{
              background: 'linear-gradient(135deg, #f6fff8 0%, #e3fcef 100%)',
            }}
          >
            <Group justify="space-between">
              <IconBuilding size={32} color="#16a34a" />
              <Text fz="lg" fw={600}>
                Propriedades Ativas
              </Text>
            </Group>
            <Text fz="xl" fw={800} mt="xs" c="green.8">
              12
            </Text>
            <Text size="sm" c="dimmed">
              Fazendas cadastradas no sistema
            </Text>
          </Card>

          {/* CARD 2 */}
          <Card
            shadow="md"
            radius="md"
            withBorder
            p="xl"
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            }}
          >
            <Group justify="space-between">
              <IconGraph size={32} color="#22c55e" />
              <Text fz="lg" fw={600}>
                Glebas Monitoradas
              </Text>
            </Group>
            <Text fz="xl" fw={800} mt="xs" c="green.8">
              34
            </Text>
            <Text size="sm" c="dimmed">
              Áreas com histórico de coletas
            </Text>
          </Card>

          {/* CARD 3 - ANÁLISES DE SOLO */}
          <Card
            shadow="lg"
            radius="md"
            withBorder
            p="xl"
            style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
            }}
            onClick={() => navigate('/analise-solo')}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = 'scale(1.02)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = 'scale(1.0)')
            }
          >
            <Group justify="space-between">
              <IconFlask size={32} color="#16a34a" />
              <Text fz="lg" fw={600}>
                Análises de Solo
              </Text>
            </Group>
            <Text fz="xl" fw={800} mt="xs" c="green.8">
              58
            </Text>
            <Text size="sm" c="dimmed" mb="sm">
              Acesse suas interpretações e relatórios
            </Text>
            <Button color="green" fullWidth variant="light">
              Acessar módulo
            </Button>
          </Card>

          {/* CARD 4 */}
          <Card shadow="sm" radius="md" withBorder p="xl">
            <Text fw={600} fz="lg" mb="xs">
              Últimas Análises
            </Text>
            <Text c="dimmed">Abacate - 24/10/2025</Text>
            <Text c="green.8" fw={700}>
              Em conformidade
            </Text>
          </Card>

          {/* CARD 5 */}
          <Card shadow="sm" radius="md" withBorder p="xl">
            <Text fw={600} fz="lg" mb="xs">
              Próximas Coletas
            </Text>
            <Text c="dimmed">Fazenda Vale Verde - 28/10/2025</Text>
            <Text c="orange.6" fw={700}>
              Agendada
            </Text>
          </Card>
        </SimpleGrid>
      </AppShell.Main>
    </AppShell>
  );
}
