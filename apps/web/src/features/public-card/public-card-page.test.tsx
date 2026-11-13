import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '@/mocks/credentials';
import { signIn } from '@/mocks/handlers/testing';
import { PublicCardPage } from './public-card-page';

describe('PublicCardPage', () => {
  it('mostra o cartão de um token ativo com as ações de contacto', async () => {
    render(<PublicCardPage kind="card" id={MOCK_TOKENS.activeCard} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Paula Machava' })).toBeInTheDocument();

    const vcf = screen.getByRole('link', { name: 'Guardar contacto' });
    expect(vcf).toHaveAttribute('href', expect.stringContaining('/contact.vcf'));
    expect(vcf).toHaveAttribute('download');

    expect(screen.getByRole('link', { name: /Ligar/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it('mostra a mesma página neutra para um cartão bloqueado', async () => {
    render(<PublicCardPage kind="card" id={MOCK_TOKENS.blockedCard} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Cartão indisponível' })).toBeInTheDocument();
  });

  it('mostra a página neutra para um token desconhecido', async () => {
    render(<PublicCardPage kind="card" id="TokenInexistente000001" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Cartão indisponível' })).toBeInTheDocument();
  });

  it('abre o cartão de um perfil pelo endereço amigável', async () => {
    render(<PublicCardPage kind="profile" id={MOCK_TOKENS.ownerSlug} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Paula Machava' })).toBeInTheDocument();
  });

  it('mostra ao dono com sessão o botão de enviar o seu contacto', async () => {
    signIn('u_paula');
    render(<PublicCardPage kind="card" id={MOCK_TOKENS.activeCard} />);
    await screen.findByRole('heading', { level: 1, name: 'Paula Machava' });
    expect(await screen.findByRole('button', { name: 'Enviar o meu contacto' })).toBeInTheDocument();
  });

  it('não mostra o botão de envio a visitantes anónimos', async () => {
    render(<PublicCardPage kind="card" id={MOCK_TOKENS.activeCard} />);
    await screen.findByRole('heading', { level: 1, name: 'Paula Machava' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: 'Enviar o meu contacto' })).toBeNull();
  });

  it('o dono abre o painel e vê o formulário de envio', async () => {
    const user = userEvent.setup();
    signIn('u_paula');
    render(<PublicCardPage kind="card" id={MOCK_TOKENS.activeCard} />);
    await user.click(await screen.findByRole('button', { name: 'Enviar o meu contacto' }));
    // O painel de envio é carregado por import() dinâmico; o primeiro carregamento demora mais.
    expect(await screen.findByRole('button', { name: 'Enviar por email' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByLabelText('Email do destinatário')).toBeInTheDocument();
  });
});
