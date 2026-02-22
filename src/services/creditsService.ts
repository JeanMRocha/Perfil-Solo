import {
  getInitialCreditsAfterSignup,
  listRegisteredUsers,
  registerOrUpdateUserAccount,
} from './usersRegistryService';
import {
  createNotification,
  type AppNotificationLevel,
} from './notificationsService';
import { convertMoneyCentsToCredits } from '../modules/billing';
import { storageGetRaw, storageWriteJson } from './safeLocalStorage';

export type CreditTransactionType =
  | 'initial_grant'
  | 'admin_grant'
  | 'admin_remove'
  | 'icon_purchase'
  | 'store_purchase'
  | 'referral_reward'
  | 'refund'
  | 'purchase_approved'
  | 'ad_reward'
  | 'engagement_reward'
  | 'money_conversion'
  | 'billing_refund_adjustment';

export interface CreditWallet {
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: CreditTransactionType;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  created_by?: string;
  reference_id?: string;
}

export interface CreditPurchaseRequest {
  id: string;
  user_id: string;
  package_id: string;
  package_label?: string;
  credits_requested: number;
  price_cents?: number;
  coupon_code?: string;
  discount_cents?: number;
  final_price_cents?: number;
  auth_email: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  review_note?: string;
}

export interface CreditPackage {
  id: string;
  label: string;
  credits: number;
  price_cents: number;
  price_label: string;
}

export type CreditCouponType = 'percent' | 'fixed';

