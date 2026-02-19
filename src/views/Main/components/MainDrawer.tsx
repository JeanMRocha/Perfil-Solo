import { Box, Drawer, Group, NavLink, Stack, Switch, Text } from '@mantine/core';
import {
  IconApi,
  IconBook,
  IconFlask,
  IconGraph,
  IconHome,
  IconMap,
  IconPhotoUp,
  IconSchool,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';

interface MainDrawerProps {
  opened: boolean;
  themeMode: 'light' | 'dark';
  menuTextVisible: boolean;
  isSuperMode: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  onMenuTextToggle: (checked: boolean) => void;
  onGo: (path: string) => void;
}

export default function MainDrawer({
  opened,
  themeMode,
  menuTextVisible,
  isSuperMode,
  onClose,
  onToggleTheme,
  onMenuTextToggle,
  onGo,
}: MainDrawerProps) {
  return (
    <Drawer opened={opened} onClose={onClose} position="right" title="Menu geral">
      <Stack gap="md">
        <Switch size="md" label="Tema escuro" checked={themeMode === 'dark'} onChange={onToggleTheme} />

        <NavLink label="Exibir" leftSection={<IconSettings size={16} />} defaultOpened>
          <Box px="sm" py={6}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">Menu: {menuTextVisible ? 'icone + texto' : 'apenas icone'}</Text>
              <Switch
                size="sm"
                checked={menuTextVisible}
                onChange={(event) => onMenuTextToggle(event.currentTarget.checked)}
              />
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Desative para exibir somente icones nos menus superiores.
            </Text>
          </Box>
        </NavLink>

        <NavLink label="Dashboard" leftSection={<IconHome size={16} />} onClick={() => onGo('/dashboard')} />
        <NavLink label="Propriedades" leftSection={<IconMap size={16} />} onClick={() => onGo('/propriedades')} />
        <NavLink label="Analises de Solo" leftSection={<IconFlask size={16} />} onClick={() => onGo('/analise-solo')} />
        <NavLink label="Relatorios" leftSection={<IconGraph size={16} />} onClick={() => onGo('/relatorios')} />
        <NavLink label="Clientes" leftSection={<IconUser size={16} />} onClick={() => onGo('/clientes')} />
        <NavLink label="Aulas" leftSection={<IconSchool size={16} />} onClick={() => onGo('/aulas')} />
        <NavLink label="Conhecimento" leftSection={<IconBook size={16} />} onClick={() => onGo('/conhecimento')} />
        <NavLink label="Modo API" leftSection={<IconApi size={16} />} onClick={() => onGo('/integracoes/api')} />
        {isSuperMode ? (
          <>
            <NavLink label="Sistema" leftSection={<IconSettings size={16} />} onClick={() => onGo('/super/sistema')} />
            <NavLink label="Branding" leftSection={<IconPhotoUp size={16} />} onClick={() => onGo('/super/logo')} />
            <NavLink label="Usuarios" leftSection={<IconUser size={16} />} onClick={() => onGo('/super/usuarios')} />
          </>
        ) : null}
      </Stack>
    </Drawer>
  );
}
