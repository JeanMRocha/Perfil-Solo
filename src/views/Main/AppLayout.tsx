import {
  ActionIcon,
  Avatar,
  AppShell,
  Badge,
  Box,
  Drawer,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import {
  IconFlask,
  IconGraph,
  IconHome,
  IconLogout,
  IconMap,
  IconMenu2,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { $tema, alternarTema } from '@global/themeStore';
import { $loading } from '@global/loadingStore';
import { LoaderGlobal } from '@components/loaders';
import { $currUser } from '../../global-state/user';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  getProfile,
  PROFILE_UPDATED_EVENT,
  type UserProfile,
} from '../../services/profileService';

function normalizePlanLabel(input: unknown): string {
  const raw = String(input ?? 'free').trim().toLowerCase();
  if (!raw) return 'FREE';
  return raw.toUpperCase();
}

function resolveUserName(user: any): string {
  const candidate =
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    'Usuario';
  return String(candidate);
}

export default function AppLayout() {
  const tema = useStore($tema);
  const loading = useStore($loading);
  const user = useStore($currUser);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] =
    useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let alive = true;

    const loadProfile = async () => {
      const data = await getProfile();
      if (!alive) return;
      setProfile(data);
    };

    const onProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<UserProfile>;
      if (custom.detail) {
        setProfile(custom.detail);
        return;
      }
      void loadProfile();
    };

    void loadProfile();
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    window.addEventListener('storage', onProfileUpdated);

    return () => {
      alive = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
      window.removeEventListener('storage', onProfileUpdated);
    };
  }, []);

  const userName = resolveUserName(user);
  const userEmail = String(profile?.email ?? user?.email ?? 'usuario@local');
  const planLabel = normalizePlanLabel(
    (user as any)?.plan_id ?? (user as any)?.user_metadata?.plan_id,
  );
  const creditsValue =
    (user as any)?.plan_usage?.credits_remaining ??
    (user as any)?.user_metadata?.credits_remaining;
  const creditsLabel =
    creditsValue == null ? (isLocalDataMode ? 'LOCAL' : '--') : String(creditsValue);
  const avatarSource = profile?.avatar_url || profile?.logo_url || '';
  const companyName = profile?.company_name?.trim() || 'PerfilSolo';
  const headerBg = tema === 'dark' ? '#111827' : '#f0fdf4';
  const headerText = tema === 'dark' ? '#f3f4f6' : '#0f172a';
  const navBg = tema === 'dark' ? '#0b1220' : '#ffffff';

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const go = (path: string) => {
    closeDrawer();
    navigate(path);
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
      styles={{
        header: {
          background: headerBg,
          borderBottom: tema === 'dark' ? '1px solid #1f2937' : '1px solid #d1fae5',
        },
        navbar: {
          background: navBg,
          borderRight: tema === 'dark' ? '1px solid #1f2937' : '1px solid #e5e7eb',
        },
      }}
    >
      <AppShell.Header>
        <Group justify="space-between" px="md" h="100%">
          <Title order={3} c="green.8">
            PerfilSolo
          </Title>

          <Group gap="xs">
            <Avatar size="sm" radius="xl" src={avatarSource}>
              <IconUser size={14} />
            </Avatar>
            <Text fw={700} c={headerText} visibleFrom="sm">
              {userName}
            </Text>
            <Text size="xs" c={tema === 'dark' ? 'gray.4' : 'dimmed'} visibleFrom="lg">
              {companyName}
            </Text>
            <Badge variant="light" color="cyan" visibleFrom="md">
              Plano {planLabel}
            </Badge>
            <Badge variant="light" color="grape" visibleFrom="md">
              Creditos {creditsLabel}
            </Badge>
            <ActionIcon
              variant="light"
              color="green"
              size="lg"
              radius="md"
              onClick={openDrawer}
              title="Menu do usuario"
            >
              <IconMenu2 size={20} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea h="100%">
          <NavLink
            label="Dashboard"
            leftSection={<IconHome size={18} />}
            active={isActive('/dashboard')}
            onClick={() => navigate('/dashboard')}
          />
          <NavLink
            label="Culturas"
            leftSection={<IconFlask size={18} />}
            active={isActive('/cadastros/culturas')}
            defaultOpened={isActive('/cadastros/culturas')}
          >
            <NavLink
              label="Busca"
              active={isActive('/cadastros/culturas/busca')}
              onClick={() => navigate('/cadastros/culturas/busca')}
            />
            <NavLink
              label="Cadastro"
              active={isActive('/cadastros/culturas/cadastro')}
              onClick={() => navigate('/cadastros/culturas/cadastro')}
            />
          </NavLink>
          <NavLink
            label="Laboratorios"
            leftSection={<IconFlask size={18} />}
            active={isActive('/cadastros/laboratorios')}
            defaultOpened={isActive('/cadastros/laboratorios')}
          >
            <NavLink
              label="Busca"
              active={isActive('/cadastros/laboratorios/busca')}
              onClick={() => navigate('/cadastros/laboratorios/busca')}
            />
            <NavLink
              label="Cadastro"
              active={isActive('/cadastros/laboratorios/cadastro')}
              onClick={() => navigate('/cadastros/laboratorios/cadastro')}
            />
          </NavLink>
          <NavLink
            label="Pessoas"
            leftSection={<IconUser size={18} />}
            active={isActive('/cadastros/pessoas')}
            defaultOpened={isActive('/cadastros/pessoas')}
          >
            <NavLink
              label="Busca"
              active={isActive('/cadastros/pessoas/busca')}
              onClick={() => navigate('/cadastros/pessoas/busca')}
            />
            <NavLink
              label="Cadastro"
              active={isActive('/cadastros/pessoas/cadastro')}
              onClick={() => navigate('/cadastros/pessoas/cadastro')}
            />
          </NavLink>
          <NavLink
            label="Produtos"
            leftSection={<IconGraph size={18} />}
            active={isActive('/cadastros/produtos')}
            defaultOpened={isActive('/cadastros/produtos')}
          >
            <NavLink
              label="Busca"
              active={isActive('/cadastros/produtos/busca')}
              onClick={() => navigate('/cadastros/produtos/busca')}
            />
            <NavLink
              label="Cadastro"
              active={isActive('/cadastros/produtos/cadastro')}
              onClick={() => navigate('/cadastros/produtos/cadastro')}
            />
          </NavLink>
          <NavLink
            label="Servicos"
            leftSection={<IconSettings size={18} />}
            active={isActive('/cadastros/servicos')}
            defaultOpened={isActive('/cadastros/servicos')}
          >
            <NavLink
              label="Busca"
              active={isActive('/cadastros/servicos/busca')}
              onClick={() => navigate('/cadastros/servicos/busca')}
            />
            <NavLink
              label="Cadastro"
              active={isActive('/cadastros/servicos/cadastro')}
              onClick={() => navigate('/cadastros/servicos/cadastro')}
            />
          </NavLink>
          <NavLink
            label="Propriedades"
            leftSection={<IconMap size={18} />}
            active={isActive('/propriedades')}
            onClick={() => navigate('/propriedades')}
          />
          <NavLink
            label="Analises de Solo"
            leftSection={<IconFlask size={18} />}
            active={isActive('/analise-solo')}
            onClick={() => navigate('/analise-solo')}
          />
          <NavLink
            label="Relatorios"
            leftSection={<IconGraph size={18} />}
            active={isActive('/relatorios')}
            onClick={() => navigate('/relatorios')}
          />
          <NavLink
            label="Clientes"
            leftSection={<IconUser size={18} />}
            active={isActive('/clientes')}
            onClick={() => navigate('/clientes')}
          />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        position="right"
        title="Menu do usuario"
      >
        <Stack gap="md">
          <Box>
            <Group gap="sm" align="center">
              <Avatar size="md" radius="xl" src={avatarSource}>
                <IconUser size={16} />
              </Avatar>
              <div>
                <Text fw={700}>{userName}</Text>
                <Text size="xs" c="dimmed">
                  {companyName}
                </Text>
              </div>
            </Group>
            <Text size="sm" c="dimmed">
              {userEmail}
            </Text>
          </Box>

          <Group gap="xs">
            <Badge color="cyan">Plano {planLabel}</Badge>
            <Badge color="grape">Creditos {creditsLabel}</Badge>
          </Group>

          <Switch
            size="md"
            label="Tema escuro"
            checked={tema === 'dark'}
            onChange={alternarTema}
          />

          <NavLink
            label="Perfil"
            leftSection={<IconUser size={16} />}
            onClick={() => go('/user')}
          />
          <NavLink
            label="Configuracoes"
            leftSection={<IconSettings size={16} />}
            onClick={() => go('/config')}
          />
          <NavLink
            color="red"
            label="Sair"
            leftSection={<IconLogout size={16} />}
            onClick={() => go('/auth/logout')}
          />
        </Stack>
      </Drawer>

      {loading && (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background:
              tema === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <LoaderGlobal message="Carregando dados..." />
        </Box>
      )}
    </AppShell>
  );
}
