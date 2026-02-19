import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBell } from '@tabler/icons-react';
import { $currUser } from '../../global-state/user';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  APP_NOTIFICATIONS_UPDATED_EVENT,
  clearAllNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  type AppNotification,
} from '../../services/notificationsService';

type NotificationFilter = 'all' | 'unread' | 'read' | 'expired';

function toTime(dateLike: string | null | undefined): number {
  if (!dateLike) return 0;
  const time = new Date(dateLike).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isExpired(row: AppNotification, now = Date.now()): boolean {
  const expiry = toTime(row.expires_at);
  return expiry > 0 && now >= expiry;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('pt-BR');
}

function levelColor(level: AppNotification['level']): string {
  if (level === 'success') return 'green';
  if (level === 'warning') return 'yellow';
  if (level === 'error') return 'red';
  return 'blue';
}

export default function NotificationsCenter() {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const loadRows = useCallback(async () => {
    if (!currentUserId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const list = await listNotifications(currentUserId);
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!currentUserId) return;

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const eventUserId = custom.detail?.userId;
      if (eventUserId && eventUserId !== currentUserId) return;
      void loadRows();
    };

    const onStorage = () => {
      void loadRows();
    };

    window.addEventListener(APP_NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(APP_NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUserId, loadRows]);

  const nowTime = Date.now();
  const counts = useMemo(() => {
    const unread = rows.filter((row) => !row.read_at && !isExpired(row, nowTime)).length;
    const read = rows.filter((row) => !!row.read_at && !isExpired(row, nowTime)).length;
    const expired = rows.filter((row) => isExpired(row, nowTime)).length;
    return {
      all: rows.length,
      unread,
      read,
      expired,
    };
  }, [rows, nowTime]);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'unread') {
      return rows.filter((row) => !row.read_at && !isExpired(row, nowTime));
    }
    if (filter === 'read') {
      return rows.filter((row) => !!row.read_at && !isExpired(row, nowTime));
    }
    return rows.filter((row) => isExpired(row, nowTime));
  }, [rows, filter, nowTime]);

  const handleMarkRead = async (id: string) => {
    if (!currentUserId) return;
    await markNotificationRead(currentUserId, id);
  };

  const handleMarkUnread = async (id: string) => {
    if (!currentUserId) return;
    await markNotificationUnread(currentUserId, id);
  };

  const handleDelete = async (id: string) => {
    if (!currentUserId) return;
    await deleteNotification(currentUserId, id);
  };

  const handleMarkAllRead = async () => {
    if (!currentUserId) return;
    await markAllNotificationsRead(currentUserId);
    notifications.show({
      title: 'Notificacoes atualizadas',
      message: 'Todas as notificacoes ativas foram marcadas como lidas.',
      color: 'green',
    });
  };

  const handleClearAll = async () => {
    if (!currentUserId) return;
    const confirmed = window.confirm('Excluir todas as notificacoes?');
    if (!confirmed) return;
    await clearAllNotifications(currentUserId);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconBell size={22} />
          <Title order={3}>Notificacoes</Title>
        </Group>

        <Group gap="xs">
          <Badge color="blue" variant="light">
            Total {counts.all}
          </Badge>
          <Badge color="orange" variant="light">
            Nao lidas {counts.unread}
          </Badge>
        </Group>
      </Group>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="center">
          <SegmentedControl
            value={filter}
            onChange={(value) => setFilter(value as NotificationFilter)}
            data={[
              { value: 'all', label: `Todas (${counts.all})` },
              { value: 'unread', label: `Nao lidas (${counts.unread})` },
              { value: 'read', label: `Lidas (${counts.read})` },
              { value: 'expired', label: `Vencidas (${counts.expired})` },
            ]}
          />

          <Group gap="xs">
            <Button variant="light" onClick={handleMarkAllRead} disabled={counts.unread === 0}>
              Marcar todas como lidas
            </Button>
            <Button color="red" variant="light" onClick={handleClearAll} disabled={counts.all === 0}>
              Limpar tudo
            </Button>
          </Group>
        </Group>

        <Text size="xs" c="dimmed" mt="sm">
          Notificacoes lidas ou vencidas sao removidas automaticamente apos 20 dias.
        </Text>
      </Card>

      <Card withBorder radius="md" p="md">
        {loading ? (
          <Text c="dimmed">Carregando notificacoes...</Text>
        ) : filteredRows.length === 0 ? (
          <Text c="dimmed">Nenhuma notificacao para este filtro.</Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Titulo</Table.Th>
                <Table.Th>Mensagem</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Criada em</Table.Th>
                <Table.Th>Acoes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRows.map((row) => {
                const expired = isExpired(row, nowTime);
                const unread = !row.read_at && !expired;
                const statusLabel = expired
                  ? 'Vencida'
                  : unread
                    ? 'Nao lida'
                    : 'Lida';

                return (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Group gap={6}>
                        <Badge size="xs" color={levelColor(row.level)} variant="light">
                          {row.level}
                        </Badge>
                        <Text fw={600}>{row.title}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>{row.message}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={expired ? 'gray' : unread ? 'orange' : 'green'}
                        variant="light"
                      >
                        {statusLabel}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatDateTime(row.created_at)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {!expired && unread ? (
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => void handleMarkRead(row.id)}
                          >
                            Marcar lida
                          </Button>
                        ) : null}
                        {!expired && !unread ? (
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => void handleMarkUnread(row.id)}
                          >
                            Marcar nao lida
                          </Button>
                        ) : null}
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() => void handleDelete(row.id)}
                        >
                          Excluir
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
