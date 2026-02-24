/**
 * cosmeticsService.ts
 *
 * Módulo central de cosméticos — gerencia ícones visuais customizáveis
 * para propriedade, talhão, loja e análise de solo.
 *
 * Cada "slot" (property, talhao, store, soil_analysis) possui um catálogo
 * de ícones com preço em créditos (ou dinheiro), e o usuário pode:
 *   - Desbloquear ícones comprando com créditos ou dinheiro
 *   - Equipar um ícone desbloqueado em cada slot
 *   - Ver histórico de compras via inAppPurchasesService
 *
 * Princípios:
 *   - Separação clara de responsabilidades (catálogo, inventário, compra)
 *   - Código extensível: novos slots adicionados em CosmeticSlot + catálogo
 *   - Integração via eventos customizados (CustomEvent dispatch)
 */

import { removeCreditsFromUser, getUserCredits } from './creditsService';
import { createInAppPurchaseReceipt } from './inAppPurchasesService';
import { createNotification } from './notificationsService';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

// ─── Tipos ─────────────────────────────────────────────────────────

/** Slots visuais disponíveis para cosméticos */
export type CosmeticSlot =
    | 'property'
    | 'talhao'
    | 'store'
    | 'soil_analysis';

/** Método de pagamento para cosméticos */
export type CosmeticPaymentMethod = 'credits' | 'money';

/** Item do catálogo de cosméticos */
export interface CosmeticItem {
    id: string;
    slot: CosmeticSlot;
    label: string;
    description: string;
    /** Emoji para preview rápido (usado onde imagem não está disponível) */
    emoji: string;
    /** Caminho para o sprite/imagem do ícone (relativo a /public) */
    sprite_path: string;
    /** Preço em créditos (0 = gratuito, padrão do sistema) */
    price_credits: number;
    /** Preço em centavos de BRL (null = não vendido por dinheiro) */
    price_cents: number | null;
    /** Se é o item padrão do slot (equipado automaticamente) */
    is_default: boolean;
    /** Tags para filtragem e organização */
    tags: string[];
    /** Tamanho padronizado do ícone no dashboard (CSS class suffix) */
    size_class: 'sm' | 'md' | 'lg';
}

/** Inventário de cosméticos do usuário por slot */
export interface CosmeticUserInventory {
    user_id: string;
    /** Mapa slot → id do item equipado */
    equipped: Record<CosmeticSlot, string>;
    /** Lista de ids de itens desbloqueados (todos os slots) */
    unlocked_ids: string[];
    updated_at: string;
}

/** Resultado de uma tentativa de compra */
export interface CosmeticPurchaseResult {
    success: boolean;
    message: string;
    item?: CosmeticItem;
    receipt_number?: string;
    credits_spent?: number;
}

// ─── Constantes ────────────────────────────────────────────────────

const INVENTORY_KEY = 'perfilsolo_cosmetics_inventory_v1';
export const COSMETICS_UPDATED_EVENT = 'perfilsolo-cosmetics-updated';

const ALL_SLOTS: CosmeticSlot[] = ['property', 'talhao', 'store', 'soil_analysis'];

const SLOT_LABELS: Record<CosmeticSlot, string> = {
    property: 'Propriedade',
    talhao: 'Talhão',
    store: 'Loja',
    soil_analysis: 'Análise de Solo',
};

// ─── Catálogo ──────────────────────────────────────────────────────

/**
 * Catálogo completo de cosméticos.
 * Para adicionar novos itens, basta incluir aqui.
 * O sistema resolve automaticamente os padrões por slot.
 */
