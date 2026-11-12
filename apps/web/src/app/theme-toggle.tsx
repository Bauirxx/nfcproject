import { Monitor, Moon, Sun } from 'lucide-react';
import { commonTexts } from '@/shared/i18n/panel/common';
import { Button } from '@/shared/components/ui/button';
import { useTheme } from './theme';
import type { ThemePreference } from '@/shared/lib/theme-preference';

const CYCLE: readonly ThemePreference[] = ['system', 'light', 'dark'];
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const LABEL = {
  system: commonTexts.theme.system,
  light: commonTexts.theme.light,
  dark: commonTexts.theme.dark,
} as const;

/** Alterna o tema entre automático, claro e escuro. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const Icon = ICON[preference];
  const next = CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length] ?? 'system';
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={() => setPreference(next)}
      aria-label={`${commonTexts.theme.toggle}. ${commonTexts.theme.label}: ${LABEL[preference]}`}
    >
      <Icon aria-hidden="true" />
      <span>{LABEL[preference]}</span>
    </Button>
  );
}
