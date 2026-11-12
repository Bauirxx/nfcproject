import { describe, expect, it } from 'vitest';
import { detectImageType, IMAGE_SIGNATURE_BYTES, isUploadMimeType } from './images';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));

describe('detectImageType', () => {
  it('reconhece JPEG, PNG e WebP pelos primeiros bytes', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toBe('image/jpeg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe('image/png');
    expect(detectImageType(bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WEBP')))).toBe('image/webp');
  });

  it('recusa SVG, GIF e outros ficheiros', () => {
    expect(detectImageType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(detectImageType(bytes(...ascii('<?xml version="1.0"?>')))).toBeNull();
    expect(detectImageType(bytes(...ascii('GIF89a'), 0x01, 0x00))).toBeNull();
    // RIFF que não é WebP (por exemplo, um WAV).
    expect(detectImageType(bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WAVE')))).toBeNull();
  });

  it('recusa ficheiros vazios ou truncados', () => {
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(detectImageType(bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WEB')))).toBeNull();
  });

  it('precisa apenas dos primeiros bytes', () => {
    const webp = bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WEBP'), 0x01, 0x02);
    expect(detectImageType(webp.slice(0, IMAGE_SIGNATURE_BYTES))).toBe('image/webp');
  });
});

describe('isUploadMimeType', () => {
  it('aceita só os tipos permitidos', () => {
    expect(isUploadMimeType('image/jpeg')).toBe(true);
    expect(isUploadMimeType('image/png')).toBe(true);
    expect(isUploadMimeType('image/webp')).toBe(true);
    expect(isUploadMimeType('image/svg+xml')).toBe(false);
    expect(isUploadMimeType('image/gif')).toBe(false);
  });
});
