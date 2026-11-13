// Validação de imagens no cliente antes do upload (CLAUDE.md, regra 8): tipo real por magic bytes,
// tamanho até 2 MB e dimensões dentro dos limites. A verificação final é sempre do backend (sharp).
import { LIMITS, type UploadMimeType } from '@nfc-business/shared/constants';
import { IMAGE_SIGNATURE_BYTES, detectImageType } from '@nfc-business/shared/images';

export type ImageDimensionLimits = { minWidth: number; minHeight: number; maxWidth: number; maxHeight: number };

export type ImageValidationError =
  | 'file_too_large'
  | 'unsupported_file_type'
  | 'image_too_small'
  | 'image_too_large'
  | 'invalid_image';

export type ImageCheckResult =
  | { ok: true; type: UploadMimeType; width: number; height: number }
  | { ok: false; error: ImageValidationError };

/** Mede as dimensões de uma imagem. Injetável para os testes; por defeito usa o DOM. */
export type ImageMeasurer = (file: Blob) => Promise<{ width: number; height: number }>;

/** Verifica o tamanho e o tipo real (magic bytes) sem tocar no DOM. */
export async function checkSizeAndType(
  file: Blob,
): Promise<{ ok: true; type: UploadMimeType } | { ok: false; error: ImageValidationError }> {
  if (file.size > LIMITS.uploadMaxBytes) return { ok: false, error: 'file_too_large' };
  const header = new Uint8Array(await file.slice(0, IMAGE_SIGNATURE_BYTES).arrayBuffer());
  const type = detectImageType(header);
  if (type === null) return { ok: false, error: 'unsupported_file_type' };
  return { ok: true, type };
}

function checkDimensions(
  size: { width: number; height: number },
  limits: ImageDimensionLimits,
): ImageValidationError | null {
  if (size.width < 1 || size.height < 1) return 'invalid_image';
  if (size.width < limits.minWidth || size.height < limits.minHeight) return 'image_too_small';
  if (size.width > limits.maxWidth || size.height > limits.maxHeight) return 'image_too_large';
  return null;
}

/** Lê as dimensões de uma imagem no browser, carregando-a num `Image` a partir de um URL de objeto. */
export const measureImageElement: ImageMeasurer = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('invalid_image'));
    };
    image.src = url;
  });

/** Validação completa: tamanho, tipo real e dimensões. */
export async function checkImageFile(
  file: Blob,
  limits: ImageDimensionLimits,
  measure: ImageMeasurer = measureImageElement,
): Promise<ImageCheckResult> {
  const basic = await checkSizeAndType(file);
  if (!basic.ok) return basic;

  let size: { width: number; height: number };
  try {
    size = await measure(file);
  } catch {
    return { ok: false, error: 'invalid_image' };
  }

  const dimensionError = checkDimensions(size, limits);
  if (dimensionError) return { ok: false, error: dimensionError };
  return { ok: true, type: basic.type, width: size.width, height: size.height };
}

export const PHOTO_LIMITS: ImageDimensionLimits = LIMITS.photo;
export const LOGO_LIMITS: ImageDimensionLimits = LIMITS.logo;
