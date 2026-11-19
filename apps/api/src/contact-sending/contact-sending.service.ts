// Envio de contacto (CLAUDE.md, «Módulo de envio de contacto» e regra 5; ADR-0019).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LIMITS, type RateLimitScope } from '@nfc-business/shared/constants';
import { buildShareMessage, maskRecipient } from '@nfc-business/shared/links';
import type { ContactShare, ContactShareRequest } from '@nfc-business/shared/schemas';
import { dbContextOf } from '../common/access';
import { developmentIpSecret } from '../common/ip-hash';
import type { SessionUser } from '../common/session-user';
import { ENV, type Env } from '../config/env';
import { DatabaseService, type Queryable } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { PublicCardService } from '../public/public-card.service';

/** Limite por empresa (regra 5: «e limite por empresa»). Valor assumido; ver ADR-0019. */
export const SHARES_PER_COMPANY_PER_DAY = 500;

interface ShareRow {
  id: string;
  profile_id: string;
  profile_name: string;
  channel: ContactShare['channel'];
  recipient_masked: string;
  created_at: Date;
}

export function toShare(row: ShareRow): ContactShare {
  return {
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    channel: row.channel,
    recipientMasked: row.recipient_masked,
    createdAt: row.created_at.toISOString(),
  };
}

/** Hash do email para a lista de cancelamentos (nunca se guarda o email de quem cancelou). */
export function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

const notFound = () => new NotFoundException({ error: { code: 'not_found' } });

