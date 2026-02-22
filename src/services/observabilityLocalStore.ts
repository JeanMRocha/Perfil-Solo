import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export function appendBoundedLocalJsonList<T>(
  storageKey: string,
  entry: T,
  limit: number,
): void {
  if (!storageKey || limit <= 0) return;
  try {
    const rows = storageReadJson<T[]>(storageKey, []);
    rows.push(entry);
    storageWriteJson(storageKey, rows.slice(-limit));
  } catch {
    // Falha de storage nunca deve quebrar o fluxo principal.
  }
}
