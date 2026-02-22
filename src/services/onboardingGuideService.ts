import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export type DashboardGuideTarget = 'propriedades' | 'analises' | 'pessoas';

export type DashboardGuideStep = {
  id: string;
  title: string;
  description: string;
  tip: string;
  path: string;
  target: DashboardGuideTarget;
};

export type DashboardGuideState = {
  step_index: number;
  completed: boolean;
  updated_at: string;
};

type DashboardGuideStore = Record<string, DashboardGuideState>;

const DASHBOARD_ONBOARDING_KEY = 'perfilsolo_dashboard_onboarding_v1';

export const ONBOARDING_GUIDE_UPDATED_EVENT = 'perfilsolo:onboarding-guide-updated';

export const DASHBOARD_GUIDE_STEPS: DashboardGuideStep[] = [
  {
    id: 'properties',
    title: 'Passo 1: Cadastre sua primeira propriedade',
    description:
      'Comece organizando a base da operação. Toda a jornada de talhões e análises parte daqui.',
    tip: 'Use nomes claros para identificar fazendas e unidades de produção.',
    path: '/propriedades',
    target: 'propriedades',
  },
  {
    id: 'analyses',
    title: 'Passo 2: Lance uma análise de solo',
    description:
      'Com a propriedade criada, avance para o cadastro de análises e monte seu histórico tecnico.',
    tip: 'Comece por um talhão principal para ter comparativo nas proximas coletas.',
    path: '/analise-solo',
    target: 'analises',
  },
  {
    id: 'people',
    title: 'Passo 3: Estruture sua rede de pessoas',
    description:
      'Cadastre produtores, consultores, fornecedores e contatos que participam do manejo.',
    tip: 'Use categorias para facilitar filtros e relatorios depois.',
    path: '/cadastros/pessoas/busca',
    target: 'pessoas',
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function emitGuideUpdated(userId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_GUIDE_UPDATED_EVENT, {
      detail: { userId },
    }),
  );
}

function normalizeIndex(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 0) return 0;
  if (parsed >= DASHBOARD_GUIDE_STEPS.length) return DASHBOARD_GUIDE_STEPS.length - 1;
  return parsed;
}

export function defaultGuideState(): DashboardGuideState {
  return {
    step_index: 0,
    completed: false,
    updated_at: nowIso(),
  };
}

function normalizeGuideState(input: Partial<DashboardGuideState> | undefined): DashboardGuideState {
  if (!input) return defaultGuideState();
  return {
    step_index: normalizeIndex(input.step_index),
    completed: Boolean(input.completed),
    updated_at: String(input.updated_at ?? nowIso()),
  };
}

function readGuideStore(): DashboardGuideStore {
  return storageReadJson<DashboardGuideStore>(DASHBOARD_ONBOARDING_KEY, {});
}

function writeGuideStore(store: DashboardGuideStore): void {
  storageWriteJson(DASHBOARD_ONBOARDING_KEY, store);
}

export function resolveGuideUserId(userIdLike: string | null | undefined): string {
  const normalized = String(userIdLike ?? '').trim();
  return normalized || 'local-user';
}

export function getGuideStateByUser(userId: string): DashboardGuideState {
  const all = readGuideStore();
  return normalizeGuideState(all[userId]);
}

export function getGuideProgressValue(state: DashboardGuideState): number {
  if (state.completed) return 100;
  return Math.round(((state.step_index + 1) / DASHBOARD_GUIDE_STEPS.length) * 100);
}

export function getActiveGuideStep(state: DashboardGuideState): DashboardGuideStep | null {
  if (DASHBOARD_GUIDE_STEPS.length === 0) return null;
  return DASHBOARD_GUIDE_STEPS[normalizeIndex(state.step_index)] ?? null;
}

export function writeGuideStateByUser(userId: string, state: DashboardGuideState): void {
  const all = readGuideStore();
  all[userId] = normalizeGuideState(state);
  writeGuideStore(all);
  emitGuideUpdated(userId);
}

export function restartGuideByUser(userId: string): DashboardGuideState {
  const next = defaultGuideState();
  writeGuideStateByUser(userId, next);
  return next;
}

export function nextGuideStepByUser(userId: string): DashboardGuideState {
  const current = getGuideStateByUser(userId);
  if (current.completed) return current;
  const isLast = current.step_index >= DASHBOARD_GUIDE_STEPS.length - 1;
  if (isLast) {
    const completed = {
      ...current,
      completed: true,
      updated_at: nowIso(),
    };
    writeGuideStateByUser(userId, completed);
    return completed;
  }

  const next = {
    ...current,
    step_index: current.step_index + 1,
    updated_at: nowIso(),
  };
  writeGuideStateByUser(userId, next);
  return next;
}

export function previousGuideStepByUser(userId: string): DashboardGuideState {
  const current = getGuideStateByUser(userId);
  if (current.completed) return current;
  if (current.step_index <= 0) return current;
  const previous = {
    ...current,
    step_index: current.step_index - 1,
    updated_at: nowIso(),
  };
  writeGuideStateByUser(userId, previous);
  return previous;
}
