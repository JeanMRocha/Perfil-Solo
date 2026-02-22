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
import { useViewportSize } from '@mantine/hooks';
import { IconAlertTriangle, IconMap2, IconMenu2, IconUser } from '@tabler/icons-react';
import type { ComponentType, CSSProperties } from 'react';
import HeaderCreditsSummary from '@components/layout/HeaderCreditsSummary';
import type { AppNotification } from '../../../services/notificationsService';
import type {
  BillingQuoteLine,
} from '../../../services/billingPlanService';
import type { BillingPlanId } from '../../../modules/billing';
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
  billingPlanId: BillingPlanId;
  creditsNumber: number;
  purchasedCredits: number;
  earnedCredits: number;
  spentCredits: number;
  usageLines: BillingQuoteLine[];
  usageLoading: boolean;
  xpTotal: number;
  xpLevel: number;
  canUseSuperMode: boolean;
  isSuperMode: boolean;
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
  onOpenJourney: () => void;
  onToggleMainMenu: () => void;
  onModeToggle: (checked: boolean) => void;
  notificationsOpened: boolean;
  unreadNotifications: number;
  notificationsLoading: boolean;
  notificationRows: AppNotification[];
  notificationExpandedId: string | null;
  billingGraceActive: boolean;
  billingRestrictedToFirstProperty: boolean;
  billingGraceDeadline: string | null;
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
  billingPlanId,
  creditsNumber,
  purchasedCredits,
  earnedCredits,
  spentCredits,
  usageLines,
  usageLoading,
  xpTotal,
  xpLevel,
  canUseSuperMode,
  isSuperMode,
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
  onOpenJourney,
  onToggleMainMenu,
  onModeToggle,
  notificationsOpened,
  unreadNotifications,
  notificationsLoading,
  notificationRows,
  notificationExpandedId,
  billingGraceActive,
  billingRestrictedToFirstProperty,
  billingGraceDeadline,
  onNotificationsOpenedChange,
  onToggleNotifications,
  onOpenNotificationsCenter,
  onNotificationRowClick,
  onNotificationExpandedIdChange,
  isNotificationExpired,
  notificationLevelColor,
  formatNotificationDate,
}: HeaderBarProps) {
  const { width: viewportWidth } = useViewportSize();
  const brandLogoSize = Math.max(30, headerHeight - 8);
  const brandFallbackIconSize = Math.max(14, Math.round(brandLogoSize * 0.42));
  const userAvatarSize = 34;
  const userAvatarGlyphSize = 20;
  const brandPalette = getBrandPalette(themeMode);
  const compactMenu = viewportWidth < 1320;
  const ultraCompactMenu = viewportWidth < 960;
  const menuRowPaddingX = ultraCompactMenu ? 'xs' : 'md';
  const menuRowGap = ultraCompactMenu ? 6 : 8;
  const compactPillWidth = ultraCompactMenu ? 36 : 42;
  const compactPillInlineStyle = {
    minWidth: compactPillWidth,
    width: compactPillWidth,
    paddingInline: 0,
    overflow: 'hidden' as const,
    flex: '0 0 auto' as const,
  };

  const expandedPillInlineStyle = (label: string) => {
    const widthBase = ultraCompactMenu ? 56 : compactMenu ? 60 : 64;
    const perChar = ultraCompactMenu ? 5.5 : 6.2;
    const expandedWidth = Math.max(
      compactPillWidth + 40,
      Math.min(180, Math.round(widthBase + label.length * perChar)),
    );
    return {
      width: expandedWidth,
      minWidth: expandedWidth,
      overflow: 'hidden' as const,
      paddingInline: compactMenu ? 10 : 12,
      flex: '0 0 auto' as const,
    };
  };

  const buttonContentStyle = (showLabel: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: showLabel ? 6 : 0,
    minWidth: 0,
  });

  const buttonLabelStyle = (showLabel: boolean): CSSProperties => ({
    display: 'inline-block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    maxWidth: showLabel ? 128 : 0,
    opacity: showLabel ? 1 : 0,
    transform: showLabel ? 'translateX(0)' : 'translateX(-6px)',
    transition:
      'max-width 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
  });

  const resolveMenuButtonStyle = (showLabel: boolean, label: string) =>
    showLabel ? expandedPillInlineStyle(label) : compactPillInlineStyle;

  const resolveMenuIconSize = ultraCompactMenu ? 15 : 16;
  const inactiveSuperMenuVariant = themeMode === 'light' ? 'outline' : 'light';
  const inactiveSuperMenuColor = 'gray';
  const inactiveMainMenuVariant = themeMode === 'light' ? 'default' : 'light';
  const inactiveMainMenuColor = themeMode === 'light' ? 'dark' : 'gray';
  const activeMainMenuColor = themeMode === 'light' ? '#12823b' : 'green';
  const hasBillingPaymentAlert = billingGraceActive || billingRestrictedToFirstProperty;
  const paymentAlertLabel = billingRestrictedToFirstProperty
    ? 'Falha de pagamento'
    : 'Pagamento pendente';
  const paymentAlertColor = billingRestrictedToFirstProperty ? 'red' : 'orange';
  const parsedGraceDate = billingGraceDeadline ? new Date(billingGraceDeadline) : null;
  const paymentAlertDeadline =
    parsedGraceDate && !Number.isNaN(parsedGraceDate.getTime())
      ? parsedGraceDate.toLocaleDateString('pt-BR')
      : null;
  const paymentAlertTitle = billingRestrictedToFirstProperty
    ? 'Pagamento em atraso: apenas a primeira propriedade segue ativa.'
    : paymentAlertDeadline
      ? `Regularize ate ${paymentAlertDeadline} para manter acesso completo as propriedades.`
      : 'Regularize o pagamento para evitar bloqueios de acesso.';
  const renderButtonContent = (
    Icon: ComponentType<{ size?: number }>,
    label: string,
    showLabel: boolean,
  ) => (
    <span style={buttonContentStyle(showLabel)}>
      <Icon size={resolveMenuIconSize} />
      <span style={buttonLabelStyle(showLabel)}>{label}</span>
    </span>
  );

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
              title="Abrir central do usuário"
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
                  {companyName ? (
                    <Text size="xs" c={brandPalette.header.textMuted} truncate="end">
                      {companyName}
                    </Text>
                  ) : null}
                </Box>
              </Group>
            </UnstyledButton>

            <NotificationPopover
              opened={notificationsOpened}
              unreadNotifications={unreadNotifications}
              notificationsLoading={notificationsLoading}
              notificationRows={notificationRows}
              notificationExpandedId={notificationExpandedId}
              billingGraceActive={billingGraceActive}
              billingRestrictedToFirstProperty={billingRestrictedToFirstProperty}
              billingGraceDeadline={billingGraceDeadline}
              themeMode={themeMode}
              actionIconStyles={headerActionIconStyles}
              onOpenedChange={onNotificationsOpenedChange}
              onToggle={onToggleNotifications}
              onOpenCenter={onOpenNotificationsCenter}
              onOpenBilling={onOpenBilling}
              onRowClick={onNotificationRowClick}
              onExpandedIdChange={onNotificationExpandedIdChange}
              isNotificationExpired={isNotificationExpired}
              notificationLevelColor={notificationLevelColor}
              formatNotificationDate={formatNotificationDate}
            />
            {hasBillingPaymentAlert ? (
              <Button
                size="xs"
                radius="xl"
                variant={themeMode === 'dark' ? 'light' : 'outline'}
                color={paymentAlertColor}
                leftSection={<IconAlertTriangle size={14} />}
                title={paymentAlertTitle}
                onClick={onOpenBilling}
                style={{ marginTop: 4 }}
              >
                {paymentAlertLabel}
              </Button>
            ) : null}
          </Group>

          <Group gap="sm" wrap="nowrap" style={{ marginLeft: 'auto' }}>
            <HeaderCreditsSummary
              planLabel={planLabel}
              billingPlanId={billingPlanId}
              creditsNumber={creditsNumber}
              purchasedCredits={purchasedCredits}
              earnedCredits={earnedCredits}
              spentCredits={spentCredits}
              usageLines={usageLines}
              usageLoading={usageLoading}
              xpTotal={xpTotal}
              xpLevel={xpLevel}
              isDark={themeMode === 'dark'}
              onOpenBilling={onOpenBilling}
              onOpenJourney={onOpenJourney}
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
            {canUseSuperMode ? (
              <Switch
                size="sm"
                color="teal"
                checked={isSuperMode}
                onChange={(event) => onModeToggle(event.currentTarget.checked)}
                aria-label="Alternar perfil de usuário"
              />
            ) : null}
          </Group>
        </Group>
      </Box>

      {isSuperMode ? (
        <Box
          px={menuRowPaddingX}
          h={headerHeight}
          style={{
            borderBottom: `1px solid ${brandPalette.header.border}`,
            background: brandPalette.menu.superRowBackground,
            boxShadow:
              themeMode === 'light'
                ? 'inset 0 -1px 0 rgba(148, 163, 184, 0.35)'
                : 'none',
          }}
        >
          <ScrollArea
            h="100%"
            w="100%"
            type="auto"
            scrollbars="x"
            offsetScrollbars="x"
            scrollbarSize={6}
          >
            <Group h="100%" gap={menuRowGap} wrap="nowrap" style={{ minWidth: 'max-content' }}>
              <Badge color="yellow" variant="light">
                Admin
              </Badge>
              {superMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const showLabel = active;
                return (
                  <Button
                    key={item.path}
                    size="xs"
                    radius="xl"
                    styles={menuPillButtonStyles}
                    variant={active ? 'filled' : inactiveSuperMenuVariant}
                    color={active ? 'yellow' : inactiveSuperMenuColor}
                    title={item.label}
                    aria-label={item.label}
                    style={resolveMenuButtonStyle(showLabel, item.label)}
                    onClick={() => onNavigate(item.path)}
                  >
                    {renderButtonContent(Icon, item.label, showLabel)}
                  </Button>
                );
              })}
            </Group>
          </ScrollArea>
        </Box>
      ) : null}

      <Box
        px={menuRowPaddingX}
        h={headerHeight}
        style={{
          borderBottom: `1px solid ${brandPalette.header.border}`,
          background: brandPalette.menu.mainRowBackground,
          boxShadow:
            themeMode === 'light'
              ? 'inset 0 -1px 0 rgba(22, 101, 52, 0.2)'
              : 'none',
        }}
      >
        <ScrollArea
          h="100%"
          w="100%"
          type="auto"
          scrollbars="x"
          offsetScrollbars="x"
          scrollbarSize={6}
        >
          <Group h="100%" gap={menuRowGap} wrap="nowrap" style={{ minWidth: 'max-content' }}>
            {topMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const showLabel = active;
              return (
                <Button
                  key={item.path}
                  size="xs"
                  radius="xl"
                  styles={menuPillButtonStyles}
                  variant={active ? 'filled' : inactiveMainMenuVariant}
                  color={active ? activeMainMenuColor : inactiveMainMenuColor}
                  title={item.label}
                  aria-label={item.label}
                  style={resolveMenuButtonStyle(showLabel, item.label)}
                  onClick={() => onNavigate(item.path)}
                >
                  {renderButtonContent(Icon, item.label, showLabel)}
                </Button>
              );
            })}
          </Group>
        </ScrollArea>
      </Box>
    </Box>
  );
}
