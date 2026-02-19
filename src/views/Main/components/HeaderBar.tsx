import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Group,
  ScrollArea,
  Switch,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconMap2, IconMenu2, IconUser } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import HeaderCreditsSummary from '@components/layout/HeaderCreditsSummary';
import type { AppNotification } from '../../../services/notificationsService';
import NotificationPopover from './NotificationPopover';

export interface HeaderMenuItem {
  label: string;
  path: string;
  icon: ComponentType<{ size?: number }>;
}

interface HeaderBarProps {
  themeMode: 'light' | 'dark';
  headerHeight: number;
  headerText: string;
  userName: string;
  companyName: string;
  avatarSource: string;
  avatarEmoji: string;
  planLabel: string;
  creditsLabel: string;
  creditsProgress: number;
  creditsNumber: number;
  isSuperMode: boolean;
  menuTextVisible: boolean;
  brandDisplayName: string;
  brandLogoUrl: string;
  topMenuItems: HeaderMenuItem[];
  superMenuItems: HeaderMenuItem[];
  userTriggerStyles: Record<string, any>;
  menuPillButtonStyles: Record<string, any>;
  headerActionIconStyles: Record<string, any>;
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  onToggleUserMenu: () => void;
  onToggleMainMenu: () => void;
  onModeToggle: (checked: boolean) => void;
  notificationsOpened: boolean;
  unreadNotifications: number;
  notificationsLoading: boolean;
  notificationRows: AppNotification[];
  notificationExpandedId: string | null;
  onNotificationsOpenedChange: (opened: boolean) => void;
  onToggleNotifications: () => void;
  onOpenNotificationsCenter: () => void;
  onNotificationRowClick: (row: AppNotification) => void;
  onNotificationExpandedIdChange: (value: string | null) => void;
  isNotificationExpired: (row: AppNotification) => boolean;
  notificationLevelColor: (level: AppNotification['level']) => string;
  formatNotificationDate: (value: string) => string;
}

