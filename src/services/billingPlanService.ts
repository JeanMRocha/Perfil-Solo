import {
  CREDIT_MONEY_CONVERSION,
  MONETIZATION_RULES,
  type BillingFeatureId,
  type BillingPlanId,
  convertMoneyCentsToCredits,
  resolveBillingPlanId,
} from '../modules/billing';
import {
  getBillingFeaturesWithCatalog,
  getBillingPlansWithCatalog,
} from './billingCatalogService';
import { supabaseClient } from '../supabase/supabaseClient';
import {
  getAnalysesByUserLocal,
  getPropertiesByUser,
  getTalhoesByProperties,
} from './localDb';
import { removeCreditsFromUser, grantCreditsToUser, type CreditTransaction } from './creditsService';
import { isLocalDataMode } from './dataProvider';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export type BillingSubscriptionStatus = 'active' | 'inactive' | 'canceled';

export type BillingLedgerEntryType = 'monthly_invoice' | 'credit_topup' | 'refund';

export type BillingLedgerEntryStatus = 'posted' | 'partially_refunded' | 'refunded';

export interface BillingSubscription {
  user_id: string;
  plan_id: BillingPlanId;
  status: BillingSubscriptionStatus;
  downgraded_from_premium_at?: string;
  downgrade_grace_until?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface PropertyAccessPolicy {
  restricted_to_first_property: boolean;
  grace_active: boolean;
  grace_deadline: string | null;
}

export interface BillingUsageSnapshot {
  properties: number;
  talhoes: number;
  analises: number;
  captured_at: string;
}

export interface BillingQuoteLine {
  feature_id: BillingFeatureId;
  label: string;
  unit_label: string;
  included_units: number;
  used_units: number;
  extra_units: number;
  unit_price_cents: number;
  total_extra_cents: number;
}

export interface BillingQuote {
  plan_id: BillingPlanId;
  plan_label: string;
  base_price_cents: number;
  usage: BillingUsageSnapshot;
  lines: BillingQuoteLine[];
  total_extra_cents: number;
  total_monthly_cents: number;
  generated_at: string;
}

export interface BillingLedgerEntry {
  id: string;
  user_id: string;
  type: BillingLedgerEntryType;
  status: BillingLedgerEntryStatus;
  amount_cents: number;
  credits_delta: number;
  description: string;
  created_at: string;
  created_by?: string;
  reference_id?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingStats {
  total_gross_cents: number;
  total_refunded_cents: number;
  total_net_cents: number;
  total_credits_issued: number;
  invoice_count: number;
  topup_count: number;
  refund_count: number;
  entries_count: number;
  active_subscriptions_by_plan: Record<BillingPlanId, number>;
}

const SUBSCRIPTIONS_KEY = 'perfilsolo_billing_subscriptions_v1';
const LEDGER_KEY = 'perfilsolo_billing_ledger_v1';
const STORE_RECURRING_COMMITMENTS_KEY = 'perfilsolo_store_recurring_commitments_v1';
const PREMIUM_DOWNGRADE_GRACE_DAYS = 7;

export const BILLING_UPDATED_EVENT = 'perfilsolo-billing-updated';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseNumber(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function normalizeUserId(input: unknown): string {
  return String(input ?? '').trim();
}

function normalizeMoneyCents(input: unknown): number {
  return Math.max(0, Math.round(parseNumber(input)));
}

function normalizeCredits(input: unknown): number {
  return Math.round(parseNumber(input));
}

function emitBillingUpdated(userId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BILLING_UPDATED_EVENT, {
      detail: {
        userId: userId ?? '',
      },
    }),
  );
}

function readSubscriptions(): BillingSubscription[] {
  const rows = storageReadJson<Partial<BillingSubscription>[]>(
    SUBSCRIPTIONS_KEY,
    [],
  );
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row?.user_id)
    .map((row) => {
      const userId = normalizeUserId(row.user_id);
      const status =
        row.status === 'inactive' || row.status === 'canceled'
          ? row.status
          : 'active';
      return {
        user_id: userId,
        plan_id: resolveBillingPlanId(row.plan_id),
        status,
        downgraded_from_premium_at:
          row.downgraded_from_premium_at && String(row.downgraded_from_premium_at).trim()
            ? String(row.downgraded_from_premium_at)
            : undefined,
        downgrade_grace_until:
          row.downgrade_grace_until && String(row.downgrade_grace_until).trim()
            ? String(row.downgrade_grace_until)
            : undefined,
        created_at: String(row.created_at ?? nowIso()),
        updated_at: String(row.updated_at ?? row.created_at ?? nowIso()),
        updated_by: row.updated_by ? String(row.updated_by) : undefined,
      } as BillingSubscription;
    });
}

