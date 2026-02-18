import { atom } from 'nanostores';

type ThemeMode = 'light' | 'dark';
const THEME_KEY = 'perfilsolo_tema';
const THEME_PREF_VERSION_KEY = 'perfilsolo_tema_pref_v';
const THEME_PREF_VERSION = '2';

function resolveSavedTheme(): ThemeMode {
  const currentVersion = localStorage.getItem(THEME_PREF_VERSION_KEY);
  if (currentVersion !== THEME_PREF_VERSION) {
    localStorage.setItem(THEME_KEY, 'dark');
    localStorage.setItem(THEME_PREF_VERSION_KEY, THEME_PREF_VERSION);
    return 'dark';
  }

  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  localStorage.setItem(THEME_KEY, 'dark');
  return 'dark';
}

export const $tema = atom<ThemeMode>(resolveSavedTheme());

export function alternarTema() {
  const novo: ThemeMode = $tema.get() === 'light' ? 'dark' : 'light';
  $tema.set(novo);
  localStorage.setItem(THEME_KEY, novo);
}
