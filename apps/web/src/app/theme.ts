// Store do tema do painel partilhado por toda a aplicação, sobre a preferência guardada (shared/lib/theme-preference).
import { useSyncExternalStore } from 'react';
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  storeTheme,
  watchSystemTheme,
  type ThemePreference,
} from '@/shared/lib/theme-preference';

let preference: ThemePreference = 'system';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

/** Lê a preferência guardada, aplica-a e passa a seguir as mudanças do sistema. Chamado uma vez no arranque. */
export function initTheme(): void {
  preference = getStoredTheme();
  applyTheme(preference);
  watchSystemTheme(() => {
    if (preference === 'system') applyTheme('system');
  });
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function setThemePreference(next: ThemePreference): void {
  if (next === preference) return;
  preference = next;
  storeTheme(next);
  applyTheme(next);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface ThemeControl {
  preference: ThemePreference;
  /** Tema efetivo depois de resolver `system`. */
  resolved: 'light' | 'dark';
  setPreference: (next: ThemePreference) => void;
}

export function useTheme(): ThemeControl {
  const current = useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
  return { preference: current, resolved: resolveTheme(current), setPreference: setThemePreference };
}
