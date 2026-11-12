// Handler de auditoria da API simulada (FRONTEND «Auditoria»; CLAUDE.md, regra 11). Só leitura: o registo é append-only.
import type { HttpHandler } from 'msw';
import { auditQuerySchema, type AuditEntry } from '@nfc-business/shared/schemas';
import type { DbAuditEntry, MockDb } from '../db';
import { civilDate, companyName } from '../domain';
import { fail, json, paginate, readQuery, requirePermission, route } from './http';

export function toAuditEntry(db: MockDb, entry: DbAuditEntry): AuditEntry {
  return {
    id: entry.id,
    action: entry.action,
    actorName: entry.actorName,
    actorEmail: entry.actorEmail,
    target: entry.target,
    companyName: companyName(db, entry.companyId),
    createdAt: entry.createdAt,
  };
}

function matchesActor(entry: DbAuditEntry, needle: string): boolean {
  return entry.actorName.toLowerCase().includes(needle) || entry.actorEmail.toLowerCase().includes(needle);
}

export const auditHandlers: HttpHandler[] = [
  // platform_admin vê tudo; company_admin só as ações da sua empresa.
  route('get', '/api/audit', ({ db, url }) => {
    const user = requirePermission(db, 'audit.view');
    const query = readQuery(url, auditQuerySchema);
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) fail(400, 'invalid_request');
    const actorNeedle = query.actor?.toLowerCase();
    const entries = db.audit
      .filter((entry) => user.role === 'platform_admin' || entry.companyId === user.companyId)
      .filter((entry) => query.action === undefined || entry.action === query.action)
      .filter((entry) => !actorNeedle || matchesActor(entry, actorNeedle))
      .filter((entry) => {
        if (query.from === undefined && query.to === undefined) return true;
        const day = civilDate(new Date(entry.createdAt));
        return (query.from === undefined || day >= query.from) && (query.to === undefined || day <= query.to);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => toAuditEntry(db, entry));
    return json(paginate(entries, query.page, query.pageSize));
  }),
];