const COSMETICS_CATALOG: CosmeticItem[] = [
    // ── PROPRIEDADE ──────────────────────────────────────────────
    {
        id: 'property_farmhouse_classic',
        slot: 'property',
        label: 'Casa da Fazenda Clássica',
        description: 'A casa de fazenda clássica — simples e acolhedora.',
        emoji: '🏡',
        sprite_path: '/sprites/farmhouse-property.png',
        price_credits: 0,
        price_cents: null,
        is_default: true,
        tags: ['clássico', 'grátis'],
        size_class: 'md',
    },
    {
        id: 'property_barn_red',
        slot: 'property',
        label: 'Celeiro Vermelho',
        description: 'Um celeiro vermelho estilo americano — rústico e imponente.',
        emoji: '🏚️',
        sprite_path: '/sprites/cosmetics/barn-red.png',
        price_credits: 5,
        price_cents: 490,
        is_default: false,
        tags: ['premium', 'rústico'],
        size_class: 'md',
    },
    {
        id: 'property_mansion_colonial',
        slot: 'property',
        label: 'Mansão Colonial',
        description: 'Uma elegante mansão colonial — para fazendeiros de grande porte.',
        emoji: '🏛️',
        sprite_path: '/sprites/cosmetics/mansion-colonial.png',
        price_credits: 15,
        price_cents: 1490,
        is_default: false,
        tags: ['premium', 'luxo'],
        size_class: 'lg',
    },
    {
        id: 'property_silo_modern',
        slot: 'property',
        label: 'Silo Moderno',
        description: 'Um silo moderno com tecnologia de ponta.',
        emoji: '🏗️',
        sprite_path: '/sprites/cosmetics/silo-modern.png',
        price_credits: 8,
        price_cents: 790,
        is_default: false,
        tags: ['moderno', 'tecnologia'],
        size_class: 'md',
    },

    // ── TALHÃO ───────────────────────────────────────────────────
    {
        id: 'talhao_plowed_classic',
        slot: 'talhao',
        label: 'Terra Arada Clássica',
        description: 'A terra arada clássica — pronta para o plantio.',
        emoji: '🌾',
        sprite_path: '/sprites/plowed-field-plot.png',
        price_credits: 0,
        price_cents: null,
        is_default: true,
        tags: ['clássico', 'grátis'],
        size_class: 'md',
    },
    {
        id: 'talhao_green_crop',
        slot: 'talhao',
        label: 'Plantação Verde',
        description: 'Uma plantação exuberante em pleno crescimento.',
        emoji: '🌿',
        sprite_path: '/sprites/cosmetics/green-crop.png',
        price_credits: 5,
        price_cents: 490,
        is_default: false,
        tags: ['premium', 'vegetal'],
        size_class: 'md',
    },
    {
        id: 'talhao_orchard',
        slot: 'talhao',
        label: 'Pomar Frutífero',
        description: 'Um pomar carregado de frutas — abundância garantida.',
        emoji: '🍎',
        sprite_path: '/sprites/cosmetics/orchard.png',
        price_credits: 10,
        price_cents: 990,
        is_default: false,
        tags: ['premium', 'fruteiras'],
        size_class: 'lg',
    },
    {
        id: 'talhao_vineyard',
        slot: 'talhao',
        label: 'Vinhedo',
        description: 'Um vinhedo elegante — perfeito para regiões de clima temperado.',
        emoji: '🍇',
        sprite_path: '/sprites/cosmetics/vineyard.png',
        price_credits: 12,
        price_cents: 1190,
        is_default: false,
        tags: ['premium', 'luxo'],
        size_class: 'md',
    },

    // ── LOJA ─────────────────────────────────────────────────────
    {
        id: 'store_balloon_classic',
        slot: 'store',
        label: 'Balão da Loja Clássico',
        description: 'O balão de ar quente clássico — flutua com estilo.',
        emoji: '🎈',
        sprite_path: '/sprites/store-balloon.vector.svg',
        price_credits: 0,
        price_cents: null,
        is_default: true,
        tags: ['clássico', 'grátis'],
        size_class: 'md',
    },
    {
        id: 'store_truck',
        slot: 'store',
        label: 'Caminhão de Insumos',
        description: 'Um caminhão carregado de insumos agrícolas.',
        emoji: '🚛',
        sprite_path: '/sprites/cosmetics/store-truck.png',
        price_credits: 6,
        price_cents: 590,
        is_default: false,
        tags: ['premium', 'logística'],
        size_class: 'md',
    },
    {
        id: 'store_market_tent',
        slot: 'store',
        label: 'Barraca de Feira',
        description: 'Uma barraca de feira colorida — venda direta ao consumidor.',
        emoji: '⛺',
        sprite_path: '/sprites/cosmetics/market-tent.png',
        price_credits: 8,
        price_cents: 790,
        is_default: false,
        tags: ['premium', 'feira'],
        size_class: 'md',
    },

    // ── ANÁLISE DE SOLO ──────────────────────────────────────────
    {
        id: 'soil_analysis_beaker_classic',
        slot: 'soil_analysis',
        label: 'Béquer Clássico',
        description: 'O béquer de laboratório clássico — análise precisa.',
        emoji: '🧪',
        sprite_path: '/sprites/cosmetics/beaker-classic.png',
        price_credits: 0,
        price_cents: null,
        is_default: true,
        tags: ['clássico', 'grátis'],
        size_class: 'md',
    },
    {
        id: 'soil_analysis_microscope',
        slot: 'soil_analysis',
        label: 'Microscópio Avançado',
        description: 'Um microscópio de alta tecnologia — análise em nível molecular.',
        emoji: '🔬',
        sprite_path: '/sprites/cosmetics/microscope.png',
        price_credits: 7,
        price_cents: 690,
        is_default: false,
        tags: ['premium', 'tecnologia'],
        size_class: 'md',
    },
    {
        id: 'soil_analysis_satellite',
        slot: 'soil_analysis',
        label: 'Satélite de Sensoriamento',
        description: 'Monitoramento por satélite — agricultura de precisão.',
        emoji: '🛰️',
        sprite_path: '/sprites/cosmetics/satellite.png',
        price_credits: 20,
        price_cents: 1990,
        is_default: false,
        tags: ['premium', 'luxo', 'tecnologia'],
        size_class: 'lg',
    },
];