function addGraceDaysIso(fromIso: string, days: number): string {
  const from = new Date(fromIso);
  const baseTime = Number.isFinite(from.getTime()) ? from.getTime() : Date.now();
  return new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
}

function resolveGraceDeadline(subscription: BillingSubscription): string | null {
  const direct = String(subscription.downgrade_grace_until ?? '').trim();
  if (direct) return direct;
  const fromDowngrade = String(subscription.downgraded_from_premium_at ?? '').trim();
  if (!fromDowngrade) return null;
  return addGraceDaysIso(fromDowngrade, PREMIUM_DOWNGRADE_GRACE_DAYS);
}

function writeSubscriptions(rows: BillingSubscription[], changedUserId?: string): void {
  const saved = storageWriteJson(SUBSCRIPTIONS_KEY, rows);
  if (!saved) {
    throw new Error('Falha ao persistir assinaturas locais.');
  }
  emitBillingUpdated(changedUserId);
}

function normalizeLedgerStatus(input: unknown): BillingLedgerEntryStatus {
  if (input === 'partially_refunded') return 'partially_refunded';
  if (input === 'refunded') return 'refunded';
  return 'posted';
}

function normalizeLedgerType(input: unknown): BillingLedgerEntryType {
  if (input === 'credit_topup') return 'credit_topup';
  if (input === 'refund') return 'refund';
  return 'monthly_invoice';
}

function readLedgerRows(): BillingLedgerEntry[] {
  const rows = storageReadJson<Partial<BillingLedgerEntry>[]>(LEDGER_KEY, []);
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row?.id && row?.user_id)
    .map((row) => ({
      id: String(row.id),
      user_id: normalizeUserId(row.user_id),
      type: normalizeLedgerType(row.type),
      status: normalizeLedgerStatus(row.status),
      amount_cents: Math.round(parseNumber(row.amount_cents)),
      credits_delta: normalizeCredits(row.credits_delta),
      description: String(row.description ?? 'Lançamento financeiro'),
      created_at: String(row.created_at ?? nowIso()),
      created_by: row.created_by ? String(row.created_by) : undefined,
      reference_id: row.reference_id ? String(row.reference_id) : undefined,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : undefined,
    }));
}

function readStoreRecurringCommitmentsTotalCentsByUser(userId: string): number {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return 0;
  const rows = storageReadJson<
    {
      user_id?: string;
      total_price_cents?: number;
    }[]
  >(STORE_RECURRING_COMMITMENTS_KEY, []);
  if (!Array.isArray(rows)) return 0;
  return rows
    .filter((row) => String(row?.user_id ?? '').trim() === normalizedUserId)
    .reduce(
      (sum, row) => sum + Math.max(0, Math.round(parseNumber(row?.total_price_cents))),
      0,
    );
}

function writeLedgerRows(rows: BillingLedgerEntry[], changedUserId?: string): void {
  const saved = storageWriteJson(LEDGER_KEY, rows.slice(-20000));
  if (!saved) {
    throw new Error('Falha ao persistir histórico financeiro local.');
  }
  emitBillingUpdated(changedUserId);
}

