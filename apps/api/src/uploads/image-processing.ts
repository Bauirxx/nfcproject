// Re-codificação das imagens (CLAUDE.md, regra 8): o sharp descodifica o original já validado por magic bytes,
// endireita-o pela orientação EXIF, limita as dimensões e grava em WebP SEM metadados (EXIF, GPS, ICC).
// Corre dentro da worker isolada (image-worker.ts), sem variáveis de ambiente e com memória limitada.
import type { UploadPurpose } from '@nfc-business/shared/constants';
import sharp from 'sharp';

/** Dimensão máxima (lado maior) por fim. */
export const MAX_DIMENSION: Record<UploadPurpose, number> = {
  profile_photo: 800,
  company_logo: 512,
  theme_logo: 512,
};

/** Recusa imagens com mais píxeis do que isto (bombas de descompressão). */
export const MAX_INPUT_PIXELS = 40_000_000;

export async function processImage(input: Uint8Array, purpose: UploadPurpose): Promise<Uint8Array> {
  const size = MAX_DIMENSION[purpose];
  const output = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error', animated: false })
    .rotate()
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return new Uint8Array(output);
}
