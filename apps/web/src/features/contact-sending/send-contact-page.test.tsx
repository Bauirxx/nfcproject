import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/utils';

describe('SendContactPage', () => {
  it('pré-seleciona o perfil do dono e mostra a pré-visualização', async () => {
    renderApp({ route: '/painel/enviar-contacto', as: 'u_paula' });
    expect(await screen.findByText(/Paula Machava partilhou consigo/)).toBeInTheDocument();
  });

  it('envia por email e mostra o destinatário mascarado no histórico', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/enviar-contacto', as: 'u_paula' });
    await screen.findByText(/Paula Machava partilhou consigo/);

    await user.type(screen.getByLabelText('Email do destinatário'), 'cliente@exemplo.test');
    await user.click(screen.getByRole('button', { name: 'Enviar por email' }));

    expect(await screen.findByText('Email enviado ao destinatário.')).toBeInTheDocument();
    expect(await screen.findByText('c•••@e•••.test')).toBeInTheDocument();
  });

  it('abre o WhatsApp com a mensagem e regista o envio', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderApp({ route: '/painel/enviar-contacto', as: 'u_paula' });
    await screen.findByText(/Paula Machava partilhou consigo/);

    await user.selectOptions(screen.getByLabelText('Canal'), 'whatsapp');
    await user.type(screen.getByLabelText('Número do destinatário'), '841234567');
    await user.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(await screen.findByText('Envio registado. Abrimos o WhatsApp com a mensagem.')).toBeInTheDocument();
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/258841234567'),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('exige o destinatário antes de enviar', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/enviar-contacto', as: 'u_paula' });
    await screen.findByText(/Paula Machava partilhou consigo/);

    await user.click(screen.getByRole('button', { name: 'Enviar por email' }));

    expect(await screen.findByText('Preencha este campo.')).toBeInTheDocument();
  });
});
