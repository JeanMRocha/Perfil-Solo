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
} from '@mantine/core';
import { useStore } from '@nanostores/react';
import { IconFlame, IconTargetArrow, IconTrophy } from '@tabler/icons-react';
import { $currUser } from '../../global-state/user';
import {
  GAMIFICATION_UPDATED_EVENT,
  getGamificationState,
  type GamificationState,
} from '../../services/gamificationService';

function missionProgressLabel(current: number, target: number): string {
  return `${Math.min(target, Math.max(0, current))}/${Math.max(1, target)}`;
}

export default function GamificationPanel() {
  const user = useStore($currUser);
  const userId = String(user?.id ?? '').trim();
  const [state, setState] = useState<GamificationState | null>(null);

  const completedToday = useMemo(() => {
    if (!state) return 0;
    return state.daily_missions.filter((mission) => mission.completed_at).length;
  }, [state]);

  useEffect(() => {
    let alive = true;

    const refresh = () => {
      if (!userId || !alive) {
        setState(null);
        return;
      }
      try {
        setState(getGamificationState(userId));
      } catch {
        setState(null);
      }
    };

    refresh();

    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      const changedUserId = String(custom.detail?.userId ?? '').trim();
      if (changedUserId && changedUserId !== userId) return;
      refresh();
    };

    const onStorage = () => refresh();

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
        <Text c="dimmed">Carregando jornada...</Text>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
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
      </SimpleGrid>

      <Card withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Lista de missoes</Text>
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              setState(getGamificationState(userId));
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
