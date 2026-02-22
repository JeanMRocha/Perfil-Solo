import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Badge, Box, Card, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { $currUser } from '../../global-state/user';
import {
  LOGIN_HISTORY_UPDATED_EVENT,
  listLoginHistoryForUser,
  type LoginHistoryEntry,
} from '../../services/loginHistoryService';

function formatDateTime(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveSourceLabel(source: string): string {
  const normalized = String(source ?? '').trim().toLowerCase();
  if (normalized === 'local_signin') return 'Login local';
  if (normalized === 'supabase_signed_in') return 'Login supabase';
  return source || 'Login';
}

export default function LoginHistoryCard() {
  const user = useStore($currUser);
  const userId = String(user?.id ?? '').trim();
  const [rows, setRows] = useState<LoginHistoryEntry[]>([]);

  const loadRows = useCallback(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    setRows(listLoginHistoryForUser(userId, 10));
  }, [userId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!userId) return;

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedUserId = String(custom.detail?.userId ?? '').trim();
      if (changedUserId && changedUserId !== userId) return;
      loadRows();
    };
    const onStorage = () => loadRows();

    window.addEventListener(LOGIN_HISTORY_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LOGIN_HISTORY_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadRows, userId]);

  return (
    <Card withBorder radius="md" p="sm">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={700}>Ultimos acessos</Text>
          <Badge variant="light" color="blue">
            10 mais recentes
          </Badge>
        </Group>

        {rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nenhum login registrado ainda.
          </Text>
        ) : (
          <ScrollArea.Autosize mah={260} type="always">
            <Stack gap={6}>
              {rows.map((row) => (
                <Box
                  key={row.id}
                  style={{
                    border: '1px solid rgba(100, 116, 139, 0.35)',
                    borderRadius: 8,
                    padding: '6px 8px',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {formatDateTime(row.created_at)}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {resolveSourceLabel(row.source)} | {row.browser} | {row.platform}
                      </Text>
                    </Stack>
                    <Badge
                      size="sm"
                      variant="light"
                      color={row.provider === 'local' ? 'grape' : 'teal'}
                    >
                      {row.provider}
                    </Badge>
                  </Group>
                </Box>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Card>
  );
}
