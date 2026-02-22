import type { BillingPlanId } from '../modules/billing';
import { getBillingFeaturesWithCatalog } from './billingCatalogService';
import {
  getBillingSubscriptionForUser,
  getBillingUsageForUser,
} from './billingPlanService';
import {
  grantCreditsToUser,
  removeCreditsFromUser,
  type CreditTransaction,
} from './creditsService';
import { createInAppPurchaseReceipt } from './inAppPurchasesService';
import { createNotification } from './notificationsService';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export type StoreQuotaResource = 'properties' | 'talhoes' | 'analises';
export type StoreItemCategory = 'quota' | 'cosmetic' | 'service';
export type StoreItemStatus = 'active' | 'coming_soon';
export type StoreQuotaSource = 'purchase' | 'referral_reward' | 'admin_grant';
export type StorePricingMode = 'credits' | 'recurring_brl';
export type StoreCouponType = 'percent' | 'fixed_credits';
export type StoreCouponScope = 'credits' | 'all';

export interface StoreCatalogEffect {
  resource: StoreQuotaResource;
  units: number;
}

export interface StoreCatalogItem {
  id: string;
  label: string;
  description: string;
  category: StoreItemCategory;
  status: StoreItemStatus;
  pricing_mode: StorePricingMode;
  unit_cost_credits: number;
  unit_price_cents: number;
  min_quantity: number;
  max_quantity: number;
  effects: StoreCatalogEffect[];
  linked_feature_id?: StoreQuotaResource;
  cover_gradient?: string;
}

export interface StoreQuotaLedgerEntry {
  id: string;
  user_id: string;
  resource: StoreQuotaResource;
  units: number;
  source: StoreQuotaSource;
  description: string;
  created_at: string;
  created_by?: string;
  reference_id?: string;
}

export interface StorePurchaseReceipt {
  id: string;
  receipt_number: string;
  user_id: string;
  item_id: string;
  item_label: string;
  item_category: StoreItemCategory;
  pricing_mode: StorePricingMode;
  quantity: number;
  unit_cost_credits: number;
  total_cost_credits: number;
  unit_price_cents: number;
  total_price_cents: number;
  coupon_code?: string;
  discount_credits_applied?: number;
  effects: StoreCatalogEffect[];
  credit_transaction_id?: string;
  created_at: string;
}

export interface StoreRecurringCommitment {
  id: string;
  user_id: string;
  item_id: string;
  item_label: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  effects: StoreCatalogEffect[];
  created_at: string;
  updated_at: string;
}

export interface AppStoreCoupon {
  code: string;
  label: string;
  type: StoreCouponType;
  value: number;
  scope: StoreCouponScope;
  active: boolean;
}

export interface AppStoreCouponValidation {
  valid: boolean;
  code: string;
  message: string;
  discount_credits: number;
  discount_recurring_cents: number;
}

export interface StoreRecurringOverview {
  user_id: string;
  total_monthly_cents: number;
  lines: StoreRecurringCommitment[];
}

