import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useStore } from '@nanostores/react';
import {
  IconFlame,
  IconFlask,
  IconMap2,
  IconMapPin2,
  IconSparkles,
  IconTargetArrow,
  IconTrophy,
} from '@tabler/icons-react';
import { $currUser } from '../../global-state/user';
import { getBillingUsageForUser } from '../../services/billingPlanService';
import {
  buildGamificationAreaProgress,
  listGamificationLevelBenefits,
  resolveCurrentLevelBenefit,
  type GamificationAreaProgress,
} from '../../services/gamificationProgressService';
import {
  GAMIFICATION_UPDATED_EVENT,
  getGamificationState,
  type GamificationState,
} from '../../services/gamificationService';

function missionProgressLabel(current: number, target: number): string {
  return `${Math.min(target, Math.max(0, current))}/${Math.max(1, target)}`;
}

function areaIcon(area: GamificationAreaProgress['area']) {
  if (area === 'properties') return IconMap2;
  if (area === 'talhoes') return IconMapPin2;
  return IconFlask;
}

function pluralize(unit: string, value: number): string {
  return value === 1 ? unit : `${unit}s`;
}

export default function GamificationPanel() {
  const user = useStore($currUser);
  const userId = String(user?.id ?? '').trim();
  const [state, setState] = useState<GamificationState | null>(null);
  const [areaProgress, setAreaProgress] = useState<GamificationAreaProgress[]>([]);
  const [loading, setLoading] = useState(false);

  const completedToday = useMemo(() => {
    if (!state) return 0;
    return state.daily_missions.filter((mission) => mission.completed_at).length;
  }, [state]);

  const levelBenefits = useMemo(() => listGamificationLevelBenefits(), []);
  const currentLevelBenefit = useMemo(
    () => resolveCurrentLevelBenefit(state?.level.level ?? 1),
    [state?.level.level],
  );

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      if (!userId || !alive) {
        setState(null);
        setAreaProgress([]);
        return;
      }

      setLoading(true);
      try {
        const nextState = getGamificationState(userId);
        const usage = await getBillingUsageForUser(userId);
        if (!alive) return;
        setState(nextState);
        setAreaProgress(
          buildGamificationAreaProgress({
            properties: usage.properties,
            talhoes: usage.talhoes,
            analises: usage.analises,
          }),
        );
      } catch {
        if (!alive) return;
        setState(null);
        setAreaProgress([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    void refresh();

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedUserId = String(custom.detail?.userId ?? '').trim();
      if (changedUserId && changedUserId !== userId) return;
      void refresh();
    };

    const onStorage = () => {
      void refresh();
    };

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);

    return () => {
      alive = false;
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId]);

  if (!userId) {
    return (
      <Card withBorder p="md">
        <Text c="dimmed">Usuario nao identificado para jornada gamificada.</Text>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card withBorder p="md">
        <Text c="dimmed">{loading ? 'Carregando jornada...' : 'Falha ao carregar jornada.'}</Text>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
        <Card withBorder p="md">
          <Group justify="space-between" mb={6}>
            <Text fw={700}>Nivel</Text>
            <IconTrophy size={16} />
          </Group>
          <Text size="xl" fw={800}>
            {state.level.level}
          </Text>
          <Text size="sm" c="dimmed" mb={8}>
            XP total: {state.xp_total}
          </Text>
          <Progress value={state.level.progress_percent} />
          <Text size="xs" c="dimmed" mt={6}>
            {state.level.xp_in_level}/{state.level.xp_to_next_level} XP no nivel atual
          </Text>
        </Card>

        <Card withBorder p="md">
          <Group justify="space-between" mb={6}>
            <Text fw={700}>Streak</Text>
            <IconFlame size={16} />
          </Group>
          <Text size="xl" fw={800}>
            {state.streak_current} dias
          </Text>
          <Text size="sm" c="dimmed">
            Recorde: {state.streak_longest} dias
          </Text>
          <Text size="xs" c="dimmed" mt={8}>
            Ultimo check-in: {state.last_checkin_day || '--'}
          </Text>
        </Card>

        <Card withBorder p="md">
          <Group justify="space-between" mb={6}>
            <Text fw={700}>Missoes do dia</Text>
            <IconTargetArrow size={16} />
          </Group>
          <Text size="xl" fw={800}>
            {completedToday}/{state.daily_missions.length}
          </Text>
          <Text size="sm" c="dimmed">
            Concluidas hoje
          </Text>
          <Text size="xs" c="dimmed" mt={8}>
            Bonus do dia: +25 XP ao fechar todas
          </Text>
        </Card>

        <Card withBorder p="md">
          <Group justify="space-between" mb={6}>
            <Text fw={700}>Beneficio atual</Text>
            <IconSparkles size={16} />
          </Group>
          <Badge color="violet" variant="light" mb={8}>
            {currentLevelBenefit.title}
          </Badge>
          <Text size="sm" c="dimmed">
            {currentLevelBenefit.benefit}
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Beneficios por nivel</Text>
          <Badge color="blue" variant="light">
            Roadmap da jornada
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
          {levelBenefits.map((item) => {
            const unlocked = state.level.level >= item.level;
            const current = currentLevelBenefit.level === item.level;
            return (
              <Card key={`benefit:${item.level}`} withBorder radius="md" p="sm">
                <Group justify="space-between" mb={4}>
                  <Text fw={700} size="sm">
                    Nivel {item.level}
                  </Text>
                  <Badge color={unlocked ? 'teal' : 'gray'} variant={unlocked ? 'filled' : 'light'}>
                    {unlocked ? (current ? 'Atual' : 'Desbloqueado') : 'Bloqueado'}
                  </Badge>
                </Group>
                <Text size="sm" fw={600}>
                  {item.title}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {item.benefit}
                </Text>
              </Card>
            );
          })}
        </SimpleGrid>
      </Card>

      <Card withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Progresso por area e badges</Text>
          <Button
            size="xs"
            variant="light"
            loading={loading}
            onClick={async () => {
              if (!userId) return;
              setLoading(true);
              try {
                const usage = await getBillingUsageForUser(userId);
                setAreaProgress(
                  buildGamificationAreaProgress({
                    properties: usage.properties,
                    talhoes: usage.talhoes,
                    analises: usage.analises,
                  }),
                );
                setState(getGamificationState(userId));
              } finally {
                setLoading(false);
              }
            }}
          >
            Atualizar progresso
          </Button>
        </Group>

        {areaProgress.length === 0 ? (
          <Text size="sm" c="dimmed">
            Sem dados de progresso por area no momento.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            {areaProgress.map((item) => {
              const Icon = areaIcon(item.area);
              return (
                <Card key={`area:${item.area}`} withBorder radius="md" p="sm">
                  <Stack gap={8}>
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap={8}>
                        <ThemeIcon variant="light" color="green">
                          <Icon size={14} />
                        </ThemeIcon>
                        <Text fw={700} size="sm">
                          {item.label}
                        </Text>
                      </Group>
                      <Badge color="green" variant="light">
                        {item.current} {pluralize(item.unit_label, item.current)}
                      </Badge>
                    </Group>

                    <Progress value={item.progress_percent} />

                    <Text size="xs" c="dimmed">
                      {item.next_tier
                        ? `Faltam ${item.remaining_to_next} para ${item.next_tier.title}.`
                        : 'Trilha completa nesta area.'}
                    </Text>

                    <Group gap={6}>
                      {item.unlocked_tiers.length > 0 ? (
                        item.unlocked_tiers.map((tier) => (
                          <Badge key={tier.id} color="teal" variant="light">
                            {tier.title}
                          </Badge>
                        ))
                      ) : (
                        <Badge color="gray" variant="light">
                          Nenhum badge ainda
                        </Badge>
                      )}
                    </Group>

                    <Text size="xs" c="dimmed">
                      {item.current_tier
                        ? `Badge atual: ${item.current_tier.title}. ${item.current_tier.description}`
                        : `Primeiro badge: ${item.next_tier?.title ?? '--'}.`}
                    </Text>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Card>

      <Card withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Lista de missoes</Text>
          <Button
            size="xs"
            variant="light"
            loading={loading}
            onClick={async () => {
              if (!userId) return;
              setLoading(true);
              try {
                setState(getGamificationState(userId));
              } finally {
                setLoading(false);
              }
            }}
          >
            Atualizar
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {state.daily_missions.map((mission) => {
            const done = Boolean(mission.completed_at);
            const pct = Math.min(
              100,
              Math.round((mission.progress / Math.max(1, mission.target)) * 100),
            );
            return (
              <Card key={mission.id} withBorder radius="md" p="sm">
                <Stack gap={6}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={700} size="sm">
                      {mission.title}
                    </Text>
                    <Badge color={done ? 'teal' : 'gray'} variant={done ? 'filled' : 'light'}>
                      {done ? 'Concluida' : `+${mission.reward_xp} XP`}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {mission.description}
                  </Text>
                  <Progress value={pct} color={done ? 'teal' : 'blue'} />
                  <Text size="xs" c="dimmed">
                    Progresso: {missionProgressLabel(mission.progress, mission.target)}
                  </Text>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      </Card>
    </Stack>
  );
}
