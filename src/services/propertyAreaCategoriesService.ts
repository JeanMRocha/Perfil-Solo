import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const AREA_CATEGORIES_STORAGE_KEY = 'perfilsolo_property_area_categories_v1';
export const AREA_CATEGORIES_UPDATED_EVENT = 'perfilsolo-area-categories-updated';

export interface PropertyAreaCategory {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type AreaCategoriesStore = {
  categories: PropertyAreaCategory[];
};

const DEFAULT_AREA_CATEGORIES: Array<Pick<PropertyAreaCategory, 'id' | 'name'>> = [
  { id: 'talhoes', name: 'Talhoes' },
  { id: 'preservacao', name: 'Areas de preservacao' },
  { id: 'estradas', name: 'Estradas' },
  { id: 'ruas', name: 'Ruas' },
  { id: 'acudes', name: 'Acudes' },
  { id: 'benfeitorias', name: 'Benfeitorias' },
  { id: 'servidao', name: 'Servidao' },
];

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix = 'area-cat'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function normalizeText(input: string): string {
  return normalizeName(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCategory(
  input: Partial<PropertyAreaCategory>,
): PropertyAreaCategory | null {
  const name = normalizeName(String(input.name ?? ''));
  if (!name) return null;
  const createdAt = String(input.created_at ?? nowIso());
  const updatedAt = String(input.updated_at ?? createdAt);
  return {
    id: String(input.id ?? createId()),
    name,
    active: input.active !== false,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function readStore(): AreaCategoriesStore {
  const parsed = storageReadJson<Partial<AreaCategoriesStore>>(
    AREA_CATEGORIES_STORAGE_KEY,
    {},
  );
  const sourceRows = Array.isArray(parsed.categories) ? parsed.categories : [];
  const normalizedRows = sourceRows
    .map((row) => normalizeCategory(row))
    .filter((row): row is PropertyAreaCategory => row != null);

  const hasDefaults = DEFAULT_AREA_CATEGORIES.every((item) =>
    normalizedRows.some((row) => row.id === item.id),
  );

  if (!hasDefaults) {
    const baseRows = DEFAULT_AREA_CATEGORIES.map((item) => ({
      id: item.id,
      name: item.name,
      active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    }));
    const merged = [...normalizedRows];
    for (const base of baseRows) {
      if (merged.some((row) => row.id === base.id)) continue;
      merged.push(base);
    }
    return { categories: merged };
  }

  return { categories: normalizedRows };
}

function writeStore(store: AreaCategoriesStore): void {
  storageWriteJson(AREA_CATEGORIES_STORAGE_KEY, store);
  window.dispatchEvent(
    new CustomEvent(AREA_CATEGORIES_UPDATED_EVENT, { detail: store.categories }),
  );
}

export function listPropertyAreaCategories(
  includeInactive = false,
): PropertyAreaCategory[] {
  const rows = readStore().categories.sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  if (includeInactive) return rows;
  return rows.filter((row) => row.active);
}

export function addPropertyAreaCategory(name: string): PropertyAreaCategory {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error('Informe o nome da categoria.');
  }

  const store = readStore();
  const normalizedNeedle = normalizeText(normalizedName);
  const existing = store.categories.find(
    (row) => normalizeText(row.name) === normalizedNeedle,
  );

  if (existing) {
    if (!existing.active) {
      const revived = {
        ...existing,
        name: normalizedName,
        active: true,
        updated_at: nowIso(),
      };
      writeStore({
        categories: store.categories.map((row) =>
          row.id === revived.id ? revived : row,
        ),
      });
      return revived;
    }
    throw new Error('Ja existe uma categoria com esse nome.');
  }

  const created: PropertyAreaCategory = {
    id: createId(),
    name: normalizedName,
    active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  writeStore({
    categories: [...store.categories, created],
  });
  return created;
}

export function renamePropertyAreaCategory(
  categoryId: string,
  name: string,
): PropertyAreaCategory {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error('Informe o nome da categoria.');
  }

  const store = readStore();
  const current = store.categories.find((row) => row.id === categoryId);
  if (!current) {
    throw new Error('Categoria nao encontrada.');
  }

  const normalizedNeedle = normalizeText(normalizedName);
  const nameInUse = store.categories.some(
    (row) =>
      row.id !== categoryId && normalizeText(row.name) === normalizedNeedle,
  );
  if (nameInUse) {
    throw new Error('Ja existe outra categoria com esse nome.');
  }

  const updated: PropertyAreaCategory = {
    ...current,
    name: normalizedName,
    updated_at: nowIso(),
  };
  writeStore({
    categories: store.categories.map((row) =>
      row.id === categoryId ? updated : row,
    ),
  });
  return updated;
}

export function setPropertyAreaCategoryActive(
  categoryId: string,
  active: boolean,
): PropertyAreaCategory {
  const store = readStore();
  const current = store.categories.find((row) => row.id === categoryId);
  if (!current) {
    throw new Error('Categoria nao encontrada.');
  }
  const updated: PropertyAreaCategory = {
    ...current,
    active,
    updated_at: nowIso(),
  };
  writeStore({
    categories: store.categories.map((row) =>
      row.id === categoryId ? updated : row,
    ),
  });
  return updated;
}

export function removePropertyAreaCategory(categoryId: string): void {
  const store = readStore();
  const exists = store.categories.some((row) => row.id === categoryId);
  if (!exists) return;
  writeStore({
    categories: store.categories.filter((row) => row.id !== categoryId),
  });
}

export function subscribePropertyAreaCategories(
  listener: (rows: PropertyAreaCategory[]) => void,
): () => void {
  const onUpdated = (event: Event) => {
    const custom = event as CustomEvent<PropertyAreaCategory[]>;
    if (Array.isArray(custom.detail)) {
      listener(custom.detail);
      return;
    }
    listener(listPropertyAreaCategories(true));
  };

  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (
      storageEvent.key &&
      storageEvent.key !== AREA_CATEGORIES_STORAGE_KEY
    ) {
      return;
    }
    listener(listPropertyAreaCategories(true));
  };

  window.addEventListener(AREA_CATEGORIES_UPDATED_EVENT, onUpdated);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(AREA_CATEGORIES_UPDATED_EVENT, onUpdated);
    window.removeEventListener('storage', onStorage);
  };
}
