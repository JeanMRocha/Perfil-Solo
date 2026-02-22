import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export type InAppPurchaseType =
  | 'avatar_icon'
  | 'store_quota'
  | 'store_bundle'
  | 'store_service';

export interface InAppPurchaseReceipt {
  id: string;
  receipt_number: string;
  user_id: string;
  purchase_type: InAppPurchaseType;
  item_id: string;
  item_label: string;
  quantity: number;
  unit_cost_credits: number;
  total_cost_credits: number;
  credit_transaction_id?: string;
  created_at: string;
}

const IN_APP_PURCHASE_RECEIPTS_KEY = 'perfilsolo_in_app_purchase_receipts_v1';
export const IN_APP_PURCHASES_UPDATED_EVENT = 'perfilsolo-in-app-purchases-updated';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUserId(input: string): string {
  return String(input ?? '').trim();
}

function parsePositiveInt(input: unknown, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded <= 0) return fallback;
  return rounded;
}

function normalizePurchaseType(input: unknown): InAppPurchaseType {
  const raw = String(input ?? '').trim();
  if (raw === 'store_quota') return 'store_quota';
  if (raw === 'store_bundle') return 'store_bundle';
  if (raw === 'store_service') return 'store_service';
  return 'avatar_icon';
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
  return `REC-${y}${m}${d}-${suffix}`;
}

function emitUpdated(userId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(IN_APP_PURCHASES_UPDATED_EVENT, {
      detail: { userId },
    }),
  );
}

function readRows(): InAppPurchaseReceipt[] {
  const parsed = storageReadJson<Partial<InAppPurchaseReceipt>[]>(
    IN_APP_PURCHASE_RECEIPTS_KEY,
    [],
  );
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((row) => row && row.id && row.user_id && row.item_label)
    .map((row) => ({
      id: String(row.id),
      receipt_number: String(row.receipt_number ?? makeReceiptNumber()),
      user_id: normalizeUserId(String(row.user_id)),
      purchase_type: normalizePurchaseType(row.purchase_type),
      item_id: String(row.item_id ?? ''),
      item_label: String(row.item_label ?? 'Compra interna'),
      quantity: parsePositiveInt(row.quantity, 1),
      unit_cost_credits: parsePositiveInt(row.unit_cost_credits, 1),
      total_cost_credits: parsePositiveInt(row.total_cost_credits, 1),
      credit_transaction_id: row.credit_transaction_id
        ? String(row.credit_transaction_id)
        : undefined,
      created_at: String(row.created_at ?? nowIso()),
    }));
}

function writeRows(rows: InAppPurchaseReceipt[], changedUserId: string): void {
  const trimmed = rows.slice(-5000);
  const saved = storageWriteJson(IN_APP_PURCHASE_RECEIPTS_KEY, trimmed);
  if (saved) {
    emitUpdated(changedUserId);
    return;
  }
  const fallbackSaved = storageWriteJson(
    IN_APP_PURCHASE_RECEIPTS_KEY,
    trimmed.slice(-1000),
  );
  if (fallbackSaved) emitUpdated(changedUserId);
}

export function createInAppPurchaseReceipt(input: {
  user_id: string;
  purchase_type: InAppPurchaseType;
  item_id: string;
  item_label: string;
  quantity?: number;
  unit_cost_credits: number;
  total_cost_credits: number;
  credit_transaction_id?: string;
}): InAppPurchaseReceipt {
  const userId = normalizeUserId(input.user_id);
  if (!userId) throw new Error('Usuário inválido para comprovante.');

  const itemLabel = String(input.item_label ?? '').trim();
  if (!itemLabel) throw new Error('Item inválido para comprovante.');

  const created: InAppPurchaseReceipt = {
    id: makeId('iapr'),
    receipt_number: makeReceiptNumber(),
    user_id: userId,
    purchase_type: normalizePurchaseType(input.purchase_type),
    item_id: String(input.item_id ?? '').trim(),
    item_label: itemLabel,
    quantity: parsePositiveInt(input.quantity, 1),
    unit_cost_credits: parsePositiveInt(input.unit_cost_credits, 1),
    total_cost_credits: parsePositiveInt(input.total_cost_credits, 1),
    credit_transaction_id: input.credit_transaction_id
      ? String(input.credit_transaction_id).trim()
      : undefined,
    created_at: nowIso(),
  };

  const rows = readRows();
  rows.push(created);
  writeRows(rows, userId);
  return created;
}

export function listInAppPurchaseReceiptsForUser(userId: string): InAppPurchaseReceipt[] {
  const normalized = normalizeUserId(userId);
  if (!normalized) return [];

  return readRows()
    .filter((row) => row.user_id === normalized)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAllInAppPurchaseReceipts(): InAppPurchaseReceipt[] {
  return readRows().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