function buildDefaultSubscription(userId: string, legacyPlanId?: string): BillingSubscription {
  const resolved = resolveBillingPlanId(legacyPlanId);
  const now = nowIso();
  return {
    user_id: userId,
    plan_id: resolved,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}

export function listBillingSubscriptions(): BillingSubscription[] {
  return readSubscriptions().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getBillingSubscriptionForUser(
  userId: string,
  legacyPlanId?: string,
): BillingSubscription {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Usuário inválido para assinatura.');

  const rows = readSubscriptions();
  const found = rows.find((row) => row.user_id === normalizedUserId);
  if (found) return found;

  const created = buildDefaultSubscription(normalizedUserId, legacyPlanId);
  rows.push(created);
  writeSubscriptions(rows, normalizedUserId);
  return created;
}

export function setBillingPlanForUser(input: {
  user_id: string;
  plan_id: BillingPlanId;
  updated_by?: string;
  status?: BillingSubscriptionStatus;
}): BillingSubscription {
  const userId = normalizeUserId(input.user_id);
  if (!userId) throw new Error('Usuário inválido para alteracao de plano.');

  const rows = readSubscriptions();
  const idx = rows.findIndex((row) => row.user_id === userId);
  const nextPlanId = resolveBillingPlanId(input.plan_id);
  const nextStatus =
    input.status === 'inactive' || input.status === 'canceled'
      ? input.status
      : 'active';

  const now = nowIso();
  const current = idx >= 0 ? rows[idx] : null;
  const isPremiumDowngrade =
    Boolean(current) && current?.plan_id === 'premium' && nextPlanId === 'free';
  const graceUntil = isPremiumDowngrade
    ? addGraceDaysIso(now, PREMIUM_DOWNGRADE_GRACE_DAYS)
    : undefined;
  const nextRow: BillingSubscription =
    idx >= 0
      ? {
          ...rows[idx],
          plan_id: nextPlanId,
          status: nextStatus,
          downgraded_from_premium_at:
            nextPlanId === 'premium'
              ? undefined
              : isPremiumDowngrade
                ? now
                : rows[idx].downgraded_from_premium_at,
          downgrade_grace_until:
            nextPlanId === 'premium'
              ? undefined
              : isPremiumDowngrade
                ? graceUntil
                : rows[idx].downgrade_grace_until,
          updated_at: now,
          updated_by: input.updated_by,
        }
      : {
          user_id: userId,
          plan_id: nextPlanId,
          status: nextStatus,
          downgraded_from_premium_at: undefined,
          downgrade_grace_until: undefined,
          created_at: now,
          updated_at: now,
          updated_by: input.updated_by,
        };

  if (idx >= 0) rows[idx] = nextRow;
  else rows.push(nextRow);

  writeSubscriptions(rows, userId);
  return nextRow;
}

export function getPropertyAccessPolicyForUser(
  userId: string,
  legacyPlanId?: string,
): PropertyAccessPolicy {
  const subscription = getBillingSubscriptionForUser(userId, legacyPlanId);
  if (subscription.plan_id !== 'free') {
    return {
      restricted_to_first_property: false,
      grace_active: false,
      grace_deadline: null,
    };
  }

  const graceDeadline = resolveGraceDeadline(subscription);
  if (!graceDeadline) {
    return {
      restricted_to_first_property: false,
      grace_active: false,
      grace_deadline: null,
    };
  }

  const now = Date.now();
  const deadlineTime = new Date(graceDeadline).getTime();
  const hasValidDeadline = Number.isFinite(deadlineTime);
  if (!hasValidDeadline) {
    return {
      restricted_to_first_property: false,
      grace_active: false,
      grace_deadline: null,
    };
  }

  if (now <= deadlineTime) {
    return {
      restricted_to_first_property: false,
      grace_active: true,
      grace_deadline: graceDeadline,
    };
  }

  return {
    restricted_to_first_property: true,
    grace_active: false,
    grace_deadline: graceDeadline,
  };
}

export async function getBillingUsageForUser(userId: string): Promise<BillingUsageSnapshot> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para leitura de uso.');
  }

  if (isLocalDataMode) {
    const properties = await getPropertiesByUser(normalizedUserId);
    const propertyIds = properties.map((row) => row.id);
    const [talhoes, analyses] = await Promise.all([
      getTalhoesByProperties(propertyIds),
      getAnalysesByUserLocal(normalizedUserId),
    ]);
    return {
      properties: properties.length,
      talhoes: talhoes.length,
      analises: analyses.length,
      captured_at: nowIso(),
    };
  }

  const { data: propertiesRows, error: propertiesError } = await (supabaseClient as any)
    .from('properties')
    .select('id')
    .eq('user_id', normalizedUserId);
  if (propertiesError) throw propertiesError;

  const propertyIds = (propertiesRows ?? []).map((row: { id?: string }) =>
    String(row.id ?? '').trim(),
  );

  if (propertyIds.length === 0) {
    return {
      properties: 0,
      talhoes: 0,
      analises: 0,
      captured_at: nowIso(),
    };
  }

  const [{ data: talhoesRows, error: talhoesError }, { data: analysesRows, error: analysesError }] =
    await Promise.all([
      (supabaseClient as any).from('talhoes').select('id').in('property_id', propertyIds),
      (supabaseClient as any)
        .from('analises_solo')
        .select('id')
        .in('property_id', propertyIds),
    ]);

  if (talhoesError) throw talhoesError;
  if (analysesError) throw analysesError;

  return {
    properties: propertyIds.length,
    talhoes: Array.isArray(talhoesRows) ? talhoesRows.length : 0,
    analises: Array.isArray(analysesRows) ? analysesRows.length : 0,
    captured_at: nowIso(),
  };
}

