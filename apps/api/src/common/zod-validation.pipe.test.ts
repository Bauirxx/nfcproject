import { type ArgumentMetadata, UnprocessableEntityException } from '@nestjs/common';
import { loginRequestSchema } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from './zod-validation.pipe';

const bodyMeta: ArgumentMetadata = { type: 'body' };

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(loginRequestSchema);

  it('devolve os dados validados e normalizados pelo schema partilhado', () => {
    expect(pipe.transform({ email: '  Ana@Acme.Test ', password: 'segredo-qualquer' }, bodyMeta)).toEqual({
      email: 'ana@acme.test',
      password: 'segredo-qualquer',
    });
  });

  it('rejeita dados inválidos com 422 validation_failed', () => {
    expect(() => pipe.transform({ email: 'sem-arroba', password: 'x' }, bodyMeta)).toThrow(UnprocessableEntityException);
    expect(() => pipe.transform({ email: 'ana@acme.test' }, bodyMeta)).toThrow(UnprocessableEntityException);
    try {
      pipe.transform('não é objeto', bodyMeta);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual({ error: { code: 'validation_failed' } });
    }
  });
});
