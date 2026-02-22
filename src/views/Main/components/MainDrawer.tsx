import { Drawer, NavLink, Stack, Switch } from '@mantine/core';
import {
  IconApi,
  IconBell,
  IconMap2,
  IconPhotoUp,
  IconPalette,
  IconSettings,
  IconShoppingBag,
  IconUser,
} from '@tabler/icons-react';

interface MainDrawerProps {
  opened: boolean;
  themeMode: 'light' | 'dark';
  isSuperMode: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  onGo: (path: string) => void;
}

export default function MainDrawer({
  opened,
  themeMode,
  isSuperMode,
  onClose,
  onToggleTheme,
  onGo,
}: MainDrawerProps) {
  const isLightTheme = themeMode === 'light';
  const drawerStyles = isLightTheme
    ? {
        content: {
          background: 'linear-gradient(180deg, #f9fbff 0%, #eef2f7 100%)',
          boxShadow: '-12px 0 28px rgba(15, 23, 42, 0.22)',
        },
        header: {
          background: 'transparent',
          borderBottom: '1px solid rgba(15, 23, 42, 0.12)',
        },
        title: {
          fontWeight: 700,
          color: '#1f2937',
          textShadow: '0 1px 2px rgba(255, 255, 255, 0.7)',
        },
      }
    : undefined;

  const switchStyles = isLightTheme
    ? {
        label: {
          color: '#1f2937',
          fontWeight: 600,
          textShadow: '0 1px 1px rgba(255, 255, 255, 0.65)',
        },
        track: {
          boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.14)',
        },
      }
    : undefined;

  const navLinkStyles = isLightTheme
    ? {
        root: {
          borderRadius: 10,
          background: 'rgba(255, 255, 255, 0.75)',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 6px 14px rgba(15, 23, 42, 0.12)',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 8px 18px rgba(15, 23, 42, 0.18)',
            background: 'rgba(255, 255, 255, 0.92)',
          },
        },
        label: {
          color: '#1f2937',
          fontWeight: 600,
          textShadow: '0 1px 1px rgba(255, 255, 255, 0.7)',
        },
        section: {
          color: '#111827',
          filter: 'drop-shadow(0 1px 1px rgba(255, 255, 255, 0.72))',
        },
      }
    : undefined;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      title="Menu geral"
      styles={drawerStyles}
    >
      <Stack gap="md">
        <Switch
          size="md"
          label="Tema escuro"
          checked={themeMode === 'dark'}
          onChange={onToggleTheme}
          styles={switchStyles}
        />

        <NavLink
          label="Central do Usuário"
          leftSection={<IconUser size={16} />}
          onClick={() => onGo('/user?tab=perfil')}
          styles={navLinkStyles}
        />
        <NavLink
          label="Notificacoes"
          leftSection={<IconBell size={16} />}
          onClick={() => onGo('/notificacoes')}
          styles={navLinkStyles}
        />
        <NavLink
          label="Loja do app"
          leftSection={<IconShoppingBag size={16} />}
          onClick={() => onGo('/marketplace')}
          styles={navLinkStyles}
        />
        <NavLink
          label="Solos"
          leftSection={<IconMap2 size={16} />}
          onClick={() => onGo('/solos')}
          styles={navLinkStyles}
        />
        <NavLink
          label="Modo API"
          leftSection={<IconApi size={16} />}
          onClick={() => onGo('/integracoes/api')}
          styles={navLinkStyles}
        />
        <NavLink
          label="Aparencia"
          leftSection={<IconPalette size={16} />}
          onClick={() => onGo('/config/aparencia')}
          styles={navLinkStyles}
        />
        {isSuperMode ? (
          <>
            <NavLink
              label="Sistema"
              leftSection={<IconSettings size={16} />}
              onClick={() => onGo('/super/sistema')}
              styles={navLinkStyles}
            />
            <NavLink
              label="Branding"
              leftSection={<IconPhotoUp size={16} />}
              onClick={() => onGo('/super/logo')}
              styles={navLinkStyles}
            />
            <NavLink
              label="Usuários"
              leftSection={<IconUser size={16} />}
              onClick={() => onGo('/super/usuarios')}
              styles={navLinkStyles}
            />
          </>
        ) : null}
      </Stack>
    </Drawer>
  );
}