export interface CreditCoupon {
  id: string;
  code: string;
  type: CreditCouponType;
  value: number;
  active: boolean;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreditCouponValidation {
  valid: boolean;
  message: string;
  coupon?: CreditCoupon;
  original_price_cents: number;
  discount_cents: number;
  final_price_cents: number;
}

export interface CreditCouponRedemption {
  id: string;
  coupon_id: string;
  coupon_code: string;
  user_id: string;
  package_id: string;
  request_id: string;
  original_price_cents: number;
  discount_cents: number;
  final_price_cents: number;
  created_at: string;
}

export interface CreditAdRewardConfig {
  enabled: boolean;
  credits_per_view: number;
  daily_limit_per_user: number;
  cooldown_minutes: number;
}

export interface CreditAdRewardClaim {
  id: string;
  user_id: string;
  credits_awarded: number;
  created_at: string;
}

export interface CreditAdRewardAvailability {
  allowed: boolean;
  reason: string;
  remaining_today: number;
  next_available_at?: string;
  config: CreditAdRewardConfig;
}

export type CreditEngagementRuleId =
  | 'signup'
  | 'email_confirmation'
  | 'profile_address'
  | 'property_created'
  | 'talhao_created';

export interface CreditEngagementRule {
  id: CreditEngagementRuleId;
  label: string;
  description: string;
  credits: number;
  max_claims_per_user: number | null;
  enabled: boolean;
}

export interface CreditEngagementRewardClaim {
  id: string;
  user_id: string;
  rule_id: CreditEngagementRuleId;
  credits_awarded: number;
  created_at: string;
  created_by?: string;
  reference_id?: string;
}

export interface CreditEngagementRewardResult {
  awarded: boolean;
  reason: string;
  rule: CreditEngagementRule;
  claim?: CreditEngagementRewardClaim;
  transaction?: CreditTransaction;
  remaining_claims: number | null;
}

export interface CreditEngagementRuleUserPerformance {
  rule_id: CreditEngagementRuleId;
  count: number;
  credits: number;
  max_claims_per_user: number | null;
  remaining_claims: number | null;
}

export interface CreditEngagementUserPerformance {
  user_id: string;
  user_name: string;
  user_email: string;
  total_claims: number;
  total_credits: number;
  by_rule: Record<CreditEngagementRuleId, CreditEngagementRuleUserPerformance>;
}

const WALLETS_KEY = 'perfilsolo_credit_wallets_v1';
const TRANSACTIONS_KEY = 'perfilsolo_credit_transactions_v1';
const INITIAL_GRANTED_SET_KEY = 'perfilsolo_credit_initial_granted_v1';
const PURCHASE_REQUESTS_KEY = 'perfilsolo_credit_purchase_requests_v1';
const COUPONS_KEY = 'perfilsolo_credit_coupons_v1';
const COUPON_REDEMPTIONS_KEY = 'perfilsolo_credit_coupon_redemptions_v1';
const AD_REWARD_CONFIG_KEY = 'perfilsolo_credit_ad_reward_config_v1';
const AD_REWARD_CLAIMS_KEY = 'perfilsolo_credit_ad_reward_claims_v1';
const ENGAGEMENT_RULES_KEY = 'perfilsolo_credit_engagement_rules_v1';
const ENGAGEMENT_CLAIMS_KEY = 'perfilsolo_credit_engagement_claims_v1';

export const CREDITS_UPDATED_EVENT = 'perfilsolo-credits-updated';

const DEFAULT_AD_REWARD_CONFIG: CreditAdRewardConfig = {
  enabled: true,
  credits_per_view: 5,
  daily_limit_per_user: 3,
  cooldown_minutes: 10,
};

const ENGAGEMENT_RULE_ORDER: CreditEngagementRuleId[] = [
  'signup',
  'email_confirmation',
  'profile_address',
  'property_created',
  'talhao_created',
];

const DEFAULT_ENGAGEMENT_RULES: Record<CreditEngagementRuleId, CreditEngagementRule> = {
  signup: {
    id: 'signup',
    label: 'Cadastro da conta',
    description: 'Primeiro cadastro validado do usuário.',
    credits: 10,
    max_claims_per_user: 1,
    enabled: true,
  },
  email_confirmation: {
    id: 'email_confirmation',
    label: 'Confirmacao de email',
    description: 'Primeira confirmacao de identidade/email.',
    credits: 20,
    max_claims_per_user: 1,
    enabled: true,
  },
  profile_address: {
    id: 'profile_address',
    label: 'Endereço preenchido',
    description: 'Perfil com endereço principal completo.',
    credits: 10,
    max_claims_per_user: 1,
    enabled: true,
  },
  property_created: {
    id: 'property_created',
    label: 'Propriedade cadastrada',
    description: 'Recompensa por cada propriedade criada.',
    credits: 10,
    max_claims_per_user: 5,
    enabled: true,
  },
  talhao_created: {
    id: 'talhao_created',
    label: 'Talhão cadastrado',
    description: 'Recompensa por cada talhão criado.',
    credits: 2,
    max_claims_per_user: 100,
    enabled: true,
  },
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'pack_40',
    label: 'Pacote 40',
    credits: convertMoneyCentsToCredits(2000),
    price_cents: 2000,
    price_label: 'R$ 20,00',
  },
  {
    id: 'pack_100',
    label: 'Pacote 100',
    credits: convertMoneyCentsToCredits(5000),
    price_cents: 5000,
    price_label: 'R$ 50,00',
  },
  {
    id: 'pack_240',
    label: 'Pacote 240',
    credits: convertMoneyCentsToCredits(12000),
    price_cents: 12000,
    price_label: 'R$ 120,00',
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUserId(userId: string): string {
  return String(userId ?? '').trim();
}

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

function normalizeCouponCode(value: string): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return fallback;
}

function parseNumber(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function normalizePriceCents(input: unknown): number {
  const parsed = Math.round(parseNumber(input));
  return Math.max(0, parsed);
}

function parseIsoOrNull(input: unknown): string | null {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function dayKeyLocal(dateLike: string): string {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dispatchCreditsUpdated(userId?: string): void {
  window.dispatchEvent(
    new CustomEvent(CREDITS_UPDATED_EVENT, {
      detail: { userId: userId ?? '' },
    }),
  );
}

function persistJsonOrThrow<T>(key: string, value: T): void {
  const saved = storageWriteJson(key, value);
  if (!saved) {
    throw new Error('Falha ao persistir dados locais de créditos.');
  }
}
function readWallets(): CreditWallet[] {
  try {
    const raw = storageGetRaw(WALLETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditWallet[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row?.user_id)
      .map((row) => ({
        user_id: normalizeUserId(row.user_id),
        balance: Math.max(0, Math.round(parseNumber(row.balance))),
        updated_at: String(row.updated_at ?? nowIso()),
      }));
  } catch {
    return [];
  }
}

function readTransactions(): CreditTransaction[] {
  try {
    const raw = storageGetRaw(TRANSACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditTransaction[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row) => row?.id && row?.user_id)
      .map((row) => ({
        id: String(row.id),
        user_id: normalizeUserId(row.user_id),
        type: row.type,
        amount: Math.round(parseNumber(row.amount)),
        balance_after: Math.max(0, Math.round(parseNumber(row.balance_after))),
        description: String(row.description ?? row.type ?? 'Movimentacao'),
        created_at: String(row.created_at ?? nowIso()),
        created_by: row.created_by ? String(row.created_by) : undefined,
        reference_id: row.reference_id ? String(row.reference_id) : undefined,
      }));
  } catch {
    return [];
  }
}

function readInitialGrantedSet(): string[] {
  try {
    const raw = storageGetRaw(INITIAL_GRANTED_SET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((row) => normalizeUserId(row)).filter(Boolean))];
  } catch {
    return [];
  }
}

function readPurchaseRequests(): CreditPurchaseRequest[] {
  try {
    const raw = storageGetRaw(PURCHASE_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditPurchaseRequest[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row) => row?.id && row?.user_id)
      .map((row) => ({
        id: String(row.id),
        user_id: normalizeUserId(row.user_id),
        package_id: String(row.package_id ?? ''),
        package_label: row.package_label ? String(row.package_label) : undefined,
        credits_requested: Math.max(1, Math.round(parseNumber(row.credits_requested))),
        price_cents:
          row.price_cents == null ? undefined : normalizePriceCents(row.price_cents),
        coupon_code: row.coupon_code ? normalizeCouponCode(row.coupon_code) : undefined,
        discount_cents:
          row.discount_cents == null
            ? undefined
            : normalizePriceCents(row.discount_cents),
        final_price_cents:
          row.final_price_cents == null
            ? undefined
            : normalizePriceCents(row.final_price_cents),
        auth_email: normalizeEmail(row.auth_email),
        status:
          row.status === 'approved' || row.status === 'denied'
            ? row.status
            : 'pending',
        created_at: String(row.created_at ?? nowIso()),
        updated_at: String(row.updated_at ?? row.created_at ?? nowIso()),
        reviewed_by: row.reviewed_by ? String(row.reviewed_by) : undefined,
        review_note: row.review_note ? String(row.review_note) : undefined,
      }));
  } catch {
    return [];
  }
}

function readCoupons(): CreditCoupon[] {
  try {
    const raw = storageGetRaw(COUPONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditCoupon[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row) => row?.id && row?.code)
      .map((row) => ({
        id: String(row.id),
        code: normalizeCouponCode(row.code),
        type: row.type === 'fixed' ? 'fixed' : 'percent',
        value: Math.max(0, parseNumber(row.value)),
        active: normalizeBoolean(row.active, true),
        max_redemptions:
          row.max_redemptions == null || parseNumber(row.max_redemptions) <= 0
            ? null
            : Math.round(parseNumber(row.max_redemptions)),
        redeemed_count: Math.max(0, Math.round(parseNumber(row.redeemed_count))),
        expires_at: parseIsoOrNull(row.expires_at),
        notes: row.notes ? String(row.notes) : undefined,
        created_at: String(row.created_at ?? nowIso()),
        updated_at: String(row.updated_at ?? row.created_at ?? nowIso()),
        created_by: row.created_by ? String(row.created_by) : undefined,
      }));
  } catch {
    return [];
  }
}

function readCouponRedemptions(): CreditCouponRedemption[] {
  try {
    const raw = storageGetRaw(COUPON_REDEMPTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditCouponRedemption[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row) => row?.id && row?.coupon_id)
      .map((row) => ({
        id: String(row.id),
        coupon_id: String(row.coupon_id),
        coupon_code: normalizeCouponCode(row.coupon_code),
        user_id: normalizeUserId(row.user_id),
        package_id: String(row.package_id),
        request_id: String(row.request_id),
        original_price_cents: normalizePriceCents(row.original_price_cents),
        discount_cents: normalizePriceCents(row.discount_cents),
        final_price_cents: normalizePriceCents(row.final_price_cents),
        created_at: String(row.created_at ?? nowIso()),
      }));
  } catch {
    return [];
  }
}

function readAdRewardConfig(): CreditAdRewardConfig {
  try {
    const raw = storageGetRaw(AD_REWARD_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_AD_REWARD_CONFIG };
    const parsed = JSON.parse(raw) as Partial<CreditAdRewardConfig>;
    return {
      enabled: normalizeBoolean(parsed.enabled, DEFAULT_AD_REWARD_CONFIG.enabled),
      credits_per_view: Math.max(
        1,
        Math.round(
          parseNumber(parsed.credits_per_view || DEFAULT_AD_REWARD_CONFIG.credits_per_view),
        ),
      ),
      daily_limit_per_user: Math.max(
        1,
        Math.round(
          parseNumber(
            parsed.daily_limit_per_user || DEFAULT_AD_REWARD_CONFIG.daily_limit_per_user,
          ),
        ),
      ),
      cooldown_minutes: Math.max(
        0,
        Math.round(
          parseNumber(parsed.cooldown_minutes || DEFAULT_AD_REWARD_CONFIG.cooldown_minutes),
        ),
      ),
    };
  } catch {
    return { ...DEFAULT_AD_REWARD_CONFIG };
  }
}

function readAdRewardClaims(): CreditAdRewardClaim[] {
  try {
    const raw = storageGetRaw(AD_REWARD_CLAIMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditAdRewardClaim[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row) => row?.id && row?.user_id)
      .map((row) => ({
        id: String(row.id),
        user_id: normalizeUserId(row.user_id),
        credits_awarded: Math.max(0, Math.round(parseNumber(row.credits_awarded))),
        created_at: String(row.created_at ?? nowIso()),
      }));
  } catch {
    return [];
  }
}

function normalizeEngagementRuleId(input: unknown): CreditEngagementRuleId | null {
  const raw = String(input ?? '').trim();
  if (
    raw !== 'signup' &&
    raw !== 'email_confirmation' &&
    raw !== 'profile_address' &&
    raw !== 'property_created' &&
    raw !== 'talhao_created'
  ) {
    return null;
  }
  return raw;
}

function normalizeEngagementRule(
  input: Partial<CreditEngagementRule> | undefined,
  fallback: CreditEngagementRule,
): CreditEngagementRule {
  return {
    id: fallback.id,
    label: String(input?.label ?? fallback.label).trim() || fallback.label,
    description:
      String(input?.description ?? fallback.description).trim() ||
      fallback.description,
    credits: Math.max(0, Math.round(parseNumber(input?.credits ?? fallback.credits))),
    max_claims_per_user:
      input?.max_claims_per_user == null
        ? fallback.max_claims_per_user
        : Math.max(0, Math.round(parseNumber(input.max_claims_per_user))) || null,
    enabled: normalizeBoolean(input?.enabled, fallback.enabled),
  };
}

function readEngagementRules(): Record<CreditEngagementRuleId, CreditEngagementRule> {
  try {
    const raw = storageGetRaw(ENGAGEMENT_RULES_KEY);
    if (!raw) return { ...DEFAULT_ENGAGEMENT_RULES };
    const parsed = JSON.parse(raw) as Partial<
      Record<CreditEngagementRuleId, Partial<CreditEngagementRule>>
    >;
    const next = { ...DEFAULT_ENGAGEMENT_RULES };
    ENGAGEMENT_RULE_ORDER.forEach((ruleId) => {
      next[ruleId] = normalizeEngagementRule(parsed?.[ruleId], next[ruleId]);
    });
    return next;
  } catch {
    return { ...DEFAULT_ENGAGEMENT_RULES };
  }
}

function readEngagementClaims(): CreditEngagementRewardClaim[] {
  try {
    const raw = storageGetRaw(ENGAGEMENT_CLAIMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CreditEngagementRewardClaim>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const ruleId = normalizeEngagementRuleId(row.rule_id);
        if (!ruleId) return null;
        const userId = normalizeUserId(String(row.user_id ?? ''));
        if (!userId) return null;
        return {
          id: String(row.id ?? makeId('ceg')),
          user_id: userId,
          rule_id: ruleId,
          credits_awarded: Math.max(0, Math.round(parseNumber(row.credits_awarded))),
          created_at: String(row.created_at ?? nowIso()),
          created_by: row.created_by ? String(row.created_by) : undefined,
          reference_id: row.reference_id ? String(row.reference_id) : undefined,
        } as CreditEngagementRewardClaim;
      })
      .filter((row): row is CreditEngagementRewardClaim => Boolean(row));
  } catch {
    return [];
  }
}

function writeWallets(rows: CreditWallet[], changedUserId?: string): void {
  persistJsonOrThrow(WALLETS_KEY, rows);
  dispatchCreditsUpdated(changedUserId);
}

function writeInitialGrantedSet(rows: string[], changedUserId?: string): void {
  persistJsonOrThrow(INITIAL_GRANTED_SET_KEY, rows);
  dispatchCreditsUpdated(changedUserId);
}

function writePurchaseRequests(rows: CreditPurchaseRequest[], changedUserId?: string): void {
  persistJsonOrThrow(PURCHASE_REQUESTS_KEY, rows);
  dispatchCreditsUpdated(changedUserId);
}

function writeCoupons(rows: CreditCoupon[]): void {
  persistJsonOrThrow(COUPONS_KEY, rows);
  dispatchCreditsUpdated('');
}

function writeCouponRedemptions(rows: CreditCouponRedemption[]): void {
  persistJsonOrThrow(COUPON_REDEMPTIONS_KEY, rows);
  dispatchCreditsUpdated('');
}

function writeAdRewardConfig(config: CreditAdRewardConfig): void {
  persistJsonOrThrow(AD_REWARD_CONFIG_KEY, config);
  dispatchCreditsUpdated('');
}

function writeAdRewardClaims(rows: CreditAdRewardClaim[], changedUserId?: string): void {
  persistJsonOrThrow(AD_REWARD_CLAIMS_KEY, rows);
  dispatchCreditsUpdated(changedUserId);
}

function writeEngagementRules(
  rules: Record<CreditEngagementRuleId, CreditEngagementRule>,
): void {
  persistJsonOrThrow(ENGAGEMENT_RULES_KEY, rules);
  dispatchCreditsUpdated('');
}

function writeEngagementClaims(
  rows: CreditEngagementRewardClaim[],
  changedUserId?: string,
): void {
  persistJsonOrThrow(ENGAGEMENT_CLAIMS_KEY, rows);
  dispatchCreditsUpdated(changedUserId);
}

function findWalletIndex(rows: CreditWallet[], userId: string): number {
  return rows.findIndex((row) => row.user_id === userId);
}

function ensureWallet(userId: string): CreditWallet {
  const normalized = normalizeUserId(userId);
  if (!normalized) throw new Error('Usuário inválido.');

  const wallets = readWallets();
  const idx = findWalletIndex(wallets, normalized);
  if (idx >= 0) return wallets[idx];

  const created: CreditWallet = {
    user_id: normalized,
    balance: 0,
    updated_at: nowIso(),
  };
  wallets.push(created);
  writeWallets(wallets, normalized);
  return created;
}

function applyDelta(
  userId: string,
  delta: number,
  type: CreditTransactionType,
  description: string,
  options?: { created_by?: string; reference_id?: string },
): CreditTransaction {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Usuário inválido.');

  const amount = Math.round(parseNumber(delta));
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('Delta de crédito inválido.');
  }

  const wallets = readWallets();
  const idx = findWalletIndex(wallets, normalizedUserId);
  const current =
    idx >= 0
      ? wallets[idx]
      : {
          user_id: normalizedUserId,
          balance: 0,
          updated_at: nowIso(),
        };

  const nextBalance = current.balance + amount;
  if (nextBalance < 0) {
    throw new Error('Créditos insuficientes.');
  }

  const nextWallet: CreditWallet = {
    ...current,
    balance: nextBalance,
    updated_at: nowIso(),
  };
  if (idx >= 0) {
    wallets[idx] = nextWallet;
  } else {
    wallets.push(nextWallet);
  }

  const tx: CreditTransaction = {
    id: makeId('ctx'),
    user_id: normalizedUserId,
    type,
    amount,
    balance_after: nextBalance,
    description: String(description ?? '').trim() || type,
    created_at: nowIso(),
    created_by: options?.created_by,
    reference_id: options?.reference_id,
  };

  const transactions = readTransactions();
  transactions.push(tx);

  persistJsonOrThrow(WALLETS_KEY, wallets);
  persistJsonOrThrow(TRANSACTIONS_KEY, transactions.slice(-5000));
  dispatchCreditsUpdated(normalizedUserId);
  emitCreditTransactionNotification(tx);
  return tx;
}

function creditUnitLabel(value: number): string {
  return Math.abs(value) === 1 ? 'credito' : 'creditos';
}

function buildCreditNotificationPayload(
  tx: CreditTransaction,
): { title: string; message: string; level: AppNotificationLevel } | null {
  if (tx.type === 'admin_grant') {
    return {
      title: 'Créditos adicionados',
      message: `Voce recebeu ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )}. Saldo atual: ${tx.balance_after}. Motivo: ${tx.description}.`,
      level: 'success',
    };
  }

  if (tx.type === 'admin_remove') {
    return {
      title: 'Créditos removidos',
      message: `Foram removidos ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )}. Saldo atual: ${tx.balance_after}. Motivo: ${tx.description}.`,
      level: 'warning',
    };
  }

  if (tx.type === 'refund') {
    return {
      title: 'Ressarcimento de créditos',
      message: `Voce recebeu ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )} de ressarcimento. Saldo atual: ${tx.balance_after}.`,
      level: 'success',
    };
  }

  if (tx.type === 'purchase_approved') {
    return {
      title: 'Compra de créditos aprovada',
      message: `Compra aprovada com ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )} adicionados. Saldo atual: ${tx.balance_after}.`,
      level: 'success',
    };
  }

  if (tx.type === 'engagement_reward') {
    return {
      title: 'Recompensa de progresso',
      message: `Voce recebeu ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )}. Saldo atual: ${tx.balance_after}. ${tx.description}.`,
      level: 'success',
    };
  }

  if (tx.type === 'referral_reward') {
    return {
      title: 'Bonus de indicacao',
      message: `Voce recebeu ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )}. Saldo atual: ${tx.balance_after}.`,
      level: 'success',
    };
  }

  if (tx.type === 'store_purchase') {
    return {
      title: 'Compra na loja interna',
      message: `Foram consumidos ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )}. Saldo atual: ${tx.balance_after}.`,
      level: 'info',
    };
  }

  if (tx.type === 'money_conversion') {
    return {
      title: 'Créditos comprados',
      message: `Conversao financeira concluida com ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )}. Saldo atual: ${tx.balance_after}.`,
      level: 'success',
    };
  }

  if (tx.type === 'billing_refund_adjustment') {
    return {
      title: 'Ajuste por estorno',
      message: `Foram removidos ${Math.abs(tx.amount)} ${creditUnitLabel(
        tx.amount,
      )} devido a estorno financeiro. Saldo atual: ${tx.balance_after}.`,
      level: 'warning',
    };
  }

  return null;
}

function emitCreditTransactionNotification(tx: CreditTransaction): void {
  const payload = buildCreditNotificationPayload(tx);
  if (!payload) return;

  void createNotification(tx.user_id, {
    title: payload.title,
    message: payload.message,
    level: payload.level,
  }).catch(() => undefined);
}

function parseCouponDiscount(coupon: CreditCoupon, originalPriceCents: number): number {
  if (originalPriceCents <= 0) return 0;
  if (coupon.type === 'fixed') {
    return Math.min(originalPriceCents, normalizePriceCents(coupon.value * 100));
  }

  const percent = Math.max(0, Math.min(100, parseNumber(coupon.value)));
  const discount = Math.round((originalPriceCents * percent) / 100);
  return Math.min(originalPriceCents, Math.max(0, discount));
}

function findCouponByCode(code: string): CreditCoupon | null {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return null;
  return readCoupons().find((row) => row.code === normalizedCode) ?? null;
}

function getPackagePriceById(packageId: string): number {
  const pkg = findCreditPackageById(packageId);
  return pkg ? pkg.price_cents : 0;
}

function increaseCouponRedemptionCount(couponId: string): CreditCoupon {
  const rows = readCoupons();
  const idx = rows.findIndex((row) => row.id === couponId);
  if (idx < 0) throw new Error('Cupom não encontrado.');
  const next: CreditCoupon = {
    ...rows[idx],
    redeemed_count: rows[idx].redeemed_count + 1,
    updated_at: nowIso(),
  };
  rows[idx] = next;
  writeCoupons(rows);
  return next;
}

function recordCouponRedemption(input: {
  coupon: CreditCoupon;
  user_id: string;
  package_id: string;
  request_id: string;
  original_price_cents: number;
  discount_cents: number;
  final_price_cents: number;
}): CreditCouponRedemption {
  const rows = readCouponRedemptions();
  const created: CreditCouponRedemption = {
    id: makeId('credem'),
    coupon_id: input.coupon.id,
    coupon_code: input.coupon.code,
    user_id: normalizeUserId(input.user_id),
    package_id: String(input.package_id),
    request_id: String(input.request_id),
    original_price_cents: normalizePriceCents(input.original_price_cents),
    discount_cents: normalizePriceCents(input.discount_cents),
    final_price_cents: normalizePriceCents(input.final_price_cents),
    created_at: nowIso(),
  };
  rows.push(created);
  writeCouponRedemptions(rows.slice(-5000));
  return created;
}
export function formatCreditPrice(cents: number): string {
  const normalized = normalizePriceCents(cents);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(normalized / 100);
}

export function findCreditPackageById(packageId: string): CreditPackage | null {
  const normalized = String(packageId ?? '').trim();
  if (!normalized) return null;
  return CREDIT_PACKAGES.find((row) => row.id === normalized) ?? null;
}

export function registerAndEnsureUserCredits(input: {
  id: string;
  email: string;
  name?: string;
}): void {
  const userId = normalizeUserId(input.id);
  const email = normalizeEmail(input.email);
  if (!userId || !email) return;

  registerOrUpdateUserAccount({ id: userId, email, name: input.name });
  ensureWallet(userId);
  ensureInitialCreditsForUser(userId);
  claimCreditEngagementReward({
    user_id: userId,
    rule_id: 'signup',
    created_by: userId,
  });
}

export function ensureInitialCreditsForUser(userId: string): void {
  const normalized = normalizeUserId(userId);
  if (!normalized) return;

  const granted = readInitialGrantedSet();
  if (granted.includes(normalized)) return;

  const initialCredits = Math.max(0, Math.round(getInitialCreditsAfterSignup()));
  if (initialCredits > 0) {
    applyDelta(
      normalized,
      initialCredits,
      'initial_grant',
      'Crédito inicial apos cadastro',
    );
  } else {
    ensureWallet(normalized);
  }

  granted.push(normalized);
  writeInitialGrantedSet(granted, normalized);
}

function countEngagementClaimsForRule(
  claims: CreditEngagementRewardClaim[],
  userId: string,
  ruleId: CreditEngagementRuleId,
): number {
  return claims.filter((row) => row.user_id === userId && row.rule_id === ruleId).length;
}

export function listCreditEngagementRewardRules(): CreditEngagementRule[] {
  const rules = readEngagementRules();
  return ENGAGEMENT_RULE_ORDER.map((ruleId) => ({ ...rules[ruleId] }));
}

export function saveCreditEngagementRewardRules(
  rows: CreditEngagementRule[],
): CreditEngagementRule[] {
  const current = readEngagementRules();
  const next = { ...current };
  const byId = new Map(
    (rows ?? [])
      .map((row) => {
        const ruleId = normalizeEngagementRuleId(row?.id);
        if (!ruleId) return null;
        return [ruleId, row] as const;
      })
      .filter((entry): entry is readonly [CreditEngagementRuleId, CreditEngagementRule] =>
        Boolean(entry),
      ),
  );

  ENGAGEMENT_RULE_ORDER.forEach((ruleId) => {
    next[ruleId] = normalizeEngagementRule(byId.get(ruleId), next[ruleId]);
  });

  writeEngagementRules(next);
  return ENGAGEMENT_RULE_ORDER.map((ruleId) => ({ ...next[ruleId] }));
}

export function listCreditEngagementRewardClaims(
  userId?: string,
): CreditEngagementRewardClaim[] {
  const needle = normalizeUserId(userId ?? '');
  const rows = readEngagementClaims().sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!needle) return rows;
  return rows.filter((row) => row.user_id === needle);
}

export function claimCreditEngagementReward(input: {
  user_id: string;
  rule_id: CreditEngagementRuleId;
  created_by?: string;
  reference_id?: string;
}): CreditEngagementRewardResult {
  const userId = normalizeUserId(input.user_id);
  const ruleId = normalizeEngagementRuleId(input.rule_id);
  if (!userId || !ruleId) {
    throw new Error('Dados invalidos para recompensa de engajamento.');
  }

  const rules = readEngagementRules();
  const rule = rules[ruleId];
  const claims = readEngagementClaims();
  const claimedCount = countEngagementClaimsForRule(claims, userId, ruleId);
  const maxClaims = rule.max_claims_per_user;
  const remainingBefore =
    maxClaims == null ? null : Math.max(0, maxClaims - claimedCount);

  if (!rule.enabled) {
    return {
      awarded: false,
      reason: 'Regra desativada pelo super usuário.',
      rule: { ...rule },
      remaining_claims: remainingBefore,
    };
  }

  if (rule.credits <= 0) {
    return {
      awarded: false,
      reason: 'Regra sem créditos configurados.',
      rule: { ...rule },
      remaining_claims: remainingBefore,
    };
  }

  const referenceId = String(input.reference_id ?? '').trim();
  if (referenceId) {
    const duplicateByReference = claims.some(
      (row) =>
        row.user_id === userId &&
        row.rule_id === ruleId &&
        row.reference_id === referenceId,
    );
    if (duplicateByReference) {
      return {
        awarded: false,
        reason: 'Referencia ja recompensada para este usuário.',
        rule: { ...rule },
        remaining_claims: remainingBefore,
      };
    }
  }

  if (maxClaims != null && claimedCount >= maxClaims) {
    return {
      awarded: false,
      reason: 'Limite da regra atingido para este usuário.',
      rule: { ...rule },
      remaining_claims: 0,
    };
  }

  const tx = applyDelta(
    userId,
    rule.credits,
    'engagement_reward',
    `Recompensa: ${rule.label}`,
    { created_by: input.created_by, reference_id: referenceId || undefined },
  );

  const claim: CreditEngagementRewardClaim = {
    id: makeId('ceg'),
    user_id: userId,
    rule_id: ruleId,
    credits_awarded: rule.credits,
    created_at: nowIso(),
    created_by: input.created_by ? String(input.created_by) : undefined,
    reference_id: referenceId || undefined,
  };

  claims.push(claim);
  writeEngagementClaims(claims.slice(-50000), userId);

  const remainingAfter =
    maxClaims == null ? null : Math.max(0, maxClaims - (claimedCount + 1));

  return {
    awarded: true,
    reason: 'Recompensa aplicada com sucesso.',
    rule: { ...rule },
    claim,
    transaction: tx,
    remaining_claims: remainingAfter,
  };
}

function buildEmptyUserPerformanceByRule(
  rules: Record<CreditEngagementRuleId, CreditEngagementRule>,
): Record<CreditEngagementRuleId, CreditEngagementRuleUserPerformance> {
  return {
    signup: {
      rule_id: 'signup',
      count: 0,
      credits: 0,
      max_claims_per_user: rules.signup.max_claims_per_user,
      remaining_claims: rules.signup.max_claims_per_user,
    },
    email_confirmation: {
      rule_id: 'email_confirmation',
      count: 0,
      credits: 0,
      max_claims_per_user: rules.email_confirmation.max_claims_per_user,
      remaining_claims: rules.email_confirmation.max_claims_per_user,
    },
    profile_address: {
      rule_id: 'profile_address',
      count: 0,
      credits: 0,
      max_claims_per_user: rules.profile_address.max_claims_per_user,
      remaining_claims: rules.profile_address.max_claims_per_user,
    },
    property_created: {
      rule_id: 'property_created',
      count: 0,
      credits: 0,
      max_claims_per_user: rules.property_created.max_claims_per_user,
      remaining_claims: rules.property_created.max_claims_per_user,
    },
    talhao_created: {
      rule_id: 'talhao_created',
      count: 0,
      credits: 0,
      max_claims_per_user: rules.talhao_created.max_claims_per_user,
      remaining_claims: rules.talhao_created.max_claims_per_user,
    },
  };
}

export function listCreditEngagementUsersPerformance(): CreditEngagementUserPerformance[] {
  const rules = readEngagementRules();
  const claims = readEngagementClaims();
  const users = listRegisteredUsers();
  const userById = new Map(users.map((row) => [row.id, row]));
  const userIds = new Set<string>([
    ...users.map((row) => row.id),
    ...claims.map((row) => row.user_id),
  ]);

  const rows = [...userIds]
    .filter(Boolean)
    .map<CreditEngagementUserPerformance>((userId) => {
      const userClaims = claims.filter((claim) => claim.user_id === userId);
      const user = userById.get(userId);
      const byRule = buildEmptyUserPerformanceByRule(rules);

      for (const claim of userClaims) {
        const bucket = byRule[claim.rule_id];
        bucket.count += 1;
        bucket.credits += Math.max(0, claim.credits_awarded);
      }

      ENGAGEMENT_RULE_ORDER.forEach((ruleId) => {
        const bucket = byRule[ruleId];
        const maxClaims = bucket.max_claims_per_user;
        bucket.remaining_claims =
          maxClaims == null ? null : Math.max(0, maxClaims - bucket.count);
      });

      return {
        user_id: userId,
        user_name: user?.name || user?.email || userId,
        user_email: user?.email || '',
        total_claims: userClaims.length,
        total_credits: userClaims.reduce(
          (sum, claim) => sum + Math.max(0, claim.credits_awarded),
          0,
        ),
        by_rule: byRule,
      };
    })
    .sort((a, b) => {
      if (b.total_credits !== a.total_credits) {
        return b.total_credits - a.total_credits;
      }
      return a.user_name.localeCompare(b.user_name);
    });

  return rows;
}

export function getUserCredits(userId: string): number {
  const normalized = normalizeUserId(userId);
  if (!normalized) return 0;
  const wallet = ensureWallet(normalized);
  return wallet.balance;
}

export function listCreditTransactionsForUser(userId: string): CreditTransaction[] {
  const normalized = normalizeUserId(userId);
  if (!normalized) return [];
  return readTransactions()
    .filter((row) => row.user_id === normalized)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAllCreditTransactions(): CreditTransaction[] {
  return readTransactions().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function grantCreditsToUser(
  userId: string,
  amount: number,
  description: string,
  createdBy?: string,
  options?: {
    type?: CreditTransactionType;
    reference_id?: string;
  },
): CreditTransaction {
  const type = options?.type ?? 'admin_grant';
  return applyDelta(
    userId,
    Math.abs(Math.round(parseNumber(amount))),
    type,
    description || 'Crédito concedido por administrador',
    { created_by: createdBy, reference_id: options?.reference_id },
  );
}

export function removeCreditsFromUser(
  userId: string,
  amount: number,
  description: string,
  createdBy?: string,
  type: CreditTransactionType = 'admin_remove',
): CreditTransaction {
  const normalizedAmount = Math.abs(Math.round(parseNumber(amount)));
  return applyDelta(
    userId,
    -normalizedAmount,
    type,
    description || 'Debito de crédito',
    { created_by: createdBy },
  );
}

export function setCreditsForUser(
  userId: string,
  targetBalance: number,
  createdBy?: string,
): CreditTransaction | null {
  const normalizedTarget = Math.max(0, Math.round(parseNumber(targetBalance)));
  const current = getUserCredits(userId);
  if (normalizedTarget === current) return null;
  if (normalizedTarget > current) {
    return applyDelta(
      userId,
      normalizedTarget - current,
      'admin_grant',
      'Ajuste direto de saldo (admin)',
      { created_by: createdBy },
    );
  }
  return applyDelta(
    userId,
    -(current - normalizedTarget),
    'admin_remove',
    'Ajuste direto de saldo (admin)',
    { created_by: createdBy },
  );
}

export function refundCreditTransaction(
  userId: string,
  transactionId: string,
  createdBy?: string,
): CreditTransaction {
  const normalizedUserId = normalizeUserId(userId);
  const needle = String(transactionId ?? '').trim();
  if (!normalizedUserId || !needle) {
    throw new Error('Transacao inválida para ressarcimento.');
  }

  const transactions = listCreditTransactionsForUser(normalizedUserId);
  const target = transactions.find((row) => row.id === needle);
  if (!target) throw new Error('Transacao não encontrada.');
  if (target.amount >= 0) {
    throw new Error('Somente debitos podem ser ressarcidos.');
  }

  const alreadyRefunded = transactions.some(
    (row) => row.type === 'refund' && row.reference_id === target.id,
  );
  if (alreadyRefunded) {
    throw new Error('Esta transacao ja foi ressarcida.');
  }

  return applyDelta(
    normalizedUserId,
    Math.abs(target.amount),
    'refund',
    `Ressarcimento de ${target.description}`,
    { created_by: createdBy, reference_id: target.id },
  );
}
export function createCreditCoupon(input: {
  code: string;
  type: CreditCouponType;
  value: number;
  max_redemptions?: number | null;
  expires_at?: string | null;
  active?: boolean;
  notes?: string;
  created_by?: string;
}): CreditCoupon {
  const code = normalizeCouponCode(input.code);
  if (!code) throw new Error('Informe um código de cupom.');

  const existing = findCouponByCode(code);
  if (existing) throw new Error('Ja existe um cupom com este código.');

  const type: CreditCouponType = input.type === 'fixed' ? 'fixed' : 'percent';
  const value = parseNumber(input.value);
  if (type === 'percent' && (value <= 0 || value > 100)) {
    throw new Error('Cupom percentual deve estar entre 1 e 100.');
  }
  if (type === 'fixed' && value <= 0) {
    throw new Error('Cupom fixo deve ser maior que zero.');
  }

  const maxRedemptionsRaw = parseNumber(input.max_redemptions);
  const maxRedemptions =
    input.max_redemptions == null || maxRedemptionsRaw <= 0
      ? null
      : Math.round(maxRedemptionsRaw);
  const expiresAt = parseIsoOrNull(input.expires_at);

  if (input.expires_at && !expiresAt) {
    throw new Error('Data de expiracao inválida para o cupom.');
  }

  const now = nowIso();
  const created: CreditCoupon = {
    id: makeId('ccpn'),
    code,
    type,
    value,
    active: normalizeBoolean(input.active, true),
    max_redemptions: maxRedemptions,
    redeemed_count: 0,
    expires_at: expiresAt,
    notes: String(input.notes ?? '').trim() || undefined,
    created_at: now,
    updated_at: now,
    created_by: String(input.created_by ?? '').trim() || undefined,
  };

  const rows = readCoupons();
  rows.push(created);
  writeCoupons(rows);
  return created;
}

export function listCreditCoupons(): CreditCoupon[] {
  return readCoupons().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function setCreditCouponActive(couponId: string, active: boolean): CreditCoupon {
  const needle = String(couponId ?? '').trim();
  if (!needle) throw new Error('Cupom inválido.');

  const rows = readCoupons();
  const idx = rows.findIndex((row) => row.id === needle);
  if (idx < 0) throw new Error('Cupom não encontrado.');

  const next: CreditCoupon = {
    ...rows[idx],
    active,
    updated_at: nowIso(),
  };
  rows[idx] = next;
  writeCoupons(rows);
  return next;
}

export function listCreditCouponRedemptions(limit = 100): CreditCouponRedemption[] {
  const normalizedLimit = Math.max(1, Math.round(parseNumber(limit)));
  return readCouponRedemptions()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, normalizedLimit);
}

export function validateCouponForPackage(input: {
  package_id: string;
  coupon_code: string;
}): CreditCouponValidation {
  const packageId = String(input.package_id ?? '').trim();
  const couponCode = normalizeCouponCode(input.coupon_code);
  const packagePriceCents = getPackagePriceById(packageId);

  if (!couponCode) {
    return {
      valid: false,
      message: 'Informe um cupom para validar.',
      original_price_cents: packagePriceCents,
      discount_cents: 0,
      final_price_cents: packagePriceCents,
    };
  }

  const coupon = findCouponByCode(couponCode);
  if (!coupon) {
    return {
      valid: false,
      message: 'Cupom não encontrado.',
      original_price_cents: packagePriceCents,
      discount_cents: 0,
      final_price_cents: packagePriceCents,
    };
  }

  if (!coupon.active) {
    return {
      valid: false,
      message: 'Cupom inativo.',
      coupon,
      original_price_cents: packagePriceCents,
      discount_cents: 0,
      final_price_cents: packagePriceCents,
    };
  }

  if (coupon.expires_at) {
    const expires = new Date(coupon.expires_at).getTime();
    if (Number.isFinite(expires) && Date.now() >= expires) {
      return {
        valid: false,
        message: 'Cupom expirado.',
        coupon,
        original_price_cents: packagePriceCents,
        discount_cents: 0,
        final_price_cents: packagePriceCents,
      };
    }
  }

  if (
    coupon.max_redemptions != null &&
    coupon.redeemed_count >= coupon.max_redemptions
  ) {
    return {
      valid: false,
      message: 'Cupom esgotado.',
      coupon,
      original_price_cents: packagePriceCents,
      discount_cents: 0,
      final_price_cents: packagePriceCents,
    };
  }

  if (packagePriceCents <= 0) {
    return {
      valid: false,
      message: 'Este pacote não permite desconto no momento.',
      coupon,
      original_price_cents: packagePriceCents,
      discount_cents: 0,
      final_price_cents: packagePriceCents,
    };
  }

  const discount = parseCouponDiscount(coupon, packagePriceCents);
  if (discount <= 0) {
    return {
      valid: false,
      message: 'Cupom sem desconto valido para este pacote.',
      coupon,
      original_price_cents: packagePriceCents,
      discount_cents: 0,
      final_price_cents: packagePriceCents,
    };
  }

  return {
    valid: true,
    message: 'Cupom aplicado com sucesso.',
    coupon,
    original_price_cents: packagePriceCents,
    discount_cents: discount,
    final_price_cents: packagePriceCents - discount,
  };
}

export function createCreditPurchaseRequest(input: {
  user_id: string;
  package_id: string;
  credits_requested: number;
  auth_email: string;
  coupon_code?: string;
}): CreditPurchaseRequest {
  const userId = normalizeUserId(input.user_id);
  const email = normalizeEmail(input.auth_email);
  const packageId = String(input.package_id ?? '').trim();
  if (!userId || !email || !packageId) {
    throw new Error('Dados invalidos para criar solicitação de compra.');
  }

  const packageRow = findCreditPackageById(packageId);
  const credits = packageRow
    ? packageRow.credits
    : Math.max(1, Math.round(parseNumber(input.credits_requested)));
  const priceCents = packageRow ? packageRow.price_cents : 0;
  const packageLabel = packageRow ? packageRow.label : packageId;

  let couponCode: string | undefined;
  let discountCents = 0;
  let finalPriceCents = priceCents;
  let couponUsed: CreditCoupon | undefined;

  if (String(input.coupon_code ?? '').trim()) {
    const validation = validateCouponForPackage({
      package_id: packageId,
      coupon_code: String(input.coupon_code),
    });

    if (!validation.valid || !validation.coupon) {
      throw new Error(validation.message || 'Cupom inválido para este pacote.');
    }

    couponCode = validation.coupon.code;
    discountCents = validation.discount_cents;
    finalPriceCents = validation.final_price_cents;
    couponUsed = validation.coupon;
  }

  const requests = readPurchaseRequests();
  const now = nowIso();
  const created: CreditPurchaseRequest = {
    id: makeId('creq'),
    user_id: userId,
    package_id: packageId,
    package_label: packageLabel,
    credits_requested: credits,
    price_cents: priceCents,
    coupon_code: couponCode,
    discount_cents: discountCents,
    final_price_cents: finalPriceCents,
    auth_email: email,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  requests.push(created);
  writePurchaseRequests(requests.slice(-2000), userId);

  if (couponUsed) {
    increaseCouponRedemptionCount(couponUsed.id);
    recordCouponRedemption({
      coupon: couponUsed,
      user_id: userId,
      package_id: packageId,
      request_id: created.id,
      original_price_cents: priceCents,
      discount_cents: discountCents,
      final_price_cents: finalPriceCents,
    });
  }

  return created;
}

export function listCreditPurchaseRequests(): CreditPurchaseRequest[] {
  return readPurchaseRequests().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function reviewCreditPurchaseRequest(
  requestId: string,
  approved: boolean,
  reviewedBy: string,
  reviewNote?: string,
): CreditPurchaseRequest {
  const needle = String(requestId ?? '').trim();
  if (!needle) throw new Error('Solicitação inválida.');

  const requests = readPurchaseRequests();
  const idx = requests.findIndex((row) => row.id === needle);
  if (idx < 0) throw new Error('Solicitação não encontrada.');

  const target = requests[idx];
  if (target.status !== 'pending') {
    throw new Error('Solicitação ja processada.');
  }

  const next: CreditPurchaseRequest = {
    ...target,
    status: approved ? 'approved' : 'denied',
    updated_at: nowIso(),
    reviewed_by: reviewedBy,
    review_note: String(reviewNote ?? '').trim() || undefined,
  };
  requests[idx] = next;
  writePurchaseRequests(requests, next.user_id);

  if (approved) {
    applyDelta(
      next.user_id,
      next.credits_requested,
      'purchase_approved',
      `Compra aprovada (${next.package_id})`,
      { created_by: reviewedBy, reference_id: next.id },
    );
  }

  return next;
}
export function getCreditAdRewardConfig(): CreditAdRewardConfig {
  return readAdRewardConfig();
}

export function updateCreditAdRewardConfig(
  partial: Partial<CreditAdRewardConfig>,
): CreditAdRewardConfig {
  const current = readAdRewardConfig();
  const next: CreditAdRewardConfig = {
    enabled: normalizeBoolean(partial.enabled, current.enabled),
    credits_per_view: Math.max(
      1,
      Math.round(parseNumber(partial.credits_per_view ?? current.credits_per_view)),
    ),
    daily_limit_per_user: Math.max(
      1,
      Math.round(
        parseNumber(partial.daily_limit_per_user ?? current.daily_limit_per_user),
      ),
    ),
    cooldown_minutes: Math.max(
      0,
      Math.round(parseNumber(partial.cooldown_minutes ?? current.cooldown_minutes)),
    ),
  };
  writeAdRewardConfig(next);
  return next;
}

export function listCreditAdRewardClaims(userId?: string): CreditAdRewardClaim[] {
  const normalized = normalizeUserId(userId ?? '');
  const rows = readAdRewardClaims().sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!normalized) return rows;
  return rows.filter((row) => row.user_id === normalized);
}

export function getAdRewardAvailabilityForUser(userId: string): CreditAdRewardAvailability {
  const normalized = normalizeUserId(userId);
  const config = readAdRewardConfig();
  if (!normalized) {
    return {
      allowed: false,
      reason: 'Usuário inválido para recompensa.',
      remaining_today: 0,
      config,
    };
  }

  if (!config.enabled) {
    return {
      allowed: false,
      reason: 'Recompensa por propaganda desativada pelo super usuário.',
      remaining_today: 0,
      config,
    };
  }

  const claims = listCreditAdRewardClaims(normalized);
  const today = dayKeyLocal(nowIso());
  const todayClaims = claims.filter((row) => dayKeyLocal(row.created_at) === today);
  const remaining = Math.max(0, config.daily_limit_per_user - todayClaims.length);

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: 'Limite diario de recompensas atingido.',
      remaining_today: 0,
      config,
    };
  }

  if (config.cooldown_minutes > 0 && claims.length > 0) {
    const last = claims[0];
    const lastTime = new Date(last.created_at).getTime();
    if (Number.isFinite(lastTime)) {
      const minWaitMs = config.cooldown_minutes * 60 * 1000;
      const nextTime = lastTime + minWaitMs;
      if (Date.now() < nextTime) {
        return {
          allowed: false,
          reason: `Aguarde ${config.cooldown_minutes} minuto(s) entre propagandas.`,
          remaining_today: remaining,
          next_available_at: new Date(nextTime).toISOString(),
          config,
        };
      }
    }
  }

  return {
    allowed: true,
    reason: 'Disponivel para resgate.',
    remaining_today: remaining,
    config,
  };
}

export function claimAdRewardCredits(
  userId: string,
  actorUserId?: string,
): CreditTransaction {
  const normalized = normalizeUserId(userId);
  if (!normalized) throw new Error('Usuário inválido para resgate.');

  const availability = getAdRewardAvailabilityForUser(normalized);
  if (!availability.allowed) {
    throw new Error(availability.reason || 'Recompensa indisponivel no momento.');
  }

  const amount = availability.config.credits_per_view;
  const tx = applyDelta(
    normalized,
    amount,
    'ad_reward',
    'Recompensa por visualizar propaganda',
    { created_by: actorUserId ?? normalized },
  );

  const claims = readAdRewardClaims();
  const claim: CreditAdRewardClaim = {
    id: makeId('cad'),
    user_id: normalized,
    credits_awarded: amount,
    created_at: nowIso(),
  };
  claims.push(claim);
  writeAdRewardClaims(claims.slice(-10000), normalized);

  return tx;
}
