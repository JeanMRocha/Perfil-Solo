import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SegmentedControl,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconBell, IconSparkles } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { $currUser } from '../../global-state/user';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  BILLING_UPDATED_EVENT,
  getPropertyAccessPolicyForUser,
} from '../../services/billingPlanService';
import {
  buildGamificationAreaProgress,
  type GamificationAreaProgress,
} from '../../services/gamificationProgressService';
import {
  APP_NOTIFICATIONS_UPDATED_EVENT,
  clearAllNotifications,
  deleteNotification,
  ensureTemporaryProgressNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  type AppNotification,
} from '../../services/notificationsService';
import {
  fetchAnalysesByProperties,
  fetchTalhoesByProperties,
  fetchUserProperties,
} from '../../services/propertyMapService';
import {
  DASHBOARD_GUIDE_STEPS,
  ONBOARDING_GUIDE_UPDATED_EVENT,
  getActiveGuideStep,
  getGuideProgressValue,
  getGuideStateByUser,
  nextGuideStepByUser,
  previousGuideStepByUser,
  resolveGuideUserId,
  restartGuideByUser,
  type DashboardGuideState,
} from '../../services/onboardingGuideService';

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

function resolveJourneyPath(area: GamificationAreaProgress['area']): string {
  if (area === 'analises') return '/analise-solo';
  return '/propriedades';
}

