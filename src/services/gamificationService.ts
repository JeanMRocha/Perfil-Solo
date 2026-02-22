import { createNotification } from './notificationsService';
import { storageGetRaw, storageWriteJson } from './safeLocalStorage';

const GAMIFICATION_STATE_KEY = 'perfilsolo_gamification_state_v1';
const DAILY_MISSIONS_PER_DAY = 3;
const DAILY_COMPLETION_BONUS_XP = 25;
const STREAK_MILESTONES = new Set([3, 7, 14, 30, 60, 100]);

export const GAMIFICATION_UPDATED_EVENT = 'perfilsolo:gamification-updated';

export type GamificationEventType =
  | 'app_open'
  | 'visit_dashboard'
  | 'visit_user_center'
  | 'profile_saved'
  | 'property_created'
  | 'person_created'
  | 'analysis_created'
  | 'report_generated';

type MissionTemplate = {
  id: string;
  title: string;
  description: string;
  event_type: GamificationEventType;
  target: number;
  reward_xp: number;
};

const DAILY_MISSION_POOL: MissionTemplate[] = [
  {
    id: 'daily_checkin',
    title: 'Check-in diario',
    description: 'Abra o app para manter sua sequencia ativa.',
    event_type: 'app_open',
    target: 1,
    reward_xp: 12,
  },
  {
    id: 'dashboard_focus',
    title: 'Foco no painel',
    description: 'Visite o Dashboard 2 vezes no dia.',
    event_type: 'visit_dashboard',
    target: 2,
    reward_xp: 16,
  },
  {
    id: 'user_center_visit',
    title: 'Central em dia',
    description: 'Abra a Central do Usuário pelo menos 1 vez.',
    event_type: 'visit_user_center',
    target: 1,
    reward_xp: 10,
  },
  {
    id: 'profile_update',
    title: 'Perfil atualizado',
    description: 'Salve alguma atualizacao no seu perfil.',
    event_type: 'profile_saved',
    target: 1,
    reward_xp: 22,
  },
  {
    id: 'property_registry',
    title: 'Primeira propriedade do dia',
    description: 'Cadastre 1 propriedade para evoluir sua jornada.',
    event_type: 'property_created',
    target: 1,
    reward_xp: 28,
  },
  {
    id: 'people_registry',
    title: 'Cadastro de pessoa',
    description: 'Cadastre pelo menos 1 pessoa no modulo Pessoas.',
    event_type: 'person_created',
    target: 1,
    reward_xp: 24,
  },
];

const EVENT_BASE_XP: Partial<Record<GamificationEventType, number>> = {
  property_created: 12,
};

export interface GamificationDailyMission {
  id: string;
  template_id: string;
  title: string;
  description: string;
  event_type: GamificationEventType;
  target: number;
  progress: number;
  reward_xp: number;
  completed_at: string | null;
}

type StoredGamificationState = {
  user_id: string;
  xp_total: number;
  streak_current: number;
  streak_longest: number;
  last_checkin_day: string;
  daily_day_key: string;
  daily_completion_bonus_day: string;
  daily_missions: GamificationDailyMission[];
  missions_completed_total: number;
  events_count: Partial<Record<GamificationEventType, number>>;
  updated_at: string;
};

export interface GamificationLevelProgress {
  level: number;
  xp_in_level: number;
  xp_to_next_level: number;
  progress_percent: number;
}

export interface GamificationState extends StoredGamificationState {
  level: GamificationLevelProgress;
}

