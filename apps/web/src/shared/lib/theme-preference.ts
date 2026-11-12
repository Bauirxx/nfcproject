// Preferência de tema do painel: a única leitura e escrita de localStorage permitida no frontend
// (CLAUDE.md, regra 1; exceção aberta no ESLint). O modo escuro é aplicado pela classe `dark` em <html>.
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nfc-business-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function getStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Janela privada ou armazenamento bloqueado: fica a preferência do sistema.
  }
  return 'system';
}

export function storeTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Sem armazenamento: o tema fica só nesta sessão.
  }
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

/** Tema efetivo depois de resolver `system` pela preferência do sistema. */
export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

/** Aplica o tema a <html> ligando ou desligando a classe `dark`. */
export function applyTheme(preference: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(preference) === 'dark');
}

/** Avisa quando a preferência do sistema muda (só interessa enquanto o tema estiver em `system`). */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => undefined;
  const media = matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
