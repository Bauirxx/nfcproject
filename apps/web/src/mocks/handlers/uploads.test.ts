import { LIMITS } from '@nfc-business/shared/constants';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { api, errorCode, imageBytes, readJson, signIn, uploadImage, useMockServer } from './testing';
import { consumeUpload, uploadHandlers } from './uploads';

useMockServer(uploadHandlers);

interface Signed {
  fileId: string;
  uploadUrl: string;
}

async function sign(purpose: string, contentType: string, size: number): Promise<Response> {
  return api('POST', '/api/uploads/sign', { purpose, contentType, size });
}

async function signPng(size: number = 64): Promise<Signed> {
  const response = await sign('profile_photo', 'image/png', size);
  expect(response.status).toBe(200);
  return readJson<Signed>(response);
}

function put(url: string, bytes: Uint8Array<ArrayBuffer>, type: string = 'image/png'): Promise<Response> {
  return api('PUT', url, new Blob([bytes], { type }));
}

describe('POST /api/uploads/sign', () => {
  it('exige sessão', async () => {
    expect((await sign('profile_photo', 'image/png', 64)).status).toBe(401);
  });

  it('devolve um identificador e um URL de envio na mesma origem', async () => {
    signIn('u_paula');
    const { fileId, uploadUrl } = await signPng();
    expect(uploadUrl).toBe(`/api/uploads/${fileId}`);
    expect(getDb().uploads[fileId]).toMatchObject({ userId: 'u_paula', purpose: 'profile_photo', dataUrl: null });
  });

  it('aplica a permissão de cada tipo de upload', async () => {
    signIn('u_paula');
    expect((await sign('theme_logo', 'image/png', 64)).status).toBe(403);
    expect((await sign('company_logo', 'image/png', 64)).status).toBe(403);
    signIn('u_edu');
    expect((await sign('theme_logo', 'image/png', 64)).status).toBe(200);
    expect((await sign('company_logo', 'image/png', 64)).status).toBe(403);
    signIn('u_marta');
    expect((await sign('company_logo', 'image/png', 64)).status).toBe(200);
    expect((await sign('profile_photo', 'image/png', 64)).status).toBe(403);
  });

  it('recusa SVG, GIF e ficheiros acima de 2 MB', async () => {
    signIn('u_paula');
    expect((await sign('profile_photo', 'image/svg+xml', 64)).status).toBe(422);
    expect((await sign('profile_photo', 'image/gif', 64)).status).toBe(422);
    expect((await sign('profile_photo', 'image/png', LIMITS.uploadMaxBytes + 1)).status).toBe(422);
    expect((await sign('profile_photo', 'image/png', 0)).status).toBe(422);
  });
});

describe('PUT /api/uploads/:fileId', () => {
  it('guarda o ficheiro anunciado e só o aceita uma vez', async () => {
    signIn('u_paula');
    const { fileId, uploadUrl } = await signPng();
    const response = await put(uploadUrl, imageBytes('png'));
    expect(response.status).toBe(204);
    expect(getDb().uploads[fileId]?.dataUrl).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);

    const again = await put(uploadUrl, imageBytes('png'));
    expect(again.status).toBe(404);
  });

  it('não aceita uploads desconhecidos nem de outro utilizador', async () => {
    signIn('u_paula');
    expect((await put('/api/uploads/f_inexistente', imageBytes('png'))).status).toBe(404);
    const { uploadUrl } = await signPng();
    signIn('u_carlos');
    const response = await put(uploadUrl, imageBytes('png'));
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('not_found');
  });

  it('verifica o tipo pelos primeiros bytes, não pelo que o cliente diz', async () => {
    signIn('u_paula');
    const { uploadUrl } = await signPng();
    const jpegAsPng = await put(uploadUrl, imageBytes('jpeg'));
    expect(jpegAsPng.status).toBe(415);
    expect(await errorCode(jpegAsPng)).toBe('unsupported_file_type');

    const svg = await put(uploadUrl, imageBytes('svg'));
    expect(svg.status).toBe(415);

    const wrongHeader = await put(uploadUrl, imageBytes('png'), 'image/jpeg');
    expect(wrongHeader.status).toBe(415);

    // O upload continua pendente e aceita o ficheiro certo.
    expect((await put(uploadUrl, imageBytes('png'))).status).toBe(204);
  });

  it('exige o tamanho anunciado e respeita o limite de 2 MB', async () => {
    signIn('u_paula');
    const { uploadUrl } = await signPng(64);
    const bigger = await put(uploadUrl, imageBytes('png', 65));
    expect(bigger.status).toBe(422);
    expect(await errorCode(bigger)).toBe('invalid_file');

    const { uploadUrl: largeUrl } = await signPng(LIMITS.uploadMaxBytes);
    const tooLarge = await put(largeUrl, imageBytes('png', LIMITS.uploadMaxBytes + 1));
    expect(tooLarge.status).toBe(413);
    expect(await errorCode(tooLarge)).toBe('file_too_large');
  });

  it('aceita JPEG e WebP', async () => {
    signIn('u_paula');
    await expect(uploadImage('profile_photo', 'jpeg')).resolves.toMatch(/^f_/);
    await expect(uploadImage('profile_photo', 'webp')).resolves.toMatch(/^f_/);
  });
});

describe('consumeUpload', () => {
  it('devolve o URL da imagem uma única vez, só ao dono e para o fim certo', async () => {
    const paula = signIn('u_paula');
    const fileId = await uploadImage('profile_photo');
    const db = getDb();
    const carlos = db.users.find((user) => user.id === 'u_carlos');
    if (!carlos) throw new Error('utilizador de teste em falta');

    expect(() => consumeUpload(db, carlos, fileId, 'profile_photo')).toThrow();
    expect(() => consumeUpload(db, paula, fileId, 'theme_logo')).toThrow();
    expect(consumeUpload(db, paula, fileId, 'profile_photo')).toMatch(/^data:image\/png;base64,/);
    expect(db.uploads[fileId]).toBeUndefined();
    expect(() => consumeUpload(db, paula, fileId, 'profile_photo')).toThrow();
  });

  it('não aceita um upload que ainda não recebeu o ficheiro', async () => {
    const paula = signIn('u_paula');
    const { fileId } = await signPng();
    expect(() => consumeUpload(getDb(), paula, fileId, 'profile_photo')).toThrow();
  });
});
