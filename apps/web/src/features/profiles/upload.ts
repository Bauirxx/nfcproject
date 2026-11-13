import type { UploadMimeType, UploadPurpose } from '@nfc-business/shared/constants';
import { uploadSignResponseSchema } from '@nfc-business/shared/schemas';
import { apiFetch } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

/**
 * Envia uma imagem por «URL assinado» (CLAUDE.md, regra 8): pede o URL ao backend e entrega o ficheiro.
 * Devolve o `fileId` para usar em `photoFileId`/`theme.logoFileId`. A imagem já vem validada no cliente.
 */
export async function uploadImage(blob: Blob, purpose: UploadPurpose): Promise<string> {
  const contentType = blob.type as UploadMimeType;
  const { fileId, uploadUrl } = await apiParsed(uploadSignResponseSchema, endpoints.uploads.sign, {
    method: 'POST',
    body: { purpose, contentType, size: blob.size },
  });
  await apiFetch(uploadUrl, { method: 'PUT', body: blob });
  return fileId;
}
