// Página pública (CLAUDE.md, regra 4): lê só a vista `app.public_cards` (cartões ativos, campos públicos).
// Qualquer token ou endereço desconhecido, mal formado, inativo, perdido ou bloqueado dá o mesmo `null` (404 neutro).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONTACT_TYPES, DEFAULT_THEME, SOCIAL_PLATFORM_KEYS, type PublicEventType } from '@nfc-business/shared/constants';
import { toSafeImageUrl } from '@nfc-business/shared/links';
import { publicCardSchema, type PublicCard } from '@nfc-business/shared/schemas';
import { isAllowedSocialUrl, isCardToken, isSlug } from '@nfc-business/shared/validators';
import { buildVCard } from '@nfc-business/shared/vcard';
import { DatabaseService } from '../database/database.service';

/** Linha da vista `app.public_cards`. O `company_id` serve só para os eventos; nunca sai para o cliente. */
export interface PublicCardRow {
  card_id: string;
  token: string;
  company_id: string;
  profile_id: string;
  slug: string;
  display_name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  photo_url: string | null;
  theme: unknown;
  contacts: unknown;
  social_links: unknown;
}

export interface PublicTarget {
  cardId: string;
  token: string;
  companyId: string;
  profileId: string;
  slug: string;
  card: PublicCard;
}

export type PublicLookup = { token: string } | { slug: string };

const COLUMNS = `card_id, token, company_id, profile_id, slug, display_name, title, company, bio, photo_url,
  theme, contacts, social_links`;

const CONTACT_TYPE_SET = new Set<string>(CONTACT_TYPES);
const PLATFORM_SET = new Set<string>(SOCIAL_PLATFORM_KEYS);

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
}

/**
 * Converte a linha da vista no contrato `PublicCard`. Defesa em profundidade: mesmo que a base de dados tenha
 * algo inesperado, só saem tipos de contacto conhecidos, redes em https de domínios permitidos e imagens seguras.
 * Devolve `null` se o resultado não cumprir o contrato.
 */
export function toPublicCard(row: PublicCardRow): PublicCard | null {
  const contacts = asArray(row.contacts)
    .filter((contact) => typeof contact.type === 'string' && CONTACT_TYPE_SET.has(contact.type) && typeof contact.value === 'string')
    .map((contact) => ({ type: contact.type, value: contact.value }));
  const socialLinks = asArray(row.social_links)
    .filter(
      (link) =>
        typeof link.platform === 'string' &&
        PLATFORM_SET.has(link.platform) &&
        typeof link.url === 'string' &&
        isAllowedSocialUrl(link.platform as (typeof SOCIAL_PLATFORM_KEYS)[number], link.url),
    )
    .map((link) => ({ platform: link.platform, url: link.url }));
  const storedTheme = typeof row.theme === 'object' && row.theme !== null ? (row.theme as Record<string, unknown>) : {};
  const theme = { ...DEFAULT_THEME, ...storedTheme };

  const parsed = publicCardSchema.safeParse({
    profileId: row.profile_id,
    displayName: row.display_name,
    title: row.title,
    company: row.company,
    bio: row.bio,
    photoUrl: toSafeImageUrl(row.photo_url),
    contacts,
    socialLinks,
    theme: { ...theme, logoUrl: toSafeImageUrl(typeof theme.logoUrl === 'string' ? theme.logoUrl : null) },
  });
  return parsed.success ? parsed.data : null;
}

/** Cada evento público corresponde a uma métrica; o `contact_sent` só é registado pelo backend no envio. */
export const DEDUPE_WINDOW_MINUTES = 30;

@Injectable()
export class PublicCardService {
  private readonly logger = new Logger('PublicCard');

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** Procura o cartão ativo pelo token ou pelo endereço amigável. Entradas mal formadas nem chegam à base de dados. */
  async find(lookup: PublicLookup): Promise<PublicTarget | null> {
    const byToken = 'token' in lookup;
    const key = byToken ? lookup.token : lookup.slug;
    if (byToken ? !isCardToken(key) : !isSlug(key)) return null;

    const row = await this.database.withoutContext(async (db) => {
      const result = await db.query<PublicCardRow>(
        byToken
          ? `select ${COLUMNS} from app.public_cards where token = $1 limit 1`
          : `select ${COLUMNS} from app.public_cards where slug = $1 order by card_id limit 1`,
        [key],
      );
      return result.rows[0];
    });
    if (!row) return null;

    const card = toPublicCard(row);
    if (!card) {
      // Dados fora do contrato: responde como inexistente (404 neutro) e regista sem dados pessoais.
      this.logger.warn(`Cartão público fora do contrato: ${row.card_id}`);
      return null;
    }
    return { cardId: row.card_id, token: row.token, companyId: row.company_id, profileId: row.profile_id, slug: row.slug, card };
  }

  /** vCard 4.0 gerado no servidor, com escape de todos os campos (regra 4). */
  buildVcf(target: PublicTarget, publicOrigin: string | null): string {
    return buildVCard({
      displayName: target.card.displayName,
      title: target.card.title,
      company: target.card.company,
      contacts: target.card.contacts,
      socialLinks: target.card.socialLinks,
      cardUrl: publicOrigin ? `${publicOrigin}/c/${target.token}` : null,
      revision: new Date().toISOString(),
    });
  }

  /**
   * Regista um evento público na empresa do cartão (resolvida no servidor), com deduplicação de 30 minutos
   * por cartão, tipo e hash do IP (regra 6).
   */
  async recordEvent(target: PublicTarget, type: PublicEventType, ipHash: string): Promise<void> {
    await this.database.withContext({ companyId: target.companyId, isPlatformAdmin: false }, (db) =>
      db.query(
        `insert into app.analytics_events (company_id, card_id, profile_id, type, ip_hash)
         select $1, $2, $3, $4, $5
          where not exists (
            select 1 from app.analytics_events
             where card_id = $2 and type = $4 and ip_hash = $5
               and created_at > now() - make_interval(mins => $6)
          )`,
        [target.companyId, target.cardId, target.profileId, type, ipHash, DEDUPE_WINDOW_MINUTES],
      ),
    );
  }
}