function rateLimited(scope: RateLimitScope, retryAfter: number): HttpException {
  return new HttpException({ error: { code: 'rate_limited', scope }, retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
}

@Injectable()
export class ContactSendingService {
  private readonly unsubscribeSecret: string;
  private readonly publicOrigin: string | null;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(PublicCardService) private readonly publicCards: PublicCardService,
    @Inject(ENV) env: Env,
  ) {
    this.unsubscribeSecret = `unsubscribe:${env.IP_HASH_SECRET ?? developmentIpSecret()}`;
    this.publicOrigin = env.PUBLIC_APP_URL ?? null;
  }

  /** Código assinado do link de cancelamento (prova que o pedido veio de um email nosso). */
  unsubscribeToken(hash: string): string {
    return createHmac('sha256', this.unsubscribeSecret).update(hash).digest('base64url');
  }

  isValidUnsubscribe(hash: string, token: string): boolean {
    if (!/^[0-9a-f]{64}$/.test(hash)) return false; // nosemgrep: regex_dos (ancorada, tamanho fixo, sem retrocesso)
    const expected = Buffer.from(this.unsubscribeToken(hash));
    const actual = Buffer.from(token);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  async unsubscribe(hash: string): Promise<void> {
    await this.database.withoutContext((db) =>
      db.query('insert into app.email_suppressions (email_hash) values ($1) on conflict do nothing', [hash]),
    );
  }

  /**
   * Regista (e, no canal email, envia) um envio. Tudo numa transação com um lock por utilizador: os limites
   * (10/hora, 50/dia por utilizador e o diário da empresa) contam-se na própria tabela e não se ultrapassam
   * com pedidos em paralelo. Se o email falhar, nada fica registado.
   */
  async send(user: SessionUser, request: ContactShareRequest): Promise<{ share: ContactShare; profileName: string }> {
    if (!user.companyId) throw notFound();
    const companyId = user.companyId;
    const ownerId = user.role === 'profile_owner' ? user.id : null;

    return this.database.withContext(dbContextOf(user), async (db) => {
      const profile = await db.query<{ id: string; display_name: string; card_id: string | null; token: string | null }>(
        `select p.id, p.display_name, k.id as card_id, k.token
           from app.profiles p
           left join lateral (
             select id, token from app.cards c where c.profile_id = p.id and c.status = 'active'
              order by c.updated_at desc limit 1
           ) k on true
          where p.id = $1 and p.company_id = $2 and ($3::uuid is null or p.owner_user_id = $3)`,
        [request.profileId, companyId, ownerId],
      );
      const target = profile.rows[0];
      if (!target) throw notFound();
      if (!target.card_id || !target.token) throw new ConflictException({ error: { code: 'profile_without_card' } });

      await db.query('select pg_advisory_xact_lock(hashtext($1))', [`contact-share:${user.id}`]);
      await this.enforceLimits(db, user.id, companyId);

      const email = request.recipient.email?.trim().toLowerCase();
      if (request.channel === 'email') {
        if (!this.email.configured || !this.publicOrigin) {
          throw new ServiceUnavailableException({ error: { code: 'email_unavailable' } });
        }
        const suppressed = await db.query('select 1 from app.email_suppressions where email_hash = $1', [emailHash(email!)]);
        if (suppressed.rows.length > 0) throw new UnprocessableEntityException({ error: { code: 'recipient_unsubscribed' } });
      }

      const inserted = await db.query<ShareRow>(
        `insert into app.contact_shares
           (company_id, profile_id, sender_user_id, channel, recipient_name, recipient_phone, recipient_email,
            recipient_masked, note)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id, profile_id, $10::text as profile_name, channel, recipient_masked, created_at`,
        [
          companyId,
          target.id,
          user.id,
          request.channel,
          request.recipient.name?.trim() || null,
          request.channel === 'email' ? null : (request.recipient.phone ?? null),
          request.channel === 'email' ? email : null,
          maskRecipient(request.channel === 'email' ? { email } : { phone: request.recipient.phone }),
          request.note?.trim() || null,
          target.display_name,
        ],
      );
      // contact_sent só é registado pelo backend (regra 6).
      await db.query(
        `insert into app.analytics_events (company_id, card_id, profile_id, type) values ($1, $2, $3, 'contact_sent')`,
        [companyId, target.card_id, target.id],
      );

      if (request.channel === 'email') await this.sendEmail(email!, target.display_name, target.token, request);
      return { share: toShare(inserted.rows[0]!), profileName: target.display_name };
    });
  }

  /** Histórico: o dono vê os envios dos seus perfis; editores e administradores, os da empresa. */
  async list(user: SessionUser, page: number, pageSize: number, profileId: string | undefined) {
    if (!user.companyId) throw notFound();
    const ownerId = user.role === 'profile_owner' ? user.id : null;
    return this.database.withContext(dbContextOf(user), async (db) => {
      if (profileId) {
        const visible = await db.query(
          'select 1 from app.profiles where id = $1 and company_id = $2 and ($3::uuid is null or owner_user_id = $3)',
          [profileId, user.companyId, ownerId],
        );
        if (visible.rows.length === 0) throw notFound();
      }
      const where = `where s.company_id = $1 and ($2::uuid is null or p.owner_user_id = $2) and ($3::text is null or s.profile_id = $3)`;
      const params = [user.companyId, ownerId, profileId ?? null];
      const total = await db.query<{ n: number }>(
        `select count(*)::int as n from app.contact_shares s join app.profiles p on p.id = s.profile_id ${where}`,
        params,
      );
      const rows = await db.query<ShareRow>(
        `select s.id, s.profile_id, p.display_name as profile_name, s.channel, s.recipient_masked, s.created_at
           from app.contact_shares s join app.profiles p on p.id = s.profile_id ${where}
          order by s.created_at desc, s.id limit $4 offset $5`,
        [...params, pageSize, (page - 1) * pageSize],
      );
      return { items: rows.rows.map(toShare), page, pageSize, total: total.rows[0]?.n ?? 0 };
    });
  }

  private async enforceLimits(db: Queryable, userId: string, companyId: string): Promise<void> {
    const result = await db.query<{
      hour: number;
      day: number;
      company_day: number;
      hour_reset: number | null;
      day_reset: number | null;
      company_reset: number | null;
    }>(
      `select
         count(*) filter (where sender_user_id = $1 and created_at > now() - interval '1 hour')::int as hour,
         count(*) filter (where sender_user_id = $1 and created_at > now() - interval '1 day')::int as day,
         count(*) filter (where created_at > now() - interval '1 day')::int as company_day,
         extract(epoch from (min(created_at) filter (where sender_user_id = $1 and created_at > now() - interval '1 hour')
           + interval '1 hour' - now()))::int as hour_reset,
         extract(epoch from (min(created_at) filter (where sender_user_id = $1 and created_at > now() - interval '1 day')
           + interval '1 day' - now()))::int as day_reset,
         extract(epoch from (min(created_at) filter (where created_at > now() - interval '1 day')
           + interval '1 day' - now()))::int as company_reset
       from app.contact_shares where company_id = $2 and created_at > now() - interval '1 day'`,
      [userId, companyId],
    );
    const counts = result.rows[0]!;
    if (counts.hour >= LIMITS.sharesPerHour) throw rateLimited('hour', Math.max(1, counts.hour_reset ?? 3600));
    if (counts.day >= LIMITS.sharesPerDay) throw rateLimited('day', Math.max(1, counts.day_reset ?? 86_400));
    if (counts.company_day >= SHARES_PER_COMPANY_PER_DAY) {
      throw rateLimited('company', Math.max(1, counts.company_reset ?? 86_400));
    }
  }

  private async sendEmail(to: string, senderName: string, token: string, request: ContactShareRequest): Promise<void> {
    const cardUrl = `${this.publicOrigin}/c/${token}`;
    const target = await this.publicCards.find({ token });
    if (!target) throw new ConflictException({ error: { code: 'profile_without_card' } });
    const hash = emailHash(to);
    await this.email.sendContact({
      to,
      subject: `${senderName} partilhou consigo o seu cartão de visita`,
      text: buildShareMessage({ senderName, recipientName: request.recipient.name, cardUrl, note: request.note }),
      cardUrl,
      unsubscribeUrl: `${this.publicOrigin}/api/public/unsubscribe?h=${hash}&t=${this.unsubscribeToken(hash)}`,
      vcf: { filename: `${target.slug}.vcf`, content: this.publicCards.buildVcf(target, this.publicOrigin) },
    });
  }
}
