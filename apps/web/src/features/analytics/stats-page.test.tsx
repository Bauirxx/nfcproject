import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/utils';

let capturedBlob: Blob | null = null;

beforeEach(() => {
  capturedBlob = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    capturedBlob = blob as Blob;
    return 'blob:stats';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

// O nome do cartão aparece na tabela (célula) e nas opções do filtro; a célula identifica os dados carregados.
const paulaCell = () => screen.findByRole('cell', { name: 'Paula Machava · principal' });

describe('StatsPage', () => {
  it('mostra os quatro gráficos e a tabela por cartão', async () => {
    renderApp({ route: '/painel/estatisticas', as: 'u_ana' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Estatísticas' })).toBeInTheDocument();
    await paulaCell();
    for (const label of ['Visitas', 'Cliques', 'Contactos guardados', 'Contactos enviados']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('heading', { name: 'Por cartão' })).toBeInTheDocument();
  });

  it('só o platform_admin vê o filtro por empresa', async () => {
    renderApp({ route: '/painel/estatisticas', as: 'u_ana' });
    await paulaCell();
    expect(screen.queryByLabelText('Empresa')).toBeNull();

    renderApp({ route: '/painel/estatisticas', as: 'u_marta' });
    expect(await screen.findByLabelText('Empresa')).toBeInTheDocument();
  });

  it('exporta um CSV com o cabeçalho e os cartões', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/estatisticas', as: 'u_ana' });
    await paulaCell();

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    expect(capturedBlob).not.toBeNull();
    const text = await capturedBlob!.text();
    expect(text.split('\r\n')[0]).toBe('Cartão,Perfil,Visitas,Cliques,Contactos guardados,Contactos enviados');
    expect(text).toContain('Paula Machava · principal');
  });

  it('filtra por cartão', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/estatisticas', as: 'u_ana' });
    await paulaCell();

    await user.selectOptions(screen.getByLabelText('Cartão'), 'c_paula');

    expect(screen.getAllByText('Visitas').length).toBeGreaterThan(0);
  });
});
