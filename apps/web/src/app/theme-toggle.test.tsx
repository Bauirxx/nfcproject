import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setThemePreference } from './theme';
import { ThemeToggle } from './theme-toggle';

// O store do tema é ao nível do módulo: cada teste parte de um estado conhecido.
afterEach(() => setThemePreference('system'));

describe('ThemeToggle', () => {
  it('percorre automático → claro → escuro e aplica a classe dark', async () => {
    setThemePreference('system');
    const user = userEvent.setup();
    render(<ThemeToggle />);

    expect(screen.getByRole('button')).toHaveAccessibleName(/autom/i);

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAccessibleName(/claro/i);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAccessibleName(/escuro/i);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
