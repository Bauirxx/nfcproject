// Handlers de uploads da API simulada: URL assinado na mesma origem e verificação por magic bytes (CLAUDE.md, regra 8).
import type { HttpHandler } from 'msw';
import { LIMITS, type UploadMimeType, type UploadPurpose } from '@nfc-business/shared/constants';
import { detectImageType } from '@nfc-business/shared/images';
import type { Permission } from '@nfc-business/shared/permissions';
import { uploadSignRequestSchema, type UploadSignResponse } from '@nfc-business/shared/schemas';
import { nextId, type DbUser, type MockDb } from '../db';
import { fail, json, noContent, readBody, requirePermission, requireUser, route } from './http';

/** Quem pode pedir cada tipo de upload: a mesma permissão de quem edita o recurso a que se destina. */
const PERMISSION_BY_PURPOSE: Record<UploadPurpose, Permission> = {
  profile_photo: 'profiles.edit',
  theme_logo: 'themes.manage',
  company_logo: 'companies.manage',
};

function toDataUrl(contentType: UploadMimeType, bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/**
 * Consome um upload já recebido, do próprio utilizador e para o fim indicado, e devolve o URL da imagem.
 * Um `fileId` desconhecido, de outro utilizador, de outro fim ou ainda sem ficheiro dá 422 `invalid_file`.
 */
export function consumeUpload(db: MockDb, user: DbUser, fileId: string, purpose: UploadPurpose): string {
  const upload = db.uploads[fileId];
  if (!upload || upload.userId !== user.id || upload.purpose !== purpose || upload.dataUrl === null) {
    fail(422, 'invalid_file');
  }
  delete db.uploads[fileId];
  return upload.dataUrl;
}

export const uploadHandlers: HttpHandler[] = [
  route('post', '/api/uploads/sign', async ({ db, request }) => {
    const user = requireUser(db);
    const { purpose, contentType, size } = await readBody(request, uploadSignRequestSchema);
    requirePermission(db, PERMISSION_BY_PURPOSE[purpose]);
    const fileId = nextId('f');
    db.uploads[fileId] = { id: fileId, userId: user.id, purpose, contentType, size, dataUrl: null };
    return json({ fileId, uploadUrl: `/api/uploads/${fileId}` } satisfies UploadSignResponse);
  }),

  // O «URL assinado»: só aceita o ficheiro anunciado, uma vez, com o tipo confirmado pelos primeiros bytes.
  route('put', '/api/uploads/:fileId', async ({ db, request, param }) => {
    const user = requireUser(db);
    const upload = db.uploads[param('fileId')];
    if (!upload || upload.userId !== user.id || upload.dataUrl !== null) fail(404, 'not_found');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > LIMITS.uploadMaxBytes) fail(413, 'file_too_large');
    if (bytes.length !== upload.size) fail(422, 'invalid_file');
    const declared = request.headers.get('Content-Type') ?? '';
    const detected = detectImageType(bytes);
    if (detected === null || detected !== upload.contentType || !declared.startsWith(upload.contentType)) {
      fail(415, 'unsupported_file_type');
    }
    upload.dataUrl = toDataUrl(detected, bytes);
    return noContent();
  }),
];
