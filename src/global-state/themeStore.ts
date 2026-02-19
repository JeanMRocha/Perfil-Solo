import { atom } from 'nanostores';
import { storageGetRaw, storageSetRaw } from '../services/safeLocalStorage';

type ThemeMode = 'light' | 'dark';
const THEME_KEY = 'perfilsolo_tema';
const THEME_PREF_VERSION_KEY = 'perfilsolo_tema_pref_v';
const THEME_PREF_VERSION = '2';

function resolveSavedTheme(): ThemeMode {
  const currentVersion = storageGetRaw(THEME_PREF_VERSION_KEY);
  if (currentVersion !== THEME_PREF_VERSION) {
    storageSetRaw(THEME_KEY, 'dark');
    storageSetRaw(THEME_PREF_VERSION_KEY, THEME_PREF_VERSION);
    return 'dark';
  }

  const saved = storageGetRaw(THEME_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  storageSetRaw(THEME_KEY, 'dark');
  return 'dark';
}

export const $tema = atom<ThemeMode>(resolveSavedTheme());

export function alternarTema() {
  const novo: ThemeMode = $tema.get() === 'light' ? 'dark' : 'light';
  $tema.set(novo);
  storageSetRaw(THEME_KEY, novo);
}
