import { Avatar, Badge, Box, Drawer, Group, NavLink, Stack, Text } from '@mantine/core';
import {
  IconGraph,
  IconLockAccess,
  IconLogout,
  IconSettings,
  IconTicket,
  IconUser,
} from '@tabler/icons-react';

interface UserDrawerProps {
  opened: boolean;
  userName: string;
  companyName: string;
  userEmail: string;
  avatarSource: string;
  avatarEmoji: string;
  planLabel: string;
  creditsLabel: string;
  onClose: () => void;
  onGo: (path: string) => void;
}

export default function UserDrawer({
  opened,
  userName,
  companyName,
  userEmail,
  avatarSource,
  avatarEmoji,
  planLabel,
  creditsLabel,
  onClose,
  onGo,
}: UserDrawerProps) {
  return (
    <Drawer opened={opened} onClose={onClose} position="right" title="Usuário logado">
      <Stack gap="md">
        <Box>
          <Group gap="sm" align="center">
            <Avatar size="md" radius="xl" src={avatarSource}>
              {avatarEmoji || <IconUser size={16} />}
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
          <Badge color="grape">Créditos {creditsLabel}</Badge>
        </Group>

        <NavLink label="Usuário" leftSection={<IconUser size={16} />} onClick={() => onGo('/user?tab=perfil')} />
        <NavLink label="Segurança" leftSection={<IconLockAccess size={16} />} onClick={() => onGo('/user?tab=seguranca')} />
        <NavLink label="Configurações" leftSection={<IconSettings size={16} />} onClick={() => onGo('/user?tab=plano')} />
        <NavLink label="Créditos" leftSection={<IconGraph size={16} />} onClick={() => onGo('/user?tab=creditos')} />
        <NavLink label="Cupons" leftSection={<IconTicket size={16} />} onClick={() => onGo('/user?tab=cupons')} />
        <NavLink color="red" label="Sair" leftSection={<IconLogout size={16} />} onClick={() => onGo('/auth/logout')} />
      </Stack>
    </Drawer>
  );
}
