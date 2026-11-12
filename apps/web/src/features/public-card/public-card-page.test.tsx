import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '@/mocks/credentials';
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
});