export default function NotificationsCenter() {
  const navigate = useNavigate();
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);
  const guideUserId = resolveGuideUserId(currentUserId);

  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [guideState, setGuideState] = useState<DashboardGuideState>(() =>
    getGuideStateByUser(guideUserId),
  );
  const [journeyRows, setJourneyRows] = useState<GamificationAreaProgress[]>([]);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const [paymentPolicy, setPaymentPolicy] = useState({
    grace_active: false,
    restricted_to_first_property: false,
    grace_deadline: null as string | null,
  });

  const legacyPlanId =
    String((user as any)?.plan_id ?? (user as any)?.user_metadata?.plan_id ?? '').trim() ||
    undefined;

  const loadRows = useCallback(async () => {
    if (!currentUserId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await ensureTemporaryProgressNotifications(currentUserId);
      const list = await listNotifications(currentUserId);
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const refreshPaymentPolicy = useCallback(() => {
    if (!currentUserId) {
      setPaymentPolicy({
        grace_active: false,
        restricted_to_first_property: false,
        grace_deadline: null,
      });
      return;
    }

    const policy = getPropertyAccessPolicyForUser(currentUserId, legacyPlanId);
    setPaymentPolicy({
      grace_active: policy.grace_active,
      restricted_to_first_property: policy.restricted_to_first_property,
      grace_deadline: policy.grace_deadline,
    });
  }, [currentUserId, legacyPlanId]);

  const loadJourneySummary = useCallback(async () => {
    if (!currentUserId) {
      setJourneyRows([]);
      setJourneyLoading(false);
      return;
    }

    setJourneyLoading(true);
    try {
      const properties = await fetchUserProperties(currentUserId);
      const propertyIds = properties.map((row) => row.id);
      const [talhoes, analyses] =
        propertyIds.length > 0
          ? await Promise.all([
              fetchTalhoesByProperties(propertyIds),
              fetchAnalysesByProperties(propertyIds),
            ])
          : [[], []];

      setJourneyRows(
        buildGamificationAreaProgress({
          properties: properties.length,
          talhoes: talhoes.length,
          analises: analyses.length,
        }),
      );
    } catch {
      setJourneyRows([]);
    } finally {
      setJourneyLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    refreshPaymentPolicy();
  }, [refreshPaymentPolicy]);

  useEffect(() => {
    void loadJourneySummary();
  }, [loadJourneySummary]);

  useEffect(() => {
    setGuideState(getGuideStateByUser(guideUserId));
  }, [guideUserId]);

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

  useEffect(() => {
    if (!currentUserId) return;

    const onBillingUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const eventUserId = custom.detail?.userId;
      if (eventUserId && eventUserId !== currentUserId) return;
      refreshPaymentPolicy();
      void loadJourneySummary();
    };

    const onStorage = () => {
      refreshPaymentPolicy();
      void loadJourneySummary();
    };

    const onFocus = () => {
      refreshPaymentPolicy();
      void loadJourneySummary();
    };

    window.addEventListener(BILLING_UPDATED_EVENT, onBillingUpdated);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(BILLING_UPDATED_EVENT, onBillingUpdated);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUserId, loadJourneySummary, refreshPaymentPolicy]);

  useEffect(() => {
    const refreshGuide = () => {
      setGuideState(getGuideStateByUser(guideUserId));
    };

    const onGuideUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const eventUserId = resolveGuideUserId(custom.detail?.userId);
      if (eventUserId !== guideUserId) return;
      refreshGuide();
    };

    window.addEventListener(ONBOARDING_GUIDE_UPDATED_EVENT, onGuideUpdated);
    window.addEventListener('storage', refreshGuide);
    return () => {
      window.removeEventListener(ONBOARDING_GUIDE_UPDATED_EVENT, onGuideUpdated);
      window.removeEventListener('storage', refreshGuide);
    };
  }, [guideUserId]);

  const nowTime = Date.now();
  const activeGuideStep = useMemo(() => getActiveGuideStep(guideState), [guideState]);
  const guideProgress = useMemo(() => getGuideProgressValue(guideState), [guideState]);
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
  const hasPaymentIssue =
    paymentPolicy.grace_active || paymentPolicy.restricted_to_first_property;
  const paymentAlertColor = paymentPolicy.restricted_to_first_property ? 'red' : 'orange';
  const paymentAlertTitle = paymentPolicy.restricted_to_first_property
    ? 'Falha de pagamento'
    : 'Pendência de pagamento';
  const parsedGraceDate = paymentPolicy.grace_deadline
    ? new Date(paymentPolicy.grace_deadline)
    : null;
  const paymentAlertDeadline =
    parsedGraceDate && !Number.isNaN(parsedGraceDate.getTime())
      ? parsedGraceDate.toLocaleDateString('pt-BR')
      : null;
  const paymentAlertMessage = paymentPolicy.restricted_to_first_property
    ? 'Pagamento não regularizado: somente a primeira propriedade permanece ativa.'
    : paymentAlertDeadline
      ? `Você tem até ${paymentAlertDeadline} para regularizar o pagamento e manter o acesso completo.`
      : 'Regularize o pagamento para evitar bloqueio de propriedades.';

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
      title: 'Notificações atualizadas',
      message: 'Todas as notificações ativas foram marcadas como lidas.',
      color: 'green',
    });
  };

  const handleClearAll = async () => {
    if (!currentUserId) return;
    const confirmed = window.confirm('Excluir todas as notificações?');
    if (!confirmed) return;
    await clearAllNotifications(currentUserId);
  };

  const handleGuideNext = () => {
    setGuideState(nextGuideStepByUser(guideUserId));
  };

  const handleGuidePrevious = () => {
    setGuideState(previousGuideStepByUser(guideUserId));
  };

  const handleGuideRestart = () => {
    setGuideState(restartGuideByUser(guideUserId));
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconBell size={22} />
          <Title order={3}>Notificações</Title>
        </Group>

        <Group gap="xs">
          <Badge color="blue" variant="light">
            Total {counts.all}
          </Badge>
          <Badge color="orange" variant="light">
            Não lidas {counts.unread}
          </Badge>
        </Group>
      </Group>

      {hasPaymentIssue ? (
        <Card
          withBorder
          radius="md"
          p="sm"
          style={{
            borderColor:
              paymentPolicy.restricted_to_first_property
                ? 'rgba(239, 68, 68, 0.55)'
                : 'rgba(245, 158, 11, 0.55)',
            background:
              paymentPolicy.restricted_to_first_property
                ? 'rgba(127, 29, 29, 0.18)'
                : 'rgba(245, 158, 11, 0.14)',
          }}
        >
          <Group justify="space-between" align="start" wrap="nowrap">
            <Group gap="sm" align="start" wrap="nowrap">
              <ThemeIcon size={34} radius="xl" variant="light" color={paymentAlertColor}>
                <IconAlertTriangle size={16} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={700}>{paymentAlertTitle}</Text>
                <Text size="sm" c="dimmed">
                  {paymentAlertMessage}
                </Text>
              </Stack>
            </Group>
            <Button
              size="xs"
              color={paymentAlertColor}
              variant="light"
              onClick={() => navigate('/user?tab=plano')}
            >
              Regularizar
            </Button>
          </Group>
        </Card>
      ) : null}

      <Card withBorder radius="md" p="md">
        <Accordion variant="separated" radius="sm">
          <Accordion.Item value="guide-nilo">
            <Accordion.Control py={8}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <ThemeIcon size={28} radius="xl" variant="light" color="teal">
                    <IconSparkles size={14} />
                  </ThemeIcon>
                  <Text fw={700} size="sm">
                    Guia Nilo
                  </Text>
                </Group>
                <Badge color="teal" variant="light" size="sm">
                  {guideProgress}%
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap={6}>
                {guideState.completed ? (
                  <Text size="sm" c="dimmed">
                    Onboarding concluído. Você pode reiniciar quando quiser.
                  </Text>
                ) : (
                  <>
                    <Badge color="green" variant="light" w="fit-content" size="sm">
                      Passo {guideState.step_index + 1} de {DASHBOARD_GUIDE_STEPS.length}
                    </Badge>
                    <Text fw={700} size="sm">
                      {activeGuideStep?.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {activeGuideStep?.description}
                    </Text>
                  </>
                )}

                {!guideState.completed ? (
                  <Progress value={guideProgress} radius="xl" size="sm" color="teal" animated />
                ) : null}

                <Group gap="xs" justify="space-between" wrap="wrap">
                  <Group gap="xs">
                    {!guideState.completed ? (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={handleGuidePrevious}
                        disabled={guideState.step_index === 0}
                      >
                        Anterior
                      </Button>
                    ) : null}
                    {!guideState.completed ? (
                      <Button size="compact-xs" variant="light" onClick={handleGuideNext}>
                        {guideState.step_index >= DASHBOARD_GUIDE_STEPS.length - 1
                          ? 'Concluir'
                          : 'Próximo'}
                      </Button>
                    ) : (
                      <Button size="compact-xs" variant="light" onClick={handleGuideRestart}>
                        Reiniciar
                      </Button>
                    )}
                  </Group>

                  {!guideState.completed && activeGuideStep ? (
                    <Button size="compact-xs" onClick={() => navigate(activeGuideStep.path)}>
                      Ir para etapa
                    </Button>
                  ) : null}
                </Group>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="journey-cadastros">
            <Accordion.Control py={8}>
              <Group justify="space-between" wrap="nowrap">
                <Text fw={700} size="sm">
                  Jornada de cadastros
                </Text>
                <Badge color="blue" variant="light" size="sm">
                  {journeyLoading ? '...' : `${journeyRows.length} áreas`}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap={8}>
                {journeyLoading ? (
                  <Text size="sm" c="dimmed">
                    Carregando progresso da jornada...
                  </Text>
                ) : journeyRows.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Sem dados de jornada para exibir no momento.
                  </Text>
                ) : (
                  journeyRows.map((row) => (
                    <Card key={row.area} withBorder radius="sm" p="xs">
                      <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
                        <Stack gap={0}>
                          <Text fw={700} size="sm">
                            {row.label}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {row.next_tier
                              ? `${row.current}/${row.next_tier.threshold} para ${row.next_tier.title}`
                              : `${row.current} ${row.unit_label}(s) - trilha concluída`}
                          </Text>
                        </Stack>
                        <Badge color="teal" variant="light" size="sm">
                          {row.progress_percent}%
                        </Badge>
                      </Group>

                      <Progress value={row.progress_percent} size="sm" radius="xl" color="teal" />

                      <Group justify="space-between" mt={6}>
                        <Text size="xs" c="dimmed">
                          {row.next_tier
                            ? `Faltam ${row.remaining_to_next} para a próxima badge`
                            : 'Todas as badges desbloqueadas'}
                        </Text>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          onClick={() => navigate(resolveJourneyPath(row.area))}
                        >
                          Abrir
                        </Button>
                      </Group>
                    </Card>
                  ))
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Card>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="center">
          <SegmentedControl
            value={filter}
            onChange={(value) => setFilter(value as NotificationFilter)}
            data={[
              { value: 'all', label: `Todas (${counts.all})` },
              { value: 'unread', label: `Não lidas (${counts.unread})` },
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
          Notificações lidas ou vencidas são removidas automaticamente após 20 dias.
        </Text>
      </Card>

      <Card withBorder radius="md" p="md">
        {loading ? (
          <Text c="dimmed">Carregando notificações...</Text>
        ) : filteredRows.length === 0 ? (
          <Text c="dimmed">Nenhuma notificação para este filtro.</Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Título</Table.Th>
                <Table.Th>Mensagem</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Criada em</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRows.map((row) => {
                const expired = isExpired(row, nowTime);
                const unread = !row.read_at && !expired;
                const statusLabel = expired
                  ? 'Vencida'
                  : unread
                    ? 'Não lida'
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
                            Marcar não lida
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