// ─── Funções internas ──────────────────────────────────────────────

function nowIso(): string {
    return new Date().toISOString();
}

function normalizeUserId(input: string): string {
    return String(input ?? '').trim();
}

function dispatchCosmeticsUpdated(userId?: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(COSMETICS_UPDATED_EVENT, {
            detail: { userId: userId ?? '' },
        }),
    );
}

function readInventories(): CosmeticUserInventory[] {
    const parsed = storageReadJson<CosmeticUserInventory[]>(INVENTORY_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
}

function writeInventories(
    rows: CosmeticUserInventory[],
    userId?: string,
): void {
    const saved = storageWriteJson(INVENTORY_KEY, rows);
    if (!saved) return;
    dispatchCosmeticsUpdated(userId);
}

/** Retorna os IDs padrão (gratuitos) de cada slot */
function defaultEquipped(): Record<CosmeticSlot, string> {
    const equipped: Record<string, string> = {};
    for (const slot of ALL_SLOTS) {
        const defaultItem = COSMETICS_CATALOG.find(
            (item) => item.slot === slot && item.is_default,
        );
        equipped[slot] = defaultItem?.id ?? '';
    }
    return equipped as Record<CosmeticSlot, string>;
}

/** Retorna os IDs de todos os itens gratuitos */
function defaultUnlockedIds(): string[] {
    return COSMETICS_CATALOG
        .filter((item) => item.price_credits === 0)
        .map((item) => item.id);
}

function createDefaultInventory(userId: string): CosmeticUserInventory {
    return {
        user_id: userId,
        equipped: defaultEquipped(),
        unlocked_ids: defaultUnlockedIds(),
        updated_at: nowIso(),
    };
}

function persistInventory(
    next: CosmeticUserInventory,
): CosmeticUserInventory {
    const rows = readInventories();
    const idx = rows.findIndex((row) => row.user_id === next.user_id);
    if (idx >= 0) {
        rows[idx] = next;
    } else {
        rows.push(next);
    }
    writeInventories(rows, next.user_id);
    return next;
}

// ─── API Pública: Catálogo ─────────────────────────────────────────

/** Retorna todos os itens do catálogo */
export function getCosmeticsCatalog(): CosmeticItem[] {
    return [...COSMETICS_CATALOG];
}

/** Retorna itens do catálogo filtrados por slot */
export function getCosmeticsBySlot(slot: CosmeticSlot): CosmeticItem[] {
    return COSMETICS_CATALOG.filter((item) => item.slot === slot);
}

/** Retorna um item do catálogo pelo id */
export function getCosmeticById(itemId: string): CosmeticItem | null {
    return COSMETICS_CATALOG.find((item) => item.id === itemId) ?? null;
}

/** Retorna todos os slots disponíveis e seus labels */
export function getCosmeticSlots(): { slot: CosmeticSlot; label: string }[] {
    return ALL_SLOTS.map((slot) => ({ slot, label: SLOT_LABELS[slot] }));
}

/** Retorna o label de um slot */
export function getCosmeticSlotLabel(slot: CosmeticSlot): string {
    return SLOT_LABELS[slot] ?? slot;
}

// ─── API Pública: Inventário ───────────────────────────────────────

/** Retorna ou cria o inventário do usuário */
export function getUserCosmeticInventory(
    userId: string,
): CosmeticUserInventory {
    const normalized = normalizeUserId(userId);
    if (!normalized) throw new Error('Usuário inválido para cosméticos.');

    const rows = readInventories();
    const existing = rows.find((row) => row.user_id === normalized);
    if (existing) {
        // Garante que novos slots adicionados tenham valor padrão
        let needsUpdate = false;
        const defaults = defaultEquipped();
        for (const slot of ALL_SLOTS) {
            if (!existing.equipped[slot]) {
                existing.equipped[slot] = defaults[slot];
                needsUpdate = true;
            }
        }
        // Garante que itens gratuitos novos estejam desbloqueados
        const freeIds = defaultUnlockedIds();
        for (const freeId of freeIds) {
            if (!existing.unlocked_ids.includes(freeId)) {
                existing.unlocked_ids.push(freeId);
                needsUpdate = true;
            }
        }
        if (needsUpdate) {
            existing.updated_at = nowIso();
            persistInventory(existing);
        }
        return existing;
    }

    const created = createDefaultInventory(normalized);
    const allRows = readInventories();
    allRows.push(created);
    writeInventories(allRows, normalized);
    return created;
}

/** Retorna o item cosmético equipado num slot para o usuário */
export function getEquippedCosmetic(
    userId: string,
    slot: CosmeticSlot,
): CosmeticItem {
    const inventory = getUserCosmeticInventory(userId);
    const equippedId = inventory.equipped[slot];
    const item = COSMETICS_CATALOG.find((c) => c.id === equippedId);
    if (item) return item;

    // Fallback para o item padrão do slot
    const defaultItem = COSMETICS_CATALOG.find(
        (c) => c.slot === slot && c.is_default,
    );
    return defaultItem ?? COSMETICS_CATALOG.find((c) => c.slot === slot)!;
}

/** Verifica se um item está desbloqueado para o usuário */
export function isCosmeticUnlocked(userId: string, itemId: string): boolean {
    const inventory = getUserCosmeticInventory(userId);
    return inventory.unlocked_ids.includes(itemId);
}

// ─── API Pública: Equipar ──────────────────────────────────────────

/** Equipa um item cosmético (deve estar desbloqueado) */
export function equipCosmetic(
    userId: string,
    itemId: string,
): CosmeticUserInventory {
    const normalized = normalizeUserId(userId);
    if (!normalized) throw new Error('Usuário inválido.');

    const item = getCosmeticById(itemId);
    if (!item) throw new Error('Cosmético não encontrado no catálogo.');

    const inventory = getUserCosmeticInventory(normalized);
    if (!inventory.unlocked_ids.includes(itemId)) {
        throw new Error('Cosmético ainda não desbloqueado.');
    }

    const next: CosmeticUserInventory = {
        ...inventory,
        equipped: { ...inventory.equipped, [item.slot]: itemId },
        updated_at: nowIso(),
    };
    return persistInventory(next);
}

// ─── API Pública: Compra ───────────────────────────────────────────

/** Compra um cosmético com créditos */
export function purchaseCosmeticWithCredits(
    userId: string,
    itemId: string,
): CosmeticPurchaseResult {
    const normalized = normalizeUserId(userId);
    if (!normalized) {
        return { success: false, message: 'Usuário inválido.' };
    }

    const item = getCosmeticById(itemId);
    if (!item) {
        return { success: false, message: 'Cosmético não encontrado no catálogo.' };
    }

    const inventory = getUserCosmeticInventory(normalized);

    // Já desbloqueado — apenas equipa
    if (inventory.unlocked_ids.includes(itemId)) {
        equipCosmetic(normalized, itemId);
        return {
            success: true,
            message: `"${item.label}" já estava desbloqueado. Equipado com sucesso!`,
            item,
            credits_spent: 0,
        };
    }

    // Item gratuito
    if (item.price_credits === 0) {
        const next: CosmeticUserInventory = {
            ...inventory,
            unlocked_ids: [...new Set([...inventory.unlocked_ids, itemId])],
            equipped: { ...inventory.equipped, [item.slot]: itemId },
            updated_at: nowIso(),
        };
        persistInventory(next);
        return {
            success: true,
            message: `"${item.label}" desbloqueado gratuitamente!`,
            item,
            credits_spent: 0,
        };
    }

    // Verifica saldo
    const balance = getUserCredits(normalized);
    if (balance < item.price_credits) {
        return {
            success: false,
            message: `Créditos insuficientes. Necessário: ${item.price_credits}, Saldo: ${balance}.`,
            item,
        };
    }

    // Debita créditos
    const tx = removeCreditsFromUser(
        normalized,
        item.price_credits,
        `Compra de cosmético: ${item.label} (${SLOT_LABELS[item.slot]})`,
        normalized,
        'cosmetic_purchase',
    );

    // Cria comprovante
    const receipt = createInAppPurchaseReceipt({
        user_id: normalized,
        purchase_type: 'store_bundle',
        item_id: item.id,
        item_label: `Cosmético: ${item.label}`,
        quantity: 1,
        unit_cost_credits: item.price_credits,
        total_cost_credits: item.price_credits,
        credit_transaction_id: tx.id,
    });

    // Desbloqueia e equipa
    const next: CosmeticUserInventory = {
        ...inventory,
        unlocked_ids: [...new Set([...inventory.unlocked_ids, itemId])],
        equipped: { ...inventory.equipped, [item.slot]: itemId },
        updated_at: nowIso(),
    };
    persistInventory(next);

    // Notificação
    void createNotification(normalized, {
        title: 'Cosmético desbloqueado!',
        message: `Você comprou "${item.label}" por ${item.price_credits} crédito(s). Comprovante: ${receipt.receipt_number}.`,
        level: 'success',
    }).catch(() => undefined);

    return {
        success: true,
        message: `"${item.label}" comprado e equipado com sucesso!`,
        item,
        receipt_number: receipt.receipt_number,
        credits_spent: item.price_credits,
    };
}

/** Solicita compra de cosmético com dinheiro (gera pedido pendente) */
export function requestCosmeticPurchaseWithMoney(
    userId: string,
    itemId: string,
): CosmeticPurchaseResult {
    const normalized = normalizeUserId(userId);
    if (!normalized) {
        return { success: false, message: 'Usuário inválido.' };
    }

    const item = getCosmeticById(itemId);
    if (!item) {
        return { success: false, message: 'Cosmético não encontrado no catálogo.' };
    }

    if (item.price_cents == null) {
        return {
            success: false,
            message: `"${item.label}" não está disponível para compra com dinheiro.`,
        };
    }

    const inventory = getUserCosmeticInventory(normalized);
    if (inventory.unlocked_ids.includes(itemId)) {
        equipCosmetic(normalized, itemId);
        return {
            success: true,
            message: `"${item.label}" já estava desbloqueado. Equipado!`,
            item,
        };
    }

    // Cria comprovante como pendente (pagamento externo)
    const receipt = createInAppPurchaseReceipt({
        user_id: normalized,
        purchase_type: 'store_bundle',
        item_id: item.id,
        item_label: `Cosmético (dinheiro): ${item.label}`,
        quantity: 1,
        unit_cost_credits: 0,
        total_cost_credits: 0,
    });

    // Desbloqueia imediatamente (otimista — em produção seria após confirmação)
    const next: CosmeticUserInventory = {
        ...inventory,
        unlocked_ids: [...new Set([...inventory.unlocked_ids, itemId])],
        equipped: { ...inventory.equipped, [item.slot]: itemId },
        updated_at: nowIso(),
    };
    persistInventory(next);

    void createNotification(normalized, {
        title: 'Cosmético adquirido!',
        message: `Você adquiriu "${item.label}" por R$ ${(item.price_cents / 100).toFixed(2)}. Comprovante: ${receipt.receipt_number}.`,
        level: 'success',
    }).catch(() => undefined);

    return {
        success: true,
        message: `"${item.label}" adquirido com sucesso!`,
        item,
        receipt_number: receipt.receipt_number,
    };
}

/** Retorna informações resumidas de cosméticos para display */
export function getCosmeticsSlotSummary(
    userId: string,
    slot: CosmeticSlot,
): {
    equipped: CosmeticItem;
    total: number;
    unlocked: number;
    locked: number;
} {
    const inventory = getUserCosmeticInventory(userId);
    const slotItems = getCosmeticsBySlot(slot);
    const equipped = getEquippedCosmetic(userId, slot);
    const unlocked = slotItems.filter((item) =>
        inventory.unlocked_ids.includes(item.id),
    ).length;

    return {
        equipped,
        total: slotItems.length,
        unlocked,
        locked: slotItems.length - unlocked,
    };
}

/** Formata preço em BRL para exibição */
export function formatCosmeticPrice(priceCents: number | null): string {
    if (priceCents == null) return 'Não disponível';
    return `R$ ${(priceCents / 100).toFixed(2).replace('.', ',')}`;
}