export function calculateBillingQuote(
  planId: BillingPlanId,
  usage: BillingUsageSnapshot,
): BillingQuote {
  const resolvedPlanId = resolveBillingPlanId(planId);
  const plans = getBillingPlansWithCatalog();
  const plan =
    plans.find((row) => row.id === resolvedPlanId) ??
    plans.find((row) => row.id === 'free')!;
  const features = getBillingFeaturesWithCatalog();

  const usedByFeature: Record<BillingFeatureId, number> = {
    properties: Math.max(0, Math.round(parseNumber(usage.properties))),
    talhoes: Math.max(0, Math.round(parseNumber(usage.talhoes))),
    analises: Math.max(0, Math.round(parseNumber(usage.analises))),
  };

  const lines: BillingQuoteLine[] = features.map((feature) => {
    const included = Math.max(0, Math.round(feature.included_by_plan[resolvedPlanId]));
    const used = usedByFeature[feature.id];
    const extraUnits = Math.max(0, used - included);
    const unitPrice = Math.max(0, Math.round(feature.extra_unit_price_cents));
    const totalExtra = extraUnits * unitPrice;

    return {
      feature_id: feature.id,
      label: feature.label,
      unit_label: feature.unit_label,
      included_units: included,
      used_units: used,
      extra_units: extraUnits,
      unit_price_cents: unitPrice,
      total_extra_cents: totalExtra,
    };
  });

  const totalExtraCents = lines.reduce((sum, row) => sum + row.total_extra_cents, 0);

  return {
    plan_id: resolvedPlanId,
    plan_label: plan.label,
    base_price_cents: plan.base_price_cents,
    usage: {
      properties: usedByFeature.properties,
      talhoes: usedByFeature.talhoes,
      analises: usedByFeature.analises,
      captured_at: usage.captured_at || nowIso(),
    },
    lines,
    total_extra_cents: totalExtraCents,
    total_monthly_cents: plan.base_price_cents + totalExtraCents,
    generated_at: nowIso(),
  };
}

export function formatBillingMoney(cents: number): string {
  const normalized = Math.round(parseNumber(cents));
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(normalized / 100);
}

export function listBillingLedger(limit = 500): BillingLedgerEntry[] {
  const normalizedLimit = Math.max(1, Math.round(parseNumber(limit)));
  return readLedgerRows()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, normalizedLimit);
}

export function listBillingLedgerForUser(
  userId: string,
  limit = 500,
): BillingLedgerEntry[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];
  return listBillingLedger(limit).filter((row) => row.user_id === normalizedUserId);
}

