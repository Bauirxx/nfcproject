import type { ProfileTheme } from '@nfc-business/shared/schemas';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { ThemeEditor } from './theme-editor';

const theme: ProfileTheme = {
  template: 'classic',
  primaryColor: '#1e40af',
  backgroundColor: '#ffffff',
  textColor: '#0f172a',
  logoUrl: null,
};

function textColorInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: 'Cor do texto' });
}

describe('ThemeEditor', () => {
  it('permite guardar quando o contraste cumpre o nível AA', () => {
    renderWithProviders(<ThemeEditor profileId="p_paula" theme={theme} displayName="Paula" canManage />);
    expect(screen.getByText('O contraste cumpre o nível AA.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar tema' })).toBeEnabled();
  });

  it('bloqueia o guardar quando o contraste do texto é insuficiente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeEditor profileId="p_paula" theme={theme} displayName="Paula" canManage />);

    await user.clear(textColorInput());
    await user.type(textColorInput(), '#dddddd');

    expect(screen.getByText('Aumente o contraste para poder guardar o tema.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar tema' })).toBeDisabled();
  });

  it('avisa e bloqueia quem não gere temas', () => {
    renderWithProviders(<ThemeEditor profileId="p_paula" theme={theme} displayName="Paula" canManage={false} />);
    expect(screen.getByText('Só os gestores de temas podem alterar o tema.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar tema' })).toBeDisabled();
  });
});
