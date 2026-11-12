// Identificação de imagens pelos primeiros bytes (magic bytes). Sem dependências: serve o cliente e o backend.
import { UPLOAD_MIME_TYPES, type UploadMimeType } from './constants';

/** Quantos bytes do início do ficheiro são precisos para identificar o tipo. */
export const IMAGE_SIGNATURE_BYTES = 12;

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function hasSignature(bytes: Uint8Array, signature: readonly number[], offset: number = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Tipo real do ficheiro: JPEG, PNG ou WebP. `null` para tudo o resto, incluindo SVG e GIF (CLAUDE.md, regra 8). */
export function detectImageType(bytes: Uint8Array): UploadMimeType | null {
  if (hasSignature(bytes, JPEG)) return 'image/jpeg';
  if (hasSignature(bytes, PNG)) return 'image/png';
  if (hasSignature(bytes, RIFF) && hasSignature(bytes, WEBP, 8)) return 'image/webp';
  return null;
}

export function isUploadMimeType(value: string): value is UploadMimeType {
  return (UPLOAD_MIME_TYPES as readonly string[]).includes(value);
}
