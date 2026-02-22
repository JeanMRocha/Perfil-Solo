import { removeCreditsFromUser } from './creditsService';
import { createInAppPurchaseReceipt } from './inAppPurchasesService';
import { createNotification } from './notificationsService';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export interface RuralAvatarIcon {
  id: string;
  label: string;
  emoji: string;
  price_credits: number;
}

export interface UserAvatarInventory {
  user_id: string;
  uploaded_avatar_url: string;
  selected_icon_id: string;
  unlocked_icon_ids: string[];
  updated_at: string;
}

const AVATAR_INVENTORY_KEY = 'perfilsolo_avatar_inventory_v1';
export const AVATAR_MARKET_UPDATED_EVENT = 'perfilsolo-avatar-market-updated';

const RURAL_AVATAR_CATALOG: RuralAvatarIcon[] = [
  { id: 'seed', label: 'Semente', emoji: '🌱', price_credits: 0 },
  { id: 'tractor', label: 'Trator', emoji: '🚜', price_credits: 0 },
  { id: 'wheat', label: 'Trigo', emoji: '🌾', price_credits: 0 },
  { id: 'cow', label: 'Pecuaria', emoji: '🐄', price_credits: 1 },
  { id: 'corn', label: 'Milho', emoji: '🌽', price_credits: 1 },
  { id: 'leaf', label: 'Folha', emoji: '🍃', price_credits: 1 },
  { id: 'chicken', label: 'Avicultura', emoji: '🐓', price_credits: 1 },
  { id: 'farmer', label: 'Produtor', emoji: '🧑‍🌾', price_credits: 1 },
];

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUserId(input: string): string {
  return String(input ?? '').trim();
}

function dispatchAvatarUpdated(userId?: string): void {
  window.dispatchEvent(
    new CustomEvent(AVATAR_MARKET_UPDATED_EVENT, {
      detail: { userId: userId ?? '' },
    }),
  );
}

function readInventories(): UserAvatarInventory[] {
  const parsed = storageReadJson<UserAvatarInventory[]>(AVATAR_INVENTORY_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeInventories(rows: UserAvatarInventory[], userId?: string): void {
  const saved = storageWriteJson(AVATAR_INVENTORY_KEY, rows);
  if (!saved) return;
  dispatchAvatarUpdated(userId);
}

function defaultUnlockedIds(): string[] {
  return RURAL_AVATAR_CATALOG.filter((row) => row.price_credits === 0).map(
    (row) => row.id,
  );
}

function createDefaultInventory(userId: string): UserAvatarInventory {
  const defaults = defaultUnlockedIds();
  return {
    user_id: userId,
    uploaded_avatar_url: '',
    selected_icon_id: defaults[0] ?? 'seed',
    unlocked_icon_ids: defaults,
    updated_at: nowIso(),
  };
}

export function getRuralAvatarCatalog(): RuralAvatarIcon[] {
  return [...RURAL_AVATAR_CATALOG];
}

export function getUserAvatarInventory(userId: string): UserAvatarInventory {
  const normalized = normalizeUserId(userId);
  if (!normalized) throw new Error('Usuário inválido para avatar.');

  const rows = readInventories();
  const idx = rows.findIndex((row) => row.user_id === normalized);
  if (idx >= 0) return rows[idx];

  const created = createDefaultInventory(normalized);
  rows.push(created);
  writeInventories(rows, normalized);
  return created;
}

function persistUserInventory(next: UserAvatarInventory): UserAvatarInventory {
  const rows = readInventories();
  const idx = rows.findIndex((row) => row.user_id === next.user_id);
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  writeInventories(rows, next.user_id);
  return next;
}

export function resolveUserAvatarDisplay(userId: string): {
  src?: string;
  emoji?: string;
} {
  const inventory = getUserAvatarInventory(userId);
  if (inventory.uploaded_avatar_url) {
    return { src: inventory.uploaded_avatar_url, emoji: undefined };
  }
  const selected =
    RURAL_AVATAR_CATALOG.find((row) => row.id === inventory.selected_icon_id) ??
    RURAL_AVATAR_CATALOG[0];
  return { src: undefined, emoji: selected?.emoji ?? '👤' };
}

export function setUploadedAvatarForUser(
  userId: string,
  uploadedAvatarUrl: string,
): UserAvatarInventory {
  const current = getUserAvatarInventory(userId);
  const next: UserAvatarInventory = {
    ...current,
    uploaded_avatar_url: String(uploadedAvatarUrl ?? '').trim(),
    updated_at: nowIso(),
  };
  return persistUserInventory(next);
}

export function clearUploadedAvatarForUser(userId: string): UserAvatarInventory {
  return setUploadedAvatarForUser(userId, '');
}

export function selectRuralAvatarIcon(
  userId: string,
  iconId: string,
): UserAvatarInventory {
  const current = getUserAvatarInventory(userId);
  const normalizedIcon = String(iconId ?? '').trim();
  if (!normalizedIcon) throw new Error('Ícone inválido.');
  if (!current.unlocked_icon_ids.includes(normalizedIcon)) {
    throw new Error('Ícone ainda não desbloqueado.');
  }

  const next: UserAvatarInventory = {
    ...current,
    selected_icon_id: normalizedIcon,
    updated_at: nowIso(),
  };
  return persistUserInventory(next);
}

export function unlockRuralAvatarIcon(
  userId: string,
  iconId: string,
  actorUserId?: string,
): UserAvatarInventory {
  const current = getUserAvatarInventory(userId);
  const normalizedIcon = String(iconId ?? '').trim();
  if (!normalizedIcon) throw new Error('Ícone inválido.');

  const icon = RURAL_AVATAR_CATALOG.find((row) => row.id === normalizedIcon);
  if (!icon) throw new Error('Ícone não encontrado.');
  if (current.unlocked_icon_ids.includes(icon.id)) {
    return selectRuralAvatarIcon(userId, icon.id);
  }

  if (icon.price_credits > 0) {
    const tx = removeCreditsFromUser(
      userId,
      icon.price_credits,
      `Desbloqueio de avatar rural (${icon.label})`,
      actorUserId ?? userId,
      'icon_purchase',
    );
    const receipt = createInAppPurchaseReceipt({
      user_id: userId,
      purchase_type: 'avatar_icon',
      item_id: icon.id,
      item_label: icon.label,
      quantity: 1,
      unit_cost_credits: icon.price_credits,
      total_cost_credits: icon.price_credits,
      credit_transaction_id: tx.id,
    });
    void createNotification(userId, {
      title: 'Compra de ícone confirmada',
      message: `Compra concluida: ${icon.label}. Comprovante ${receipt.receipt_number}.`,
      level: 'success',
    }).catch(() => undefined);
  }

  const nextUnlocked = [...new Set([...current.unlocked_icon_ids, icon.id])];
  const next: UserAvatarInventory = {
    ...current,
    unlocked_icon_ids: nextUnlocked,
    selected_icon_id: icon.id,
    updated_at: nowIso(),
  };
  return persistUserInventory(next);
}
