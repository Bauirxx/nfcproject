import { DEFAULT_THEME } from '@nfc-business/shared/constants';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { PublicCardService, toPublicCard, type PublicCardRow } from './public-card.service';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

function row(overrides: Partial<PublicCardRow> = {}): PublicCardRow {
  return {
    card_id: 'c_1',
    token: TOKEN,
    company_id: 'co_acme',
    profile_id: 'p_1',
    slug: 'paula-machava',
    display_name: 'Paula Machava',
    title: 'Diretora',
    company: 'ACME',
    bio: null,
    photo_url: null,
    theme: {},
    contacts: [
      { type: 'phone', value: '+258841234567', isPublic: true },
      { type: 'fax', value: '123' },
    ],
    social_links: [
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/paula' },
      { platform: 'linkedin', url: 'https://evil.example/phish' },
      { platform: 'myspace', url: 'https://myspace.com/x' },
    ],
    ...overrides,
  };
}

describe('toPublicCard', () => {
  it('só deixa sair contactos conhecidos e redes em domínios permitidos; aplica o tema por defeito', () => {
    const card = toPublicCard(row());
    expect(card).toEqual({
      profileId: 'p_1',
      displayName: 'Paula Machava',
      title: 'Diretora',
      company: 'ACME',
      bio: null,
      photoUrl: null,
      contacts: [{ type: 'phone', value: '+258841234567' }],
      socialLinks: [{ platform: 'linkedin', url: 'https://www.linkedin.com/in/paula' }],
      theme: { ...DEFAULT_THEME },
    });
    // O company_id nunca faz parte do contrato público.
    expect(JSON.stringify(card)).not.toContain('co_acme');
  });

  it('descarta imagens que não sejam https', () => {
    const card = toPublicCard(row({ photo_url: 'javascript:alert(1)', theme: { logoUrl: 'http://x/logo.png' } }));
    expect(card?.photoUrl).toBeNull();
    expect(card?.theme.logoUrl).toBeNull();
  });

  it('devolve null quando os dados não cumprem o contrato', () => {
    expect(toPublicCard(row({ theme: { primaryColor: 'vermelho' } }))).toBeNull();
  });
});

describe('PublicCardService.find', () => {
  function serviceWith(rows: PublicCardRow[]) {
    const query = vi.fn(async () => ({ rows }));
    const database = {
      withoutContext: vi.fn(async (work: (db: { query: typeof query }) => Promise<unknown>) => work({ query })),
    } as unknown as DatabaseService;
    return { service: new PublicCardService(database), query, database };
  }

  it('entradas mal formadas não chegam à base de dados', async () => {
    const { service, database } = serviceWith([row()]);
    expect(await service.find({ token: "x' or 1=1 --" })).toBeNull();
    expect(await service.find({ slug: '../etc' })).toBeNull();
    expect(database.withoutContext).not.toHaveBeenCalled();
  });

  it('procura pelo token com parâmetro e devolve o alvo', async () => {
    const { service, query } = serviceWith([row()]);
    const target = await service.find({ token: TOKEN });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('from app.public_cards where token = $1'), [TOKEN]);
    expect(target).toMatchObject({ cardId: 'c_1', companyId: 'co_acme', slug: 'paula-machava' });
  });

  it('sem linha devolve null (404 neutro)', async () => {
    const { service } = serviceWith([]);
    expect(await service.find({ slug: 'ninguem' })).toBeNull();
  });

  it('gera o VCF com o link do cartão quando há origem pública', async () => {
    const { service } = serviceWith([row()]);
    const target = await service.find({ token: TOKEN });
    const vcf = service.buildVcf(target!, 'https://app.exemplo.com');
    expect(vcf).toContain('FN:Paula Machava');
    expect(vcf).toContain(`URL;TYPE=x-nfc-card:https://app.exemplo.com/c/${TOKEN}`);
    expect(service.buildVcf(target!, null)).not.toContain('x-nfc-card');
  });
});