export interface StoreReferralProfile {
  user_id: string;
  referral_code: string;
  referred_by_code?: string;
  referred_by_user_id?: string;
  first_purchase_reward_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreReferralRewardEvent {
  id: string;
  new_user_id: string;
  referrer_user_id: string;
  purchase_receipt_id: string;
  reward_credits_each: number;
  reward_talhoes_each: number;
  reward_analises_each: number;
  created_at: string;
}

export interface StoreQuotaOverviewItem {
  resource: StoreQuotaResource;
  base_limit: number;
  bonus_limit: number;
  total_limit: number;
  used: number;
  remaining: number;
}

export interface StoreQuotaOverview {
  user_id: string;
  plan_id: BillingPlanId;
  generated_at: string;
  rows: Record<StoreQuotaResource, StoreQuotaOverviewItem>;
}

export interface StoreReferralSummary {
  profile: StoreReferralProfile;
  referred_users_count: number;
  rewarded_referrals_count: number;
}

const STORE_QUOTA_LEDGER_KEY = 'perfilsolo_store_quota_ledger_v1';
const STORE_PURCHASES_KEY = 'perfilsolo_store_purchase_receipts_v1';
const STORE_RECURRING_COMMITMENTS_KEY = 'perfilsolo_store_recurring_commitments_v1';
const STORE_REFERRAL_PROFILES_KEY = 'perfilsolo_store_referral_profiles_v1';
const STORE_REFERRAL_EVENTS_KEY = 'perfilsolo_store_referral_events_v1';

const REFERRAL_REWARD_CREDITS = 5;
const REFERRAL_REWARD_TALHOES = 1;
const REFERRAL_REWARD_ANALISES = 10;

export const APP_STORE_UPDATED_EVENT = 'perfilsolo-app-store-updated';

const STORE_RESOURCE_LABEL: Record<StoreQuotaResource, string> = {
  properties: 'propriedades',
  talhoes: 'talhoes',
  analises: 'analises',
};

const APP_STORE_COUPONS: AppStoreCoupon[] = [
  {
    code: 'CREDITO10',
    label: '10% OFF em itens por créditos',
    type: 'percent',
    value: 10,
    scope: 'credits',
    active: true,
  },
  {
    code: 'WELCOME5',
    label: '-5 créditos no carrinho',
    type: 'fixed_credits',
    value: 5,
    scope: 'credits',
    active: true,
  },
];

const STORE_CATALOG: StoreCatalogItem[] = [
  {
    id: 'quota_property_slot',
    label: 'Cota de propriedade',
    description:
      'Add-on recorrente: adiciona +1 propriedade na capacidade mensal da conta.',
    category: 'quota',
    status: 'active',
    pricing_mode: 'recurring_brl',
    unit_cost_credits: 0,
    unit_price_cents: 0,
    min_quantity: 1,
    max_quantity: 20,
    effects: [{ resource: 'properties', units: 1 }],
    linked_feature_id: 'properties',
    cover_gradient: 'linear-gradient(135deg, rgba(30,72,36,0.85), rgba(13,33,18,0.9))',
  },
  {
    id: 'quota_talhao_slot',
    label: 'Cota de talhão',
    description: 'Add-on recorrente: adiciona +1 talhão no limite mensal.',
    category: 'quota',
    status: 'active',
    pricing_mode: 'recurring_brl',
    unit_cost_credits: 0,
    unit_price_cents: 0,
    min_quantity: 1,
    max_quantity: 200,
    effects: [{ resource: 'talhoes', units: 1 }],
    linked_feature_id: 'talhoes',
    cover_gradient: 'linear-gradient(135deg, rgba(28,88,72,0.85), rgba(18,43,37,0.9))',
  },
  {
    id: 'quota_analise_slot',
    label: 'Cota de análise',
    description: 'Add-on recorrente: adiciona +1 análise de solo no limite mensal.',
    category: 'quota',
    status: 'active',
    pricing_mode: 'recurring_brl',
    unit_cost_credits: 0,
    unit_price_cents: 0,
    min_quantity: 1,
    max_quantity: 1000,
    effects: [{ resource: 'analises', units: 1 }],
    linked_feature_id: 'analises',
    cover_gradient: 'linear-gradient(135deg, rgba(39,89,53,0.85), rgba(17,46,26,0.9))',
  },
  {
    id: 'bundle_farm_expansion',
    label: 'Pacote expansao de fazenda',
    description: 'Pacote recorrente com mix de cotas (em breve).',
    category: 'quota',
    status: 'coming_soon',
    pricing_mode: 'recurring_brl',
    unit_cost_credits: 0,
    unit_price_cents: 0,
    min_quantity: 1,
    max_quantity: 10,
    effects: [
      { resource: 'properties', units: 1 },
      { resource: 'talhoes', units: 20 },
      { resource: 'analises', units: 80 },
    ],
    cover_gradient: 'linear-gradient(135deg, rgba(32,67,94,0.85), rgba(14,33,48,0.9))',
  },
  {
    id: 'cosmetic_profile_pack_01',
    label: 'Pacote visual de perfil',
    description:
      'Pacote avulso de figuras e molduras para perfil.',
    category: 'cosmetic',
    status: 'active',
    pricing_mode: 'credits',
    unit_cost_credits: 60,
    unit_price_cents: 0,
    min_quantity: 1,
    max_quantity: 5,
    effects: [],
    cover_gradient: 'linear-gradient(135deg, rgba(68,58,108,0.85), rgba(33,29,58,0.9))',
  },
  {
    id: 'service_ai_analysis_ticket',
    label: 'Análise IA premium',
    description:
      'Ticket avulso para análise inteligente sobre análises de solo.',
    category: 'service',
    status: 'active',
    pricing_mode: 'credits',
    unit_cost_credits: 45,
    unit_price_cents: 0,
    min_quantity: 1,
    max_quantity: 20,
    effects: [],
    cover_gradient: 'linear-gradient(135deg, rgba(17,86,102,0.85), rgba(14,37,46,0.9))',
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeReceiptNumber(): string {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LJ-${y}${m}${d}-${suffix}`;
}

function normalizeUserId(input: unknown): string {
  return String(input ?? '').trim();
}

function normalizeCode(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function parsePositiveInt(input: unknown, fallback = 1): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded <= 0) return fallback;
  return rounded;
}

function parseNonNegativeInt(input: unknown, fallback = 0): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function emitUpdated(userId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(APP_STORE_UPDATED_EVENT, {
      detail: { userId: String(userId ?? '').trim() },
    }),
  );
}

function readQuotaLedger(): StoreQuotaLedgerEntry[] {
  const parsed = storageReadJson<StoreQuotaLedgerEntry[]>(STORE_QUOTA_LEDGER_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row) => row?.id && row?.user_id && row?.resource);
}

function writeQuotaLedger(rows: StoreQuotaLedgerEntry[], changedUserId?: string): void {
  const saved = storageWriteJson(STORE_QUOTA_LEDGER_KEY, rows.slice(-50000));
  if (!saved) throw new Error('Falha ao persistir cotas da loja.');
  emitUpdated(changedUserId);
}

function readPurchases(): StorePurchaseReceipt[] {
  const parsed = storageReadJson<StorePurchaseReceipt[]>(STORE_PURCHASES_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((row) => row?.id && row?.user_id && row?.item_id)
    .map((row) => ({
      ...row,
      pricing_mode:
        row?.pricing_mode === 'recurring_brl' ? 'recurring_brl' : 'credits',
      unit_cost_credits: parseNonNegativeInt(row?.unit_cost_credits, 0),
      total_cost_credits: parseNonNegativeInt(row?.total_cost_credits, 0),
      unit_price_cents: parseNonNegativeInt(row?.unit_price_cents, 0),
      total_price_cents: parseNonNegativeInt(row?.total_price_cents, 0),
      discount_credits_applied: parseNonNegativeInt(
        row?.discount_credits_applied,
        0,
      ),
      coupon_code: String(row?.coupon_code ?? '').trim() || undefined,
    }));
}

function writePurchases(rows: StorePurchaseReceipt[], changedUserId?: string): void {
  const saved = storageWriteJson(STORE_PURCHASES_KEY, rows.slice(-20000));
  if (!saved) throw new Error('Falha ao persistir comprovantes da loja.');
  emitUpdated(changedUserId);
}

function readRecurringCommitments(): StoreRecurringCommitment[] {
  const parsed = storageReadJson<StoreRecurringCommitment[]>(
    STORE_RECURRING_COMMITMENTS_KEY,
    [],
  );
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((row) => row?.id && row?.user_id && row?.item_id)
    .map((row) => ({
      ...row,
      quantity: parsePositiveInt(row.quantity, 1),
      unit_price_cents: parseNonNegativeInt(row.unit_price_cents, 0),
      total_price_cents: parseNonNegativeInt(row.total_price_cents, 0),
    }));
}

function writeRecurringCommitments(
  rows: StoreRecurringCommitment[],
  changedUserId?: string,
): void {
  const saved = storageWriteJson(STORE_RECURRING_COMMITMENTS_KEY, rows.slice(-20000));
  if (!saved) throw new Error('Falha ao persistir add-ons recorrentes da loja.');
  emitUpdated(changedUserId);
}

function readReferralProfiles(): StoreReferralProfile[] {
  const parsed = storageReadJson<StoreReferralProfile[]>(
    STORE_REFERRAL_PROFILES_KEY,
    [],
  );
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row) => row?.user_id && row?.referral_code);
}

function writeReferralProfiles(
  rows: StoreReferralProfile[],
  changedUserId?: string,
): void {
  const saved = storageWriteJson(STORE_REFERRAL_PROFILES_KEY, rows.slice(-20000));
  if (!saved) throw new Error('Falha ao persistir perfis de indicacao.');
  emitUpdated(changedUserId);
}

function readReferralEvents(): StoreReferralRewardEvent[] {
  const parsed = storageReadJson<StoreReferralRewardEvent[]>(
    STORE_REFERRAL_EVENTS_KEY,
    [],
  );
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row) => row?.id && row?.new_user_id && row?.referrer_user_id);
}

function writeReferralEvents(
  rows: StoreReferralRewardEvent[],
  changedUserId?: string,
): void {
  const saved = storageWriteJson(STORE_REFERRAL_EVENTS_KEY, rows.slice(-10000));
  if (!saved) throw new Error('Falha ao persistir eventos de indicacao.');
  emitUpdated(changedUserId);
}

function hashText(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildCandidateReferralCode(userId: string, attempt: number): string {
  const cleaned = normalizeCode(userId);
  const prefix = cleaned.slice(0, 4).padEnd(4, 'X');
  const hashed = hashText(`${cleaned}:${attempt}`)
    .toString(36)
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, '0');
  return `${prefix}${hashed}`.slice(0, 8);
}

function generateUniqueReferralCode(
  userId: string,
  profiles: StoreReferralProfile[],
): string {
  const owned = profiles.find((row) => row.user_id === userId);
  if (owned) return owned.referral_code;

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = buildCandidateReferralCode(userId, attempt);
    const inUse = profiles.some((row) => row.referral_code === candidate);
    if (!inUse) return candidate;
  }
  return normalizeCode(`${userId}${Date.now()}`).slice(0, 8).padEnd(8, 'X');
}

function toScaledEffects(
  effects: StoreCatalogEffect[],
  quantity: number,
): StoreCatalogEffect[] {
  return effects.map((effect) => ({
    resource: effect.resource,
    units: Math.max(0, Math.round(effect.units * quantity)),
  }));
}

function normalizeResource(
  input: unknown,
): StoreQuotaResource {
  const raw = String(input ?? '').trim();
  if (raw === 'properties' || raw === 'talhoes' || raw === 'analises') return raw;
  throw new Error('Recurso de cota inválido.');
}

function resolveStoreRecurringUnitPrice(item: StoreCatalogItem): number {
  if (item.pricing_mode !== 'recurring_brl') {
    return parseNonNegativeInt(item.unit_price_cents, 0);
  }

  const explicit = parseNonNegativeInt(item.unit_price_cents, 0);
  if (explicit > 0) return explicit;

  const features = getBillingFeaturesWithCatalog();
  const byFeature = new Map(features.map((row) => [row.id, row]));
  if (item.linked_feature_id) {
    const linked = byFeature.get(item.linked_feature_id);
    if (linked) return Math.max(0, Math.round(linked.extra_unit_price_cents));
  }

  const fromEffects = item.effects.reduce((sum, effect) => {
    const feature = byFeature.get(effect.resource);
    if (!feature) return sum;
    return sum + Math.max(0, Math.round(feature.extra_unit_price_cents * effect.units));
  }, 0);
  return Math.max(0, fromEffects);
}

function normalizeStoreItem(item: StoreCatalogItem): StoreCatalogItem {
  const pricingMode: StorePricingMode =
    item.pricing_mode === 'recurring_brl' ? 'recurring_brl' : 'credits';
  const unitCredits = Math.max(0, Math.round(Number(item.unit_cost_credits) || 0));
  return {
    ...item,
    pricing_mode: pricingMode,
    min_quantity: parsePositiveInt(item.min_quantity, 1),
    max_quantity: parsePositiveInt(item.max_quantity, 1),
    unit_cost_credits: unitCredits,
    unit_price_cents: resolveStoreRecurringUnitPrice(item),
    linked_feature_id: item.linked_feature_id
      ? normalizeResource(item.linked_feature_id)
      : undefined,
    effects: Array.isArray(item.effects)
      ? item.effects
          .map((effect) => ({
            resource: normalizeResource(effect.resource),
            units: parsePositiveInt(effect.units, 1),
          }))
          .filter((effect) => effect.units > 0)
      : [],
  };
}

export function getAppStoreCatalog(): StoreCatalogItem[] {
  return STORE_CATALOG.map((item) => normalizeStoreItem(item));
}

export function findAppStoreItemById(itemId: string): StoreCatalogItem | null {
  const needle = String(itemId ?? '').trim();
  if (!needle) return null;
  const found = STORE_CATALOG.find((item) => item.id === needle);
  if (!found) return null;
  return normalizeStoreItem(found);
}

export function listStorePurchaseReceiptsForUser(userId: string): StorePurchaseReceipt[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];
  return readPurchases()
    .filter((row) => row.user_id === normalizedUserId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listStoreRecurringCommitmentsForUser(
  userId: string,
): StoreRecurringCommitment[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];
  return readRecurringCommitments()
    .filter((row) => row.user_id === normalizedUserId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getStoreRecurringOverviewForUser(userId: string): StoreRecurringOverview {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return { user_id: '', total_monthly_cents: 0, lines: [] };
  }
  const lines = listStoreRecurringCommitmentsForUser(normalizedUserId);
  const totalMonthly = lines.reduce(
    (sum, row) => sum + Math.max(0, row.total_price_cents),
    0,
  );
  return {
    user_id: normalizedUserId,
    total_monthly_cents: totalMonthly,
    lines,
  };
}

function findAppStoreCouponByCode(code: string): AppStoreCoupon | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const found = APP_STORE_COUPONS.find((row) => normalizeCode(row.code) === normalized);
  if (!found || !found.active) return null;
  return found;
}

export function validateAppStoreCoupon(input: {
  code: string;
  credits_subtotal: number;
  recurring_subtotal_cents: number;
}): AppStoreCouponValidation {
  const code = normalizeCode(input.code);
  const creditsSubtotal = Math.max(0, Math.round(Number(input.credits_subtotal) || 0));
  const recurringSubtotalCents = Math.max(
    0,
    Math.round(Number(input.recurring_subtotal_cents) || 0),
  );
  if (!code) {
    return {
      valid: false,
      code: '',
      message: 'Informe um cupom.',
      discount_credits: 0,
      discount_recurring_cents: 0,
    };
  }

  const coupon = findAppStoreCouponByCode(code);
  if (!coupon) {
    return {
      valid: false,
      code,
      message: 'Cupom não encontrado.',
      discount_credits: 0,
      discount_recurring_cents: 0,
    };
  }

  const discountCredits = (() => {
    if (coupon.scope !== 'credits' && coupon.scope !== 'all') return 0;
    if (creditsSubtotal <= 0) return 0;
    if (coupon.type === 'fixed_credits') {
      return Math.max(0, Math.min(creditsSubtotal, Math.round(coupon.value)));
    }
    return Math.max(
      0,
      Math.min(
        creditsSubtotal,
        Math.round(creditsSubtotal * (Math.max(0, coupon.value) / 100)),
      ),
    );
  })();

  if (discountCredits <= 0 && recurringSubtotalCents <= 0) {
    return {
      valid: false,
      code: coupon.code,
      message: 'Cupom sem efeito para o carrinho atual.',
      discount_credits: 0,
      discount_recurring_cents: 0,
    };
  }

  return {
    valid: discountCredits > 0,
    code: coupon.code,
    message: discountCredits > 0 ? 'Cupom aplicado com sucesso.' : 'Cupom sem desconto.',
    discount_credits: discountCredits,
    discount_recurring_cents: 0,
  };
}

export function listStoreQuotaLedgerForUser(
  userId: string,
): StoreQuotaLedgerEntry[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];
  return readQuotaLedger()
    .filter((row) => row.user_id === normalizedUserId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getStoreQuotaBonusByUser(
  userId: string,
): Record<StoreQuotaResource, number> {
  const normalizedUserId = normalizeUserId(userId);
  const totals: Record<StoreQuotaResource, number> = {
    properties: 0,
    talhoes: 0,
    analises: 0,
  };
  if (!normalizedUserId) return totals;

  const rows = readQuotaLedger().filter((row) => row.user_id === normalizedUserId);
  for (const row of rows) {
    totals[row.resource] += Math.max(0, Math.round(Number(row.units) || 0));
  }
  return totals;
}

export function ensureStoreReferralProfile(userId: string): StoreReferralProfile {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para perfil de indicacao.');
  }

  const rows = readReferralProfiles();
  const existing = rows.find((row) => row.user_id === normalizedUserId);
  if (existing) return existing;

  const now = nowIso();
  const created: StoreReferralProfile = {
    user_id: normalizedUserId,
    referral_code: generateUniqueReferralCode(normalizedUserId, rows),
    created_at: now,
    updated_at: now,
  };
  rows.push(created);
  writeReferralProfiles(rows, normalizedUserId);
  return created;
}

export function getStoreReferralSummary(userId: string): StoreReferralSummary {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para resumo de indicacao.');
  }

  const profile = ensureStoreReferralProfile(normalizedUserId);
  const profiles = readReferralProfiles();
  const events = readReferralEvents();
  return {
    profile,
    referred_users_count: profiles.filter(
      (row) => row.referred_by_user_id === normalizedUserId,
    ).length,
    rewarded_referrals_count: events.filter(
      (row) => row.referrer_user_id === normalizedUserId,
    ).length,
  };
}

export function attachUserToReferralCode(input: {
  user_id: string;
  referral_code: string;
}): StoreReferralProfile {
  const userId = normalizeUserId(input.user_id);
  const code = normalizeCode(input.referral_code);
  if (!userId) {
    throw new Error('Usuário inválido para vinculo de indicacao.');
  }
  if (!code) {
    throw new Error('Informe um código de indicacao valido.');
  }

  const rows = readReferralProfiles();
  const current = ensureStoreReferralProfile(userId);
  const currentIdx = rows.findIndex((row) => row.user_id === userId);
  if (currentIdx < 0) {
    rows.push(current);
  } else {
    rows[currentIdx] = current;
  }

  if (current.referral_code === code) {
    throw new Error('Não e permitido usar o proprio código de indicacao.');
  }

  if (current.referred_by_user_id) {
    const sameCode = normalizeCode(current.referred_by_code) === code;
    if (sameCode) return current;
    throw new Error('Esta conta ja possui um código de indicacao vinculado.');
  }

  const owner = rows.find((row) => normalizeCode(row.referral_code) === code);
  if (!owner) {
    throw new Error('Código de indicacao não encontrado.');
  }
  if (owner.user_id === userId) {
    throw new Error('Não e permitido usar o proprio código de indicacao.');
  }

  const now = nowIso();
  const next: StoreReferralProfile = {
    ...current,
    referred_by_code: owner.referral_code,
    referred_by_user_id: owner.user_id,
    updated_at: now,
  };

  const nextRows = rows.map((row) => (row.user_id === userId ? next : row));
  writeReferralProfiles(nextRows, userId);
  return next;
}

export function grantStoreQuotaBonus(input: {
  user_id: string;
  resource: StoreQuotaResource;
  units: number;
  source: StoreQuotaSource;
  description: string;
  created_by?: string;
  reference_id?: string;
}): StoreQuotaLedgerEntry {
  const userId = normalizeUserId(input.user_id);
  if (!userId) throw new Error('Usuário inválido para bonus de cota.');

  const units = parsePositiveInt(input.units, 0);
  if (units <= 0) throw new Error('Quantidade de cotas inválida.');

  const created: StoreQuotaLedgerEntry = {
    id: makeId('sql'),
    user_id: userId,
    resource: normalizeResource(input.resource),
    units,
    source: input.source,
    description: String(input.description ?? '').trim() || 'Bonus de cota',
    created_at: nowIso(),
    created_by: String(input.created_by ?? '').trim() || undefined,
    reference_id: String(input.reference_id ?? '').trim() || undefined,
  };

  const rows = readQuotaLedger();
  rows.push(created);
  writeQuotaLedger(rows, userId);
  return created;
}

async function maybeApplyReferralRewardForFirstPurchase(input: {
  user_id: string;
  purchase_receipt_id: string;
}): Promise<StoreReferralRewardEvent | null> {
  const userId = normalizeUserId(input.user_id);
  if (!userId) return null;

  const profiles = readReferralProfiles();
  const idx = profiles.findIndex((row) => row.user_id === userId);
  if (idx < 0) return null;

  const profile = profiles[idx];
  const referrerUserId = normalizeUserId(profile.referred_by_user_id);
  if (!referrerUserId) return null;
  if (profile.first_purchase_reward_at) return null;

  const events = readReferralEvents();
  const alreadyRewarded = events.some((row) => row.new_user_id === userId);
  if (alreadyRewarded) return null;

  const now = nowIso();
  const createdBy = 'referral_system';
  const referenceId = String(input.purchase_receipt_id ?? '').trim();

  const newUserCreditTx = grantCreditsToUser(
    userId,
    REFERRAL_REWARD_CREDITS,
    'Programa de indicacao: bonus na primeira compra.',
    createdBy,
    { type: 'referral_reward', reference_id: referenceId },
  );
  const referrerCreditTx = grantCreditsToUser(
    referrerUserId,
    REFERRAL_REWARD_CREDITS,
    'Programa de indicacao: bonus por primeira compra do indicado.',
    createdBy,
    { type: 'referral_reward', reference_id: referenceId },
  );

  grantStoreQuotaBonus({
    user_id: userId,
    resource: 'talhoes',
    units: REFERRAL_REWARD_TALHOES,
    source: 'referral_reward',
    description: 'Programa de indicacao: bonus de talhões.',
    created_by: createdBy,
    reference_id: referenceId,
  });
  grantStoreQuotaBonus({
    user_id: userId,
    resource: 'analises',
    units: REFERRAL_REWARD_ANALISES,
    source: 'referral_reward',
    description: 'Programa de indicacao: bonus de análises.',
    created_by: createdBy,
    reference_id: referenceId,
  });

  grantStoreQuotaBonus({
    user_id: referrerUserId,
    resource: 'talhoes',
    units: REFERRAL_REWARD_TALHOES,
    source: 'referral_reward',
    description: 'Programa de indicacao: bonus de talhões.',
    created_by: createdBy,
    reference_id: referenceId,
  });
  grantStoreQuotaBonus({
    user_id: referrerUserId,
    resource: 'analises',
    units: REFERRAL_REWARD_ANALISES,
    source: 'referral_reward',
    description: 'Programa de indicacao: bonus de análises.',
    created_by: createdBy,
    reference_id: referenceId,
  });

  const event: StoreReferralRewardEvent = {
    id: makeId('sre'),
    new_user_id: userId,
    referrer_user_id: referrerUserId,
    purchase_receipt_id: referenceId,
    reward_credits_each: REFERRAL_REWARD_CREDITS,
    reward_talhoes_each: REFERRAL_REWARD_TALHOES,
    reward_analises_each: REFERRAL_REWARD_ANALISES,
    created_at: now,
  };

  events.push(event);
  writeReferralEvents(events, userId);

  const nextProfile: StoreReferralProfile = {
    ...profile,
    first_purchase_reward_at: now,
    updated_at: now,
  };
  const nextProfiles = profiles.map((row, rowIdx) =>
    rowIdx === idx ? nextProfile : row,
  );
  writeReferralProfiles(nextProfiles, userId);

  void createNotification(userId, {
    title: 'Recompensa de indicacao liberada',
    message:
      `Voce recebeu ${REFERRAL_REWARD_CREDITS} creditos, ` +
      `+${REFERRAL_REWARD_TALHOES} talhao e +${REFERRAL_REWARD_ANALISES} analises.`,
    level: 'success',
  });
  void createNotification(referrerUserId, {
    title: 'Indicacao concluida com sucesso',
    message:
      `Seu indicado fez a primeira compra. Bonus: ${REFERRAL_REWARD_CREDITS} creditos, ` +
      `+${REFERRAL_REWARD_TALHOES} talhao e +${REFERRAL_REWARD_ANALISES} analises.`,
    level: 'success',
  });

  // Ensure references are used for static analysis and audit readability.
  void newUserCreditTx;
  void referrerCreditTx;
  return event;
}

export function listStoreReferralRewardEventsForUser(
  userId: string,
): StoreReferralRewardEvent[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];
  return readReferralEvents()
    .filter(
      (row) =>
        row.new_user_id === normalizedUserId ||
        row.referrer_user_id === normalizedUserId,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function upsertRecurringCommitment(input: {
  user_id: string;
  item: StoreCatalogItem;
  quantity: number;
  effects: StoreCatalogEffect[];
}): StoreRecurringCommitment {
  const userId = normalizeUserId(input.user_id);
  if (!userId) {
    throw new Error('Usuário inválido para add-on recorrente.');
  }

  const rows = readRecurringCommitments();
  const unitPrice = resolveStoreRecurringUnitPrice(input.item);
  const now = nowIso();
  const idx = rows.findIndex(
    (row) => row.user_id === userId && row.item_id === input.item.id,
  );

  if (idx >= 0) {
    const current = rows[idx];
    const nextQuantity = Math.max(1, current.quantity + input.quantity);
    const next: StoreRecurringCommitment = {
      ...current,
      quantity: nextQuantity,
      unit_price_cents: unitPrice,
      total_price_cents: nextQuantity * unitPrice,
      effects: input.effects,
      updated_at: now,
    };
    rows[idx] = next;
    writeRecurringCommitments(rows, userId);
    return next;
  }

  const created: StoreRecurringCommitment = {
    id: makeId('src'),
    user_id: userId,
    item_id: input.item.id,
    item_label: input.item.label,
    quantity: Math.max(1, input.quantity),
    unit_price_cents: unitPrice,
    total_price_cents: Math.max(1, input.quantity) * unitPrice,
    effects: input.effects,
    created_at: now,
    updated_at: now,
  };

  rows.push(created);
  writeRecurringCommitments(rows, userId);
  return created;
}

export async function purchaseAppStoreItem(input: {
  user_id: string;
  item_id: string;
  quantity?: number;
  created_by?: string;
  coupon_code?: string;
  discount_credits?: number;
}): Promise<{
  receipt: StorePurchaseReceipt;
  credit_transaction: CreditTransaction | null;
  quota_entries: StoreQuotaLedgerEntry[];
  recurring_commitment: StoreRecurringCommitment | null;
  referral_event: StoreReferralRewardEvent | null;
}> {
  const userId = normalizeUserId(input.user_id);
  if (!userId) throw new Error('Usuário inválido para compra na loja.');

  const item = findAppStoreItemById(input.item_id);
  if (!item) throw new Error('Item da loja não encontrado.');
  if (item.status !== 'active') {
    throw new Error('Este item ainda não esta disponivel para compra.');
  }

  const min = Math.max(1, item.min_quantity);
  const max = Math.max(min, item.max_quantity);
  const requestedQuantity = parsePositiveInt(input.quantity, min);
  const quantity = Math.max(min, Math.min(max, requestedQuantity));
  const scaledEffects = toScaledEffects(item.effects, quantity);

  const unitCredits = item.pricing_mode === 'credits' ? item.unit_cost_credits : 0;
  const totalCredits = unitCredits * quantity;
  const unitCents =
    item.pricing_mode === 'recurring_brl' ? resolveStoreRecurringUnitPrice(item) : 0;
  const totalCents = unitCents * quantity;
  const discountCreditsRequested = parseNonNegativeInt(input.discount_credits, 0);
  const discountCreditsApplied =
    item.pricing_mode === 'credits'
      ? Math.min(totalCredits, discountCreditsRequested)
      : 0;
  const finalCreditsCost = Math.max(0, totalCredits - discountCreditsApplied);

  if (item.pricing_mode === 'credits' && totalCredits <= 0) {
    throw new Error('Item inválido para compra por créditos.');
  }
  if (item.pricing_mode === 'recurring_brl' && totalCents <= 0) {
    throw new Error('Item inválido para compra recorrente.');
  }

  const description =
    item.pricing_mode === 'recurring_brl'
      ? `Loja recorrente: ${item.label} x${quantity}`
      : `Loja avulsa: ${item.label} x${quantity}`;

  let creditTx: CreditTransaction | null = null;
  if (item.pricing_mode === 'credits' && finalCreditsCost > 0) {
    creditTx = removeCreditsFromUser(
      userId,
      finalCreditsCost,
      description,
      input.created_by ?? userId,
      'store_purchase',
    );
  }

  const quotaEntries: StoreQuotaLedgerEntry[] = [];
  for (const effect of scaledEffects) {
    if (effect.units <= 0) continue;
    quotaEntries.push(
      grantStoreQuotaBonus({
        user_id: userId,
        resource: effect.resource,
        units: effect.units,
        source: 'purchase',
        description,
        created_by: input.created_by ?? userId,
      }),
    );
  }

  let recurringCommitment: StoreRecurringCommitment | null = null;
  if (item.pricing_mode === 'recurring_brl') {
    recurringCommitment = upsertRecurringCommitment({
      user_id: userId,
      item,
      quantity,
      effects: scaledEffects,
    });
  }

  const now = nowIso();
  const receipt: StorePurchaseReceipt = {
    id: makeId('spr'),
    receipt_number: makeReceiptNumber(),
    user_id: userId,
    item_id: item.id,
    item_label: item.label,
    item_category: item.category,
    pricing_mode: item.pricing_mode,
    quantity,
    unit_cost_credits: unitCredits,
    total_cost_credits: finalCreditsCost,
    unit_price_cents: unitCents,
    total_price_cents: totalCents,
    coupon_code: normalizeCode(input.coupon_code),
    discount_credits_applied: discountCreditsApplied,
    effects: scaledEffects,
    credit_transaction_id: creditTx?.id,
    created_at: now,
  };
  const purchases = readPurchases();
  purchases.push(receipt);
  writePurchases(purchases, userId);

  if (item.pricing_mode === 'credits') {
    try {
      createInAppPurchaseReceipt({
        user_id: userId,
        purchase_type:
          item.category === 'service'
            ? 'store_service'
            : scaledEffects.length > 1
              ? 'store_bundle'
              : 'store_quota',
        item_id: item.id,
        item_label: item.label,
        quantity,
        unit_cost_credits: unitCredits,
        total_cost_credits: finalCreditsCost,
        credit_transaction_id: creditTx?.id,
      });
    } catch {
      // Non-blocking: purchase and quota were already persisted.
    }
  }

  let referralEvent: StoreReferralRewardEvent | null = null;
  try {
    referralEvent = await maybeApplyReferralRewardForFirstPurchase({
      user_id: userId,
      purchase_receipt_id: receipt.id,
    });
  } catch {
    referralEvent = null;
  }

  void createNotification(userId, {
    title: 'Compra na loja concluida',
    message:
      item.pricing_mode === 'recurring_brl'
        ? `${item.label} x${quantity} adicionado como recorrencia da proxima fatura.`
        : `${item.label} x${quantity} comprado com sucesso.`,
    level: 'success',
  });

  return {
    receipt,
    credit_transaction: creditTx,
    quota_entries: quotaEntries,
    recurring_commitment: recurringCommitment,
    referral_event: referralEvent,
  };
}

export async function getUserStoreQuotaOverview(
  userId: string,
  legacyPlanId?: string,
): Promise<StoreQuotaOverview> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para leitura de cotas.');
  }

  const subscription = getBillingSubscriptionForUser(normalizedUserId, legacyPlanId);
  const features = getBillingFeaturesWithCatalog();
  const bonus = getStoreQuotaBonusByUser(normalizedUserId);
  const usage = await getBillingUsageForUser(normalizedUserId);

  const baseLimits: Record<StoreQuotaResource, number> = {
    properties: 0,
    talhoes: 0,
    analises: 0,
  };

  for (const feature of features) {
    if (
      feature.id !== 'properties' &&
      feature.id !== 'talhoes' &&
      feature.id !== 'analises'
    ) {
      continue;
    }
    baseLimits[feature.id] = Math.max(
      0,
      Math.round(Number(feature.included_by_plan[subscription.plan_id]) || 0),
    );
  }

  const rows: Record<StoreQuotaResource, StoreQuotaOverviewItem> = {
    properties: {
      resource: 'properties',
      base_limit: baseLimits.properties,
      bonus_limit: bonus.properties,
      total_limit: baseLimits.properties + bonus.properties,
      used: Math.max(0, Math.round(Number(usage.properties) || 0)),
      remaining: 0,
    },
    talhoes: {
      resource: 'talhoes',
      base_limit: baseLimits.talhoes,
      bonus_limit: bonus.talhoes,
      total_limit: baseLimits.talhoes + bonus.talhoes,
      used: Math.max(0, Math.round(Number(usage.talhoes) || 0)),
      remaining: 0,
    },
    analises: {
      resource: 'analises',
      base_limit: baseLimits.analises,
      bonus_limit: bonus.analises,
      total_limit: baseLimits.analises + bonus.analises,
      used: Math.max(0, Math.round(Number(usage.analises) || 0)),
      remaining: 0,
    },
  };

  rows.properties.remaining = Math.max(0, rows.properties.total_limit - rows.properties.used);
  rows.talhoes.remaining = Math.max(0, rows.talhoes.total_limit - rows.talhoes.used);
  rows.analises.remaining = Math.max(0, rows.analises.total_limit - rows.analises.used);

  return {
    user_id: normalizedUserId,
    plan_id: subscription.plan_id,
    generated_at: nowIso(),
    rows,
  };
}

export async function assertStoreQuotaAvailable(input: {
  user_id: string;
  resource: StoreQuotaResource;
  required_units?: number;
  legacy_plan_id?: string;
}): Promise<void> {
  const userId = normalizeUserId(input.user_id);
  if (!userId) throw new Error('Usuário inválido para validacao de limite.');

  const resource = normalizeResource(input.resource);
  const requiredUnits = Math.max(1, parsePositiveInt(input.required_units, 1));
  const overview = await getUserStoreQuotaOverview(userId, input.legacy_plan_id);
  const row = overview.rows[resource];
  if (row.remaining >= requiredUnits) return;

  throw new Error(
    `Limite de ${STORE_RESOURCE_LABEL[resource]} atingido (${row.used}/${row.total_limit}). ` +
      'Compre cotas na Loja do App para continuar.',
  );
}
