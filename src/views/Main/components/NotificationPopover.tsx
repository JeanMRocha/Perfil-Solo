import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconBell, IconSettings } from '@tabler/icons-react';
import type { AppNotification } from '../../../services/notificationsService';

interface NotificationPopoverProps {
  opened: boolean;
  unreadNotifications: number;
  notificationsLoading: boolean;
  notificationRows: AppNotification[];
  notificationExpandedId: string | null;
  billingGraceActive: boolean;
  billingRestrictedToFirstProperty: boolean;
  billingGraceDeadline: string | null;
  themeMode: 'light' | 'dark';
  actionIconStyles: Record<string, any>;
  onOpenedChange: (opened: boolean) => void;
  onToggle: () => void;
  onOpenCenter: () => void;
  onOpenBilling: () => void;
  onRowClick: (row: AppNotification) => void;
  onExpandedIdChange: (value: string | null) => void;
  isNotificationExpired: (row: AppNotification) => boolean;
  notificationLevelColor: (level: AppNotification['level']) => string;
  formatNotificationDate: (value: string) => string;
}

export default function NotificationPopover({
  opened,
  unreadNotifications,
  notificationsLoading,
  notificationRows,
  notificationExpandedId,
  billingGraceActive,
  billingRestrictedToFirstProperty,
  billingGraceDeadline,
  themeMode,
  actionIconStyles,
  onOpenedChange,
  onToggle,
  onOpenCenter,
  onOpenBilling,
  onRowClick,
  onExpandedIdChange,
  isNotificationExpired,
  notificationLevelColor,
  formatNotificationDate,
}: NotificationPopoverProps) {
  const hasBillingPaymentAlert = billingGraceActive || billingRestrictedToFirstProperty;
  const paymentAlertColor = billingRestrictedToFirstProperty ? 'red' : 'orange';
  const paymentAlertTitle = billingRestrictedToFirstProperty
    ? 'Falha de pagamento'
    : 'Pendencia de pagamento';
  const parsedGraceDate = billingGraceDeadline ? new Date(billingGraceDeadline) : null;
  const paymentAlertDeadline =
    parsedGraceDate && !Number.isNaN(parsedGraceDate.getTime())
      ? parsedGraceDate.toLocaleDateString('pt-BR')
      : null;
  const paymentAlertMessage = billingRestrictedToFirstProperty
    ? 'Pagamento não regularizado. Somente a primeira propriedade permanece acessivel.'
    : paymentAlertDeadline
      ? `Regularize ate ${paymentAlertDeadline} para evitar bloqueio das demais propriedades.`
      : 'Regularize o pagamento para manter acesso completo as propriedades.';

  return (
    <Popover
      opened={opened}
      onChange={(value) => {
        onOpenedChange(value);
        if (!value) onExpandedIdChange(null);
      }}
      position="bottom-start"
      width={360}
      shadow="md"
    >
      <Popover.Target>
        <Indicator
          inline
          disabled={unreadNotifications <= 0}
          label={unreadNotifications > 99 ? '99+' : unreadNotifications}
          size={16}
          color="red"
          offset={4}
        >
          <ActionIcon
            variant="light"
            color="yellow"
            size="lg"
            radius="md"
            styles={actionIconStyles}
            onClick={onToggle}
            title="Notificacoes"
          >
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Text fw={700} size="sm">
              Notificacoes
            </Text>
            <Group gap={6} wrap="nowrap">
              <Badge color="orange" variant="light">
                {unreadNotifications} nao lidas
              </Badge>
              <ActionIcon
                variant="light"
                color="gray"
                size="sm"
                title="Abrir central de notificacoes"
                onClick={onOpenCenter}
              >
                <IconSettings size={14} />
              </ActionIcon>
            </Group>
          </Group>

          {hasBillingPaymentAlert ? (
            <Box
              style={{
                border: `1px solid ${themeMode === 'dark' ? '#7f1d1d' : '#f59e0b'}`,
                borderRadius: 8,
                padding: 10,
                background:
                  themeMode === 'dark'
                    ? 'rgba(127, 29, 29, 0.22)'
                    : 'rgba(254, 243, 199, 0.7)',
              }}
            >
              <Group justify="space-between" align="start" gap="xs" wrap="nowrap">
                <Box style={{ minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap">
                    <IconAlertTriangle size={14} />
                    <Text size="sm" fw={700}>
                      {paymentAlertTitle}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {paymentAlertMessage}
                  </Text>
                </Box>
                <Button size="xs" color={paymentAlertColor} variant="light" onClick={onOpenBilling}>
                  Regularizar
                </Button>
              </Group>
            </Box>
          ) : null}

          {notificationsLoading ? (
            <Text size="sm" c="dimmed">
              Carregando notificacoes...
            </Text>
          ) : notificationRows.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nenhuma notificacao para mostrar.
            </Text>
          ) : (
            <ScrollArea.Autosize mah={320} type="always">
              <Stack gap={6}>
                {notificationRows.map((row) => {
                  const expired = isNotificationExpired(row);
                  const unread = !row.read_at && !expired;
                  const expanded = notificationExpandedId === row.id;

                  return (
                    <Box
                      key={row.id}
                      onClick={() => onRowClick(row)}
                      style={{
                        border: `1px solid ${themeMode === 'dark' ? '#374151' : '#e5e7eb'}`,
                        borderRadius: 8,
                        padding: 8,
                        cursor: 'pointer',
                        background:
                          unread && !expanded
                            ? themeMode === 'dark'
                              ? '#132238'
                              : '#eff6ff'
                            : 'transparent',
                      }}
                    >
                      <Group justify="space-between" align="start" wrap="nowrap">
                        <Box style={{ minWidth: 0 }}>
                          <Group gap={6} wrap="nowrap">
                            <Badge
                              size="xs"
                              variant="light"
                              color={notificationLevelColor(row.level)}
                            >
                              {row.level}
                            </Badge>
                            {unread ? (
                              <Badge size="xs" color="orange">
                                Nova
                              </Badge>
                            ) : null}
                            {expired ? (
                              <Badge size="xs" color="gray">
                                Vencida
                              </Badge>
                            ) : null}
                          </Group>
                          <Text size="sm" fw={700} lineClamp={1}>
                            {row.title}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={expanded ? undefined : 1}>
                            {row.message}
                          </Text>
                        </Box>
                        <Text size="10px" c="dimmed">
                          {formatNotificationDate(row.created_at)}
                        </Text>
                      </Group>
                      {expanded ? (
                        <Text size="xs" mt={6}>
                          {row.message}
                        </Text>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
