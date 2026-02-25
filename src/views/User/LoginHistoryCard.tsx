import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Card, CardContent } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { ScrollArea } from '@components/ui/scroll-area';
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
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="font-bold">Ultimos acessos</span>
          <Badge variant="secondary">10 mais recentes</Badge>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum login registrado ainda.
          </p>
        ) : (
          <ScrollArea className="max-h-[260px]">
            <div className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-border p-1.5 px-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {formatDateTime(row.created_at)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {resolveSourceLabel(row.source)} | {row.browser} | {row.platform}
                      </p>
                    </div>
                    <Badge
                      variant={row.provider === 'local' ? 'outline' : 'default'}
                      className="shrink-0 text-xs"
                    >
                      {row.provider}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
