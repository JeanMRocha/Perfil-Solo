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
import { getBrandPalette } from '../../../mantine/brand';
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
  creditsNumber: number;
  purchasedCredits: number;
  earnedCredits: number;
  spentCredits: number;
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
  onOpenUserCenter: () => void;
  onOpenBilling: () => void;
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
  creditsNumber,
  purchasedCredits,
  earnedCredits,
  spentCredits,
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
  onOpenUserCenter,
  onOpenBilling,
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
  const brandLogoSize = Math.max(30, headerHeight - 8);
  const brandFallbackIconSize = Math.max(14, Math.round(brandLogoSize * 0.42));
  const userAvatarSize = 34;
  const userAvatarGlyphSize = 20;
  const brandPalette = getBrandPalette(themeMode);

  return (
    <Box h="100%">
      <Box
        px="md"
        h={headerHeight}
        style={{
          position: 'relative',
          borderBottom: `1px solid ${brandPalette.header.border}`,
        }}
      >
        <Group justify="space-between" h="100%" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <UnstyledButton
              onClick={onOpenUserCenter}
              styles={userTriggerStyles}
              title="Abrir central do usuario"
            >
              <Group gap="sm" wrap="nowrap">
                <Avatar size={userAvatarSize} radius="xl" src={avatarSource}>
                  {avatarEmoji ? (
                    <span style={{ fontSize: userAvatarGlyphSize, lineHeight: 1 }}>
                      {avatarEmoji}
                    </span>
                  ) : (
                    <IconUser size={userAvatarGlyphSize} />
                  )}
                </Avatar>
                <Box style={{ minWidth: 0 }}>
                  <Text fw={700} c={headerText} truncate="end">
                    {userName}
                  </Text>
                  <Text size="xs" c={brandPalette.header.textMuted} truncate="end">
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
              creditsNumber={creditsNumber}
              purchasedCredits={purchasedCredits}
              earnedCredits={earnedCredits}
              spentCredits={spentCredits}
              isDark={themeMode === 'dark'}
              onOpenBilling={onOpenBilling}
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
            <Avatar
              radius="sm"
              size={brandLogoSize}
              src={brandLogoUrl || undefined}
              styles={{
                root: {
                  border: `1px solid ${brandPalette.header.logoBorder}`,
                },
              }}
            >
              <IconMap2 size={brandFallbackIconSize} color={brandPalette.header.logoFallback} />
            </Avatar>
            <Title order={3} c={brandPalette.header.brandTitle}>
              {brandDisplayName}
            </Title>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Text
              size="10px"
              fw={700}
              ff="monospace"
              c={brandPalette.header.text}
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
            borderBottom: `1px solid ${brandPalette.header.border}`,
            background: brandPalette.menu.superRowBackground,
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
                    size="xs"
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
          borderBottom: `1px solid ${brandPalette.header.border}`,
          background: brandPalette.menu.mainRowBackground,
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
                  size="xs"
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
