import { LIMITS } from '@nfc-business/shared/constants';
import { describe, expect, it } from 'vitest';
import { PHOTO_LIMITS, checkImageFile, checkSizeAndType, type ImageMeasurer } from './image-validation';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Blob com uma assinatura de imagem no início e o tamanho pedido (preenchido com zeros). */
function imageBlob(signature: number[], type: string, size = 64): Blob {
  const bytes = new Uint8Array(Math.max(size, signature.length));
  bytes.set(signature);
  return new Blob([bytes], { type });
}

const measuring = (width: number, height: number): ImageMeasurer => () => Promise.resolve({ width, height });

describe('checkSizeAndType', () => {
  it('aceita JPEG, PNG e WebP pelo tipo real', async () => {
    expect(await checkSizeAndType(imageBlob(PNG, 'image/png'))).toEqual({ ok: true, type: 'image/png' });
    expect(await checkSizeAndType(imageBlob([0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'))).toEqual({ ok: true, type: 'image/jpeg' });
    const webp = imageBlob([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'image/webp', 16);
    expect(await checkSizeAndType(webp)).toEqual({ ok: true, type: 'image/webp' });
  });

  it('recusa ficheiros acima de 2 MB antes de ler os bytes', async () => {
    const big = new Blob([new Uint8Array(LIMITS.uploadMaxBytes + 1)], { type: 'image/png' });
    expect(await checkSizeAndType(big)).toEqual({ ok: false, error: 'file_too_large' });
  });

  it('recusa tipos que os magic bytes não confirmam (SVG, GIF, PNG falso)', async () => {
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' });
    expect(await checkSizeAndType(svg)).toEqual({ ok: false, error: 'unsupported_file_type' });
    const gif = imageBlob([0x47, 0x49, 0x46, 0x38], 'image/gif');
    expect(await checkSizeAndType(gif)).toEqual({ ok: false, error: 'unsupported_file_type' });
    // Diz ser PNG mas os bytes são de outra coisa.
    expect(await checkSizeAndType(imageBlob([1, 2, 3, 4], 'image/png'))).toEqual({ ok: false, error: 'unsupported_file_type' });
  });
});

describe('checkImageFile', () => {
  const valid = imageBlob(PNG, 'image/png');

  it('devolve as dimensões quando tudo está dentro dos limites', async () => {
    expect(await checkImageFile(valid, PHOTO_LIMITS, measuring(800, 600))).toEqual({
      ok: true,
      type: 'image/png',
      width: 800,
      height: 600,
    });
  });

  it('recusa imagens pequenas demais e grandes demais', async () => {
    expect(await checkImageFile(valid, PHOTO_LIMITS, measuring(100, 100))).toEqual({ ok: false, error: 'image_too_small' });
    expect(await checkImageFile(valid, PHOTO_LIMITS, measuring(5000, 300))).toEqual({ ok: false, error: 'image_too_large' });
    expect(await checkImageFile(valid, PHOTO_LIMITS, measuring(0, 0))).toEqual({ ok: false, error: 'invalid_image' });
  });

  it('trata o erro ao medir como imagem inválida', async () => {
    const failing: ImageMeasurer = () => Promise.reject(new Error('sem suporte'));
    expect(await checkImageFile(valid, PHOTO_LIMITS, failing)).toEqual({ ok: false, error: 'invalid_image' });
  });

  it('não chega a medir quando o tamanho ou o tipo já falham', async () => {
    let measured = false;
    const spy: ImageMeasurer = () => {
      measured = true;
      return Promise.resolve({ width: 800, height: 600 });
    };
    const result = await checkImageFile(imageBlob([1, 2, 3, 4], 'image/png'), PHOTO_LIMITS, spy);
    expect(result).toEqual({ ok: false, error: 'unsupported_file_type' });
    expect(measured).toBe(false);
  });
});