export async function createMonthlyInvoiceForUser(input: {
  user_id: string;
  legacy_plan_id?: string;
  created_by?: string;
  usage?: BillingUsageSnapshot;
}): Promise<{ quote: BillingQuote; entry: BillingLedgerEntry }> {
  const userId = normalizeUserId(input.user_id);
  if (!userId) throw new Error('Usuário inválido para faturamento mensal.');

  const subscription = getBillingSubscriptionForUser(userId, input.legacy_plan_id);
  const usage = input.usage ?? (await getBillingUsageForUser(userId));
  const quote = calculateBillingQuote(subscription.plan_id, usage);
  const recurringAddonsCents = readStoreRecurringCommitmentsTotalCentsByUser(userId);
  const finalMonthlyCents = quote.total_monthly_cents + recurringAddonsCents;

  const entry: BillingLedgerEntry = {
    id: makeId('bill'),
    user_id: userId,
    type: 'monthly_invoice',
    status: 'posted',
    amount_cents: finalMonthlyCents,
    credits_delta: 0,
    description: `Fechamento mensal ${quote.plan_label}`,
    created_at: nowIso(),
    created_by: input.created_by,
    metadata: {
      plan_id: quote.plan_id,
      base_price_cents: quote.base_price_cents,
      total_extra_cents: quote.total_extra_cents,
      recurring_addons_cents: recurringAddonsCents,
      total_projected_cents: finalMonthlyCents,
      usage: quote.usage,
      lines: quote.lines,
    },
  };

  const rows = readLedgerRows();
  rows.push(entry);
  writeLedgerRows(rows, userId);
  return { quote, entry };
}

export function createCreditTopupFromMoney(input: {
  user_id: string;
  amount_cents: number;
  created_by?: string;
  description?: string;
}): { entry: BillingLedgerEntry; credit_transaction: CreditTransaction } {
  if (!MONETIZATION_RULES.allow_money_to_credits) {
    throw new Error('Conversão de dinheiro para créditos esta desativada.');
  }

  const userId = normalizeUserId(input.user_id);
  if (!userId) throw new Error('Usuário inválido para compra de créditos.');

  const amountCents = normalizeMoneyCents(input.amount_cents);
  if (amountCents <= 0) {
    throw new Error('Valor em dinheiro deve ser maior que zero.');
  }

  const credits = convertMoneyCentsToCredits(amountCents);
  if (credits <= 0) {
    throw new Error('Conversão de créditos resultou em zero.');
  }

  const tx = grantCreditsToUser(
    userId,
    credits,
    input.description || `Recarga de carteira cosmetica ${formatBillingMoney(amountCents)}`,
    input.created_by,
    {
      type: 'money_conversion',
    },
  );

  const entry: BillingLedgerEntry = {
    id: makeId('bill'),
    user_id: userId,
    type: 'credit_topup',
    status: 'posted',
    amount_cents: amountCents,
    credits_delta: credits,
    description: input.description || 'Compra de créditos para itens cosmeticos',
    created_at: nowIso(),
    created_by: input.created_by,
    reference_id: tx.id,
    metadata: {
      conversion_ratio: CREDIT_MONEY_CONVERSION.brl_to_credits_ratio,
      source: 'money_to_credits',
      wallet_scope: 'cosmetics_only',
      functional_currency: MONETIZATION_RULES.functional_currency,
      cosmetic_currency: MONETIZATION_RULES.cosmetic_currency,
    },
  };

  const rows = readLedgerRows();
  rows.push(entry);
  writeLedgerRows(rows, userId);
  return { entry, credit_transaction: tx };
}

function sumRefundedCents(rows: BillingLedgerEntry[], targetEntryId: string): number {
  return rows
    .filter((row) => row.type === 'refund' && row.reference_id === targetEntryId)
    .reduce((sum, row) => sum + Math.max(0, Math.abs(row.amount_cents)), 0);
}

