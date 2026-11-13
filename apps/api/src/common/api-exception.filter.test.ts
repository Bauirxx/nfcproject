import { ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { resolveError } from './api-exception.filter';

describe('resolveError', () => {
  it('usa o código próprio da exceção quando existe', () => {
    const exception = new HttpException({ error: { code: 'card_without_profile' } }, HttpStatus.CONFLICT);
    expect(resolveError(exception)).toEqual({ status: 409, code: 'card_without_profile' });
  });

  it('deriva um código genérico do estado quando não há código próprio', () => {
    expect(resolveError(new NotFoundException())).toEqual({ status: 404, code: 'not_found' });
    expect(resolveError(new ForbiddenException())).toEqual({ status: 403, code: 'forbidden' });
  });

  it('trata erros inesperados como 500 sem revelar detalhes', () => {
    expect(resolveError(new Error('ligação à base de dados falhou'))).toEqual({ status: 500, code: 'internal_error' });
    expect(resolveError('algo')).toEqual({ status: 500, code: 'internal_error' });
  });
});
