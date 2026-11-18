import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_DIMENSION, processImage } from './image-processing';
import { checkUploadBytes } from './uploads.service';

/** JPEG real de 1600x1200 com EXIF (incluindo GPS) para verificar que o processamento o remove. */
async function jpegWithExif(): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#3366cc' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'Segredo do autor', Artist: 'Fulano' }, IFD3: { GPSLatitudeRef: 'S' } })
    .toBuffer();
  return new Uint8Array(buffer);
}

describe('processImage', () => {
  it('re-codifica em WebP, limita as dimensões e remove o EXIF', async () => {
    const input = await jpegWithExif();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const output = await processImage(input, 'profile_photo');
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(MAX_DIMENSION.profile_photo);
    expect(meta.exif).toBeUndefined();
    expect(Buffer.from(output).includes(Buffer.from('Segredo do autor'))).toBe(false);
  });

  it('não aumenta imagens pequenas e recusa bytes que não são uma imagem válida', async () => {
    const small = new Uint8Array(await sharp({ create: { width: 120, height: 80, channels: 3, background: '#fff' } }).png().toBuffer());
    const meta = await sharp(await processImage(small, 'company_logo')).metadata();
    expect([meta.width, meta.height]).toEqual([120, 80]);

    const truncated = small.slice(0, 40);
    await expect(processImage(truncated, 'theme_logo')).rejects.toThrow();
  });
});

describe('checkUploadBytes', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  it('aceita o tipo confirmado pelos magic bytes e igual ao declarado', () => {
    expect(checkUploadBytes(png, { size: png.length, contentType: 'image/png' }, 'image/png')).toBeNull();
  });

  it('recusa SVG, tipo disfarçado, tamanho diferente do anunciado e ficheiros acima de 2 MB', () => {
    expect(checkUploadBytes(svg, { size: svg.length, contentType: 'image/png' }, 'image/png')).toEqual({
      status: 415,
      code: 'unsupported_file_type',
    });
    expect(checkUploadBytes(png, { size: png.length, contentType: 'image/jpeg' }, 'image/jpeg')).toMatchObject({ status: 415 });
    expect(checkUploadBytes(png, { size: png.length, contentType: 'image/png' }, 'text/html')).toMatchObject({ status: 415 });
    expect(checkUploadBytes(png, { size: png.length + 1, contentType: 'image/png' }, 'image/png')).toEqual({
      status: 422,
      code: 'invalid_file',
    });
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    expect(checkUploadBytes(big, { size: big.length, contentType: 'image/png' }, 'image/png')).toEqual({
      status: 413,
      code: 'file_too_large',
    });
  });
});
