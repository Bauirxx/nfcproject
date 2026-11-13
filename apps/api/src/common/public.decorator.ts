import { SetMetadata } from '@nestjs/common';

/** Chave de metadados que marca uma rota como pública (sem autenticação). */
export const IS_PUBLIC_KEY = 'nfc:isPublic';

/**
 * Marca um controlador ou um handler como público. Tudo o que não estiver marcado exige sessão
 * (guard global com negar por defeito, CLAUDE.md regra 2 e critério de saída da fase 1).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