export interface TrackGamificationResult {
  state: GamificationState;
  event_type: GamificationEventType;
  xp_gained: number;
  level_up: boolean;
  streak_updated: boolean;
  daily_bonus_awarded: boolean;
  completed_missions: GamificationDailyMission[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUserId(userId: string): string {
  return String(userId ?? '').trim();
}

function parsePositiveInt(input: unknown, fallback = 0): number {
  const parsed = Math.round(Number(input));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function parseIsoOrEmpty(input: unknown): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  const time = new Date(text).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString();
}

function parseDayKey(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const [y, m, d] = raw.split('-').map((part) => Number(part));
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() + 1 !== m ||
    dt.getDate() !== d
  ) {
    return '';
  }
  return raw;
}

function dayKeyLocal(dateLike: Date | string | number): string {
  const dt = new Date(dateLike);
  if (!Number.isFinite(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayDayKey(): string {
  return dayKeyLocal(new Date());
}

function isPreviousDay(previousDay: string, currentDay: string): boolean {
  const prev = parseDayKey(previousDay);
  const curr = parseDayKey(currentDay);
  if (!prev || !curr) return false;
  const [prevY, prevM, prevD] = prev.split('-').map(Number);
  const [currY, currM, currD] = curr.split('-').map(Number);
  const prevDate = new Date(prevY, prevM - 1, prevD);
  const currDate = new Date(currY, currM - 1, currD);
  const diffDays = Math.round(
    (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  return diffDays === 1;
}

function hashText(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function cloneMission(mission: GamificationDailyMission): GamificationDailyMission {
  return {
    ...mission,
    completed_at: mission.completed_at ?? null,
  };
}

function normalizeMission(raw: Partial<GamificationDailyMission>): GamificationDailyMission | null {
  const id = String(raw.id ?? '').trim();
  const templateId = String(raw.template_id ?? '').trim();
  const title = String(raw.title ?? '').trim();
  const description = String(raw.description ?? '').trim();
  const eventType = raw.event_type;
  const target = Math.max(1, parsePositiveInt(raw.target, 1));
  const progress = Math.min(target, parsePositiveInt(raw.progress, 0));
  const rewardXp = Math.max(1, parsePositiveInt(raw.reward_xp, 1));
  const completedAt = raw.completed_at ? parseIsoOrEmpty(raw.completed_at) : '';

  if (!id || !templateId || !title || !description) return null;
  if (
    eventType !== 'app_open' &&
    eventType !== 'visit_dashboard' &&
    eventType !== 'visit_user_center' &&
    eventType !== 'profile_saved' &&
    eventType !== 'property_created' &&
    eventType !== 'person_created' &&
    eventType !== 'analysis_created' &&
    eventType !== 'report_generated'
  ) {
    return null;
  }

  return {
    id,
    template_id: templateId,
    title,
    description,
    event_type: eventType,
    target,
    progress,
    reward_xp: rewardXp,
    completed_at: completedAt || null,
  };
}

function pickDailyMissionTemplates(
  userId: string,
  dayKey: string,
): MissionTemplate[] {
  const normalizedDayKey = parseDayKey(dayKey) || todayDayKey();
  const available = [...DAILY_MISSION_POOL];
  const selected: MissionTemplate[] = [];
  let seed = hashText(`${userId}:${normalizedDayKey}`) || 1;

  while (available.length > 0 && selected.length < DAILY_MISSIONS_PER_DAY) {
    const index = seed % available.length;
    selected.push(available[index]);
    available.splice(index, 1);
    seed = nextSeed(seed);
  }

  return selected;
}

function createDailyMissions(userId: string, dayKey: string): GamificationDailyMission[] {
  const normalizedDayKey = parseDayKey(dayKey) || todayDayKey();
  return pickDailyMissionTemplates(userId, normalizedDayKey).map((template) => ({
    id: `${normalizedDayKey}:${template.id}`,
    template_id: template.id,
    title: template.title,
    description: template.description,
    event_type: template.event_type,
    target: template.target,
    progress: 0,
    reward_xp: template.reward_xp,
    completed_at: null,
  }));
}

function xpNeededForLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.round(level));
  return 80 + (normalizedLevel - 1) * 40;
}

function resolveEventBaseXp(eventType: GamificationEventType): number {
  const mapped = EVENT_BASE_XP[eventType] ?? 0;
  const normalized = Math.round(Number(mapped));
  if (!Number.isFinite(normalized)) return 0;
  return Math.max(0, normalized);
}

function resolveLevelProgress(xpTotalInput: number): GamificationLevelProgress {
  const xpTotal = Math.max(0, Math.round(xpTotalInput));
  let level = 1;
  let remaining = xpTotal;
  let currentLevelNeed = xpNeededForLevel(level);

  while (remaining >= currentLevelNeed) {
    remaining -= currentLevelNeed;
    level += 1;
    currentLevelNeed = xpNeededForLevel(level);
  }

  return {
    level,
    xp_in_level: remaining,
    xp_to_next_level: currentLevelNeed,
    progress_percent:
      currentLevelNeed > 0
        ? Math.min(100, Math.round((remaining / currentLevelNeed) * 100))
        : 0,
  };
}

function parseEventCounters(
  input: unknown,
): Partial<Record<GamificationEventType, number>> {
  if (!input || typeof input !== 'object') return {};
  const source = input as Record<string, unknown>;
  const next: Partial<Record<GamificationEventType, number>> = {};
  const keys: GamificationEventType[] = [
    'app_open',
    'visit_dashboard',
    'visit_user_center',
    'profile_saved',
    'property_created',
    'person_created',
    'analysis_created',
    'report_generated',
  ];

  keys.forEach((key) => {
    const parsed = parsePositiveInt(source[key], 0);
    if (parsed > 0) next[key] = parsed;
  });

  return next;
}

function makeDefaultState(userId: string): StoredGamificationState {
  const today = todayDayKey();
  return {
    user_id: userId,
    xp_total: 0,
    streak_current: 0,
    streak_longest: 0,
    last_checkin_day: '',
    daily_day_key: today,
    daily_completion_bonus_day: '',
    daily_missions: createDailyMissions(userId, today),
    missions_completed_total: 0,
    events_count: {},
    updated_at: nowIso(),
  };
}

function normalizeStoredState(
  userId: string,
  input?: Partial<StoredGamificationState>,
): StoredGamificationState {
  const base = makeDefaultState(userId);
  if (!input) return base;

  const normalizedDay = parseDayKey(input.daily_day_key) || base.daily_day_key;
  const normalizedMissions = Array.isArray(input.daily_missions)
    ? input.daily_missions
        .map((row) => normalizeMission(row))
        .filter((row): row is GamificationDailyMission => Boolean(row))
    : [];

  return {
    user_id: userId,
    xp_total: parsePositiveInt(input.xp_total, 0),
    streak_current: parsePositiveInt(input.streak_current, 0),
    streak_longest: parsePositiveInt(input.streak_longest, 0),
    last_checkin_day: parseDayKey(input.last_checkin_day),
    daily_day_key: normalizedDay,
    daily_completion_bonus_day: parseDayKey(input.daily_completion_bonus_day),
    daily_missions:
      normalizedMissions.length > 0
        ? normalizedMissions.map((row) => cloneMission(row))
        : createDailyMissions(userId, normalizedDay),
    missions_completed_total: parsePositiveInt(input.missions_completed_total, 0),
    events_count: parseEventCounters(input.events_count),
    updated_at: parseIsoOrEmpty(input.updated_at) || nowIso(),
  };
}

function readAllStates(): Record<string, StoredGamificationState> {
  try {
    const raw = storageGetRaw(GAMIFICATION_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<StoredGamificationState>>;
    if (!parsed || typeof parsed !== 'object') return {};

    const result: Record<string, StoredGamificationState> = {};
    Object.entries(parsed).forEach(([userId, value]) => {
      const normalizedUserId = normalizeUserId(userId);
      if (!normalizedUserId) return;
      result[normalizedUserId] = normalizeStoredState(normalizedUserId, value);
    });
    return result;
  } catch {
    return {};
  }
}

function writeAllStates(allStates: Record<string, StoredGamificationState>): boolean {
  return storageWriteJson(GAMIFICATION_STATE_KEY, allStates);
}

function emitGamificationUpdated(userId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(GAMIFICATION_UPDATED_EVENT, {
      detail: { userId },
    }),
  );
}

function ensureDailyMissionsCurrent(
  state: StoredGamificationState,
  userId: string,
  dayKey: string,
): boolean {
  if (state.daily_day_key === dayKey && state.daily_missions.length > 0) return false;
  state.daily_day_key = dayKey;
  state.daily_missions = createDailyMissions(userId, dayKey);
  state.daily_completion_bonus_day = '';
  return true;
}

function applyDailyCheckin(state: StoredGamificationState, dayKey: string): {
  changed: boolean;
  streak_updated: boolean;
  milestone_reached: boolean;
  bonus_xp: number;
} {
  if (state.last_checkin_day === dayKey) {
    return {
      changed: false,
      streak_updated: false,
      milestone_reached: false,
      bonus_xp: 0,
    };
  }

  const continueStreak = isPreviousDay(state.last_checkin_day, dayKey);
  state.streak_current = continueStreak ? state.streak_current + 1 : 1;
  state.streak_longest = Math.max(state.streak_longest, state.streak_current);
  state.last_checkin_day = dayKey;

  const bonusXp = state.streak_current >= 2
    ? Math.min(20, 5 + state.streak_current)
    : 0;

  return {
    changed: true,
    streak_updated: true,
    milestone_reached: STREAK_MILESTONES.has(state.streak_current),
    bonus_xp: bonusXp,
  };
}

function toPublicState(state: StoredGamificationState): GamificationState {
  return {
    ...state,
    daily_missions: state.daily_missions.map((row) => cloneMission(row)),
    level: resolveLevelProgress(state.xp_total),
  };
}

function persistAndEmit(
  allStates: Record<string, StoredGamificationState>,
  userId: string,
): void {
  if (writeAllStates(allStates)) {
    emitGamificationUpdated(userId);
  }
}

async function notifyMissionCompleted(
  userId: string,
  missions: GamificationDailyMission[],
): Promise<void> {
  if (missions.length === 0) return;
  const missionTitles = missions.map((row) => row.title).join(', ');
  const totalXp = missions.reduce((acc, row) => acc + row.reward_xp, 0);
  await createNotification(userId, {
    title: 'Missao diaria concluida',
    message: `${missionTitles}. Recompensa: +${totalXp} XP.`,
    level: 'success',
  });
}

async function notifyDailyBonus(userId: string): Promise<void> {
  await createNotification(userId, {
    title: 'Baú diario liberado',
    message: `Todas as missoes do dia concluidas. Bonus: +${DAILY_COMPLETION_BONUS_XP} XP.`,
    level: 'success',
  });
}

async function notifyLevelUp(userId: string, level: number): Promise<void> {
  await createNotification(userId, {
    title: 'Subiu de nivel',
    message: `Parabens. Voce chegou ao nivel ${level}.`,
    level: 'success',
  });
}

async function notifyStreakMilestone(userId: string, streakDays: number): Promise<void> {
  await createNotification(userId, {
    title: 'Sequencia em destaque',
    message: `Voce alcancou ${streakDays} dias seguidos de atividade.`,
    level: 'info',
  });
}

export function getGamificationState(userId: string): GamificationState {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para gamificacao.');
  }

  const allStates = readAllStates();
  const existing = allStates[normalizedUserId];
  const state = normalizeStoredState(normalizedUserId, existing);
  const dayKey = todayDayKey();
  const changed = ensureDailyMissionsCurrent(state, normalizedUserId, dayKey);
  state.updated_at = nowIso();
  allStates[normalizedUserId] = state;

  if (!existing || changed) {
    persistAndEmit(allStates, normalizedUserId);
  }

  return toPublicState(state);
}

export async function trackGamificationEvent(
  userId: string,
  eventType: GamificationEventType,
): Promise<TrackGamificationResult> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para gamificacao.');
  }

  const allStates = readAllStates();
  const state = normalizeStoredState(normalizedUserId, allStates[normalizedUserId]);
  const dayKey = todayDayKey();
  let changed = ensureDailyMissionsCurrent(state, normalizedUserId, dayKey);
  let xpGained = 0;
  let levelUp = false;
  let streakUpdated = false;
  let dailyBonusAwarded = false;
  let streakMilestoneReached = false;

  if (eventType === 'app_open') {
    const streakResult = applyDailyCheckin(state, dayKey);
    if (streakResult.changed) {
      changed = true;
      streakUpdated = streakResult.streak_updated;
      streakMilestoneReached = streakResult.milestone_reached;
      xpGained += streakResult.bonus_xp;
    }
  }

  const previousLevel = resolveLevelProgress(state.xp_total).level;
  xpGained += resolveEventBaseXp(eventType);
  state.events_count[eventType] = (state.events_count[eventType] ?? 0) + 1;
  changed = true;

  const completedMissions: GamificationDailyMission[] = [];

  state.daily_missions = state.daily_missions.map((mission) => {
    if (mission.event_type !== eventType || mission.completed_at) {
      return mission;
    }

    const nextProgress = Math.min(mission.target, mission.progress + 1);
    if (nextProgress < mission.target) {
      return { ...mission, progress: nextProgress };
    }

    const completedMission: GamificationDailyMission = {
      ...mission,
      progress: mission.target,
      completed_at: nowIso(),
    };
    completedMissions.push(completedMission);
    xpGained += mission.reward_xp;
    state.missions_completed_total += 1;
    return completedMission;
  });

  const allCompletedToday = state.daily_missions.every(
    (mission) => mission.completed_at !== null,
  );
  if (allCompletedToday && state.daily_completion_bonus_day !== dayKey) {
    state.daily_completion_bonus_day = dayKey;
    xpGained += DAILY_COMPLETION_BONUS_XP;
    dailyBonusAwarded = true;
    changed = true;
  }

  if (xpGained > 0) {
    state.xp_total += xpGained;
    const nextLevel = resolveLevelProgress(state.xp_total).level;
    levelUp = nextLevel > previousLevel;
    changed = true;
  }

  state.updated_at = nowIso();
  allStates[normalizedUserId] = state;

  if (changed) {
    persistAndEmit(allStates, normalizedUserId);
  }

  const notificationsTasks: Promise<void>[] = [];
  if (completedMissions.length > 0) {
    notificationsTasks.push(
      notifyMissionCompleted(normalizedUserId, completedMissions),
    );
  }
  if (dailyBonusAwarded) {
    notificationsTasks.push(notifyDailyBonus(normalizedUserId));
  }
  if (levelUp) {
    const currentLevel = resolveLevelProgress(state.xp_total).level;
    notificationsTasks.push(notifyLevelUp(normalizedUserId, currentLevel));
  }
  if (streakMilestoneReached) {
    notificationsTasks.push(
      notifyStreakMilestone(normalizedUserId, state.streak_current),
    );
  }

  await Promise.allSettled(notificationsTasks);

  return {
    state: toPublicState(state),
    event_type: eventType,
    xp_gained: xpGained,
    level_up: levelUp,
    streak_updated: streakUpdated,
    daily_bonus_awarded: dailyBonusAwarded,
    completed_missions: completedMissions.map((row) => cloneMission(row)),
  };
}