export default function HeaderBar({
  themeMode,
  headerHeight,
  headerText,
  userName,
  companyName,
  avatarSource,
  avatarEmoji,
  planLabel,
  creditsLabel,
  creditsProgress,
  creditsNumber,
  isSuperMode,
  menuTextVisible,
  brandDisplayName,
  brandLogoUrl,
  topMenuItems,
  superMenuItems,
  userTriggerStyles,
  menuPillButtonStyles,
  headerActionIconStyles,
  isActive,
  onNavigate,
  onToggleUserMenu,
  onToggleMainMenu,
  onModeToggle,
  notificationsOpened,
  unreadNotifications,
  notificationsLoading,
  notificationRows,
  notificationExpandedId,
  onNotificationsOpenedChange,
  onToggleNotifications,
  onOpenNotificationsCenter,
  onNotificationRowClick,
  onNotificationExpandedIdChange,
  isNotificationExpired,
  notificationLevelColor,
  formatNotificationDate,
}: HeaderBarProps) {
  return (
    <Box h="100%">
      <Box
        px="md"
        h={headerHeight}
        style={{
          position: 'relative',
          borderBottom: themeMode === 'dark' ? '1px solid #1f2937' : '1px solid #d1fae5',
        }}
      >
        <Group justify="space-between" h="100%" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <UnstyledButton
              onClick={onToggleUserMenu}
              styles={userTriggerStyles}
              title="Abrir menu do usuario"
            >
              <Group gap="xs" wrap="nowrap">
                <Avatar size="sm" radius="xl" src={avatarSource}>
                  {avatarEmoji || <IconUser size={14} />}
                </Avatar>
                <Box style={{ minWidth: 0 }}>
                  <Text fw={700} c={headerText} truncate="end">
                    {userName}
                  </Text>
                  <Text size="xs" c={themeMode === 'dark' ? 'gray.4' : 'dimmed'} truncate="end">
                    {companyName}
                  </Text>
                </Box>
              </Group>
            </UnstyledButton>

            <NotificationPopover
              opened={notificationsOpened}
              unreadNotifications={unreadNotifications}
              notificationsLoading={notificationsLoading}
              notificationRows={notificationRows}
              notificationExpandedId={notificationExpandedId}
              themeMode={themeMode}
              actionIconStyles={headerActionIconStyles}
              onOpenedChange={onNotificationsOpenedChange}
              onToggle={onToggleNotifications}
              onOpenCenter={onOpenNotificationsCenter}
              onRowClick={onNotificationRowClick}
              onExpandedIdChange={onNotificationExpandedIdChange}
              isNotificationExpired={isNotificationExpired}
              notificationLevelColor={notificationLevelColor}
              formatNotificationDate={formatNotificationDate}
            />
          </Group>

          <Group gap="sm" wrap="nowrap" style={{ marginLeft: 'auto' }}>
            <HeaderCreditsSummary
              planLabel={planLabel}
              creditsLabel={creditsLabel}
              creditsProgress={creditsProgress}
              creditsNumber={creditsNumber}
              isDark={themeMode === 'dark'}
            />
            <ActionIcon
              variant="light"
              color="green"
              size="lg"
              radius="md"
              styles={headerActionIconStyles}
              onClick={onToggleMainMenu}
              title="Menu geral"
            >
              <IconMenu2 size={20} />
            </ActionIcon>
          </Group>
        </Group>

        <Group
          gap={6}
          wrap="nowrap"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
          }}
        >
          <Group gap={6} wrap="nowrap">
            <Avatar radius="sm" size="sm" src={brandLogoUrl || undefined}>
              <IconMap2 size={14} color="#16a34a" />
            </Avatar>
            <Title order={3} c="green.8">
              {brandDisplayName}
            </Title>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Text
              size="10px"
              fw={700}
              ff="monospace"
              c={themeMode === 'dark' ? '#f3f4f6' : '#111827'}
              style={{ minWidth: 42, textAlign: 'right' }}
            >
              {isSuperMode ? 'SUPER' : 'NORMAL'}
            </Text>
            <Switch
              size="sm"
              color="teal"
              checked={isSuperMode}
              onChange={(event) => onModeToggle(event.currentTarget.checked)}
              aria-label="Alternar perfil de usuario"
            />
          </Group>
        </Group>
      </Box>

      {isSuperMode ? (
        <Box
          px="md"
          h={headerHeight}
          style={{
            borderBottom: themeMode === 'dark' ? '1px solid #1f2937' : '1px solid #d1fae5',
            background: themeMode === 'dark' ? '#1f2937' : '#fffbeb',
          }}
        >
          <ScrollArea h="100%" type="never" scrollbars="x">
            <Group h="100%" gap="xs" wrap="nowrap">
              <Badge color="yellow" variant="light">
                Admin
              </Badge>
              {superMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Button
                    key={item.path}
                    size="sm"
                    radius="xl"
                    styles={menuPillButtonStyles}
                    leftSection={menuTextVisible ? <Icon size={16} /> : undefined}
                    variant={active ? 'filled' : 'light'}
                    color={active ? 'yellow' : 'gray'}
                    title={item.label}
                    aria-label={item.label}
                    style={menuTextVisible ? undefined : { minWidth: 42, paddingInline: 12 }}
                    onClick={() => onNavigate(item.path)}
                  >
                    {menuTextVisible ? item.label : <Icon size={16} />}
                  </Button>
                );
              })}
            </Group>
          </ScrollArea>
        </Box>
      ) : null}

      <Box
        px="md"
        h={headerHeight}
        style={{
          borderBottom: themeMode === 'dark' ? '1px solid #1f2937' : '1px solid #d1fae5',
          background: themeMode === 'dark' ? '#0f172a' : '#f8fafc',
        }}
      >
        <ScrollArea h="100%" type="never" scrollbars="x">
          <Group h="100%" gap="xs" wrap="nowrap">
            {topMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Button
                  key={item.path}
                  size="sm"
                  radius="xl"
                  styles={menuPillButtonStyles}
                  leftSection={menuTextVisible ? <Icon size={16} /> : undefined}
                  variant={active ? 'filled' : 'light'}
                  color={active ? 'green' : 'gray'}
                  title={item.label}
                  aria-label={item.label}
                  style={menuTextVisible ? undefined : { minWidth: 42, paddingInline: 12 }}
                  onClick={() => onNavigate(item.path)}
                >
                  {menuTextVisible ? item.label : <Icon size={16} />}
                </Button>
              );
            })}
          </Group>
        </ScrollArea>
      </Box>
    </Box>
  );
}