export function refundBillingEntry(input: {
  entry_id: string;
  created_by?: string;
  reason?: string;
  amount_cents?: number;
  reverse_credits?: boolean;
}): { refund_entry: BillingLedgerEntry; credit_reversal?: CreditTransaction } {
  const entryId = String(input.entry_id ?? '').trim();
  if (!entryId) throw new Error('Lançamento inválido para estorno.');

  const rows = readLedgerRows();
  const idx = rows.findIndex((row) => row.id === entryId);
  if (idx < 0) throw new Error('Lançamento não encontrado.');

  const target = rows[idx];
  if (target.type === 'refund') {
    throw new Error('Não e permitido estornar um estorno.');
  }

  const alreadyRefunded = sumRefundedCents(rows, target.id);
  const maxRefundable = Math.max(0, target.amount_cents - alreadyRefunded);
  if (maxRefundable <= 0) {
    throw new Error('Lançamento ja estornado integralmente.');
  }

  const requestedCentsRaw =
    input.amount_cents == null ? maxRefundable : normalizeMoneyCents(input.amount_cents);
  const refundAmount = Math.min(maxRefundable, requestedCentsRaw);
  if (refundAmount <= 0) {
    throw new Error('Valor de estorno inválido.');
  }

  const reverseCredits = Boolean(input.reverse_credits);
  const maxCreditsFromThisRefund = convertMoneyCentsToCredits(refundAmount);
  const creditsToReverse =
    reverseCredits && target.credits_delta > 0
      ? Math.min(target.credits_delta, maxCreditsFromThisRefund)
      : 0;

  let creditReversal: CreditTransaction | undefined;
  if (creditsToReverse > 0) {
    creditReversal = removeCreditsFromUser(
      target.user_id,
      creditsToReverse,
      `Estorno financeiro: ${target.description}`,
      input.created_by,
      'billing_refund_adjustment',
    );
  }

  const reason = String(input.reason ?? '').trim();
  const refundEntry: BillingLedgerEntry = {
    id: makeId('bill'),
    user_id: target.user_id,
    type: 'refund',
    status: 'posted',
    amount_cents: -refundAmount,
    credits_delta: -creditsToReverse,
    description: reason || `Estorno de ${target.description}`,
    created_at: nowIso(),
    created_by: input.created_by,
    reference_id: target.id,
    metadata: {
      refunded_amount_cents: refundAmount,
      reverse_credits: reverseCredits,
      credit_transaction_id: creditReversal?.id,
    },
  };

  const totalRefundedAfter = alreadyRefunded + refundAmount;
  const nextStatus: BillingLedgerEntryStatus =
    totalRefundedAfter >= target.amount_cents ? 'refunded' : 'partially_refunded';

  rows[idx] = {
    ...target,
    status: nextStatus,
  };
  rows.push(refundEntry);
  writeLedgerRows(rows, target.user_id);

  return { refund_entry: refundEntry, credit_reversal: creditReversal };
}

export function getBillingStats(): BillingStats {
  const ledger = readLedgerRows();
  const subscriptions = readSubscriptions();

  const totalGrossCents = ledger
    .filter((row) => row.type !== 'refund')
    .reduce((sum, row) => sum + Math.max(0, row.amount_cents), 0);

  const totalRefundedCents = ledger
    .filter((row) => row.type === 'refund')
    .reduce((sum, row) => sum + Math.max(0, Math.abs(row.amount_cents)), 0);

  const totalCreditsIssued = ledger
    .filter((row) => row.type === 'credit_topup')
    .reduce((sum, row) => sum + Math.max(0, row.credits_delta), 0);

  const activeByPlan: Record<BillingPlanId, number> = {
    free: 0,
    premium: 0,
  };

  for (const sub of subscriptions) {
    if (sub.status !== 'active') continue;
    activeByPlan[sub.plan_id] += 1;
  }

  return {
    total_gross_cents: totalGrossCents,
    total_refunded_cents: totalRefundedCents,
    total_net_cents: totalGrossCents - totalRefundedCents,
    total_credits_issued: totalCreditsIssued,
    invoice_count: ledger.filter((row) => row.type === 'monthly_invoice').length,
    topup_count: ledger.filter((row) => row.type === 'credit_topup').length,
    refund_count: ledger.filter((row) => row.type === 'refund').length,
    entries_count: ledger.length,
    active_subscriptions_by_plan: activeByPlan,
  };
}
