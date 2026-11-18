import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_MFA_KEY = 'allowWithoutMfa';

/**
 * Rotas que um administrador sem MFA configurado pode usar (configurar o MFA, ver a conta, terminar sessão).
 * Tudo o resto exige o MFA configurado e verificado para os papéis que o tornam obrigatório (CLAUDE.md, regra 1).
 */
export const AllowWithoutMfa = () => SetMetadata(ALLOW_WITHOUT_MFA_KEY, true);
