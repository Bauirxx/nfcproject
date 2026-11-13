import { type ArgumentMetadata, Injectable, type PipeTransform, UnprocessableEntityException } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida o corpo ou a query de um pedido com um schema Zod partilhado (`@nfc-business/shared`, CLAUDE.md regra 7).
 * Em caso de erro responde 422 `validation_failed`, sem revelar os detalhes (ADR-0004 e ADR-0010).
 * Uso: `@Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest`.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new UnprocessableEntityException({ error: { code: 'validation_failed' } });
    return result.data;
  }
}
