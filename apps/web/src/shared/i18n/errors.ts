// Mensagens de erro da interface. São sempre genéricas e escolhidas pelo código ou pelo estado HTTP:
// o texto devolvido pelo servidor nunca é mostrado (docs/prompts/FRONTEND.md, «Segurança no frontend»).
import { LIMITS } from '@nfc-business/shared/constants';
import { isApiError } from '@/shared/api/errors';
import { formatDuration } from './format';

export const errorTexts = {
  generic: 'Não foi possível concluir o pedido. Tente novamente.',
  network: 'Sem ligação ao servidor. Verifique a internet e tente novamente.',
  forbidden: 'Não tem permissão para fazer esta ação.',
  notFound: 'Não encontrámos o que procura.',
  sessionEnded: 'A sua sessão terminou. Inicie sessão novamente.',
  invalidData: 'Os dados não foram aceites. Reveja o formulário e tente novamente.',
  tooLarge: 'O ficheiro ou os dados enviados são demasiado grandes.',
  rateLimited: 'Demasiados pedidos seguidos. Aguarde um pouco e tente novamente.',
  rateLimitedWait: (wait: string) => `Demasiados pedidos seguidos. Tente novamente dentro de ${wait}.`,
  sendLimit: {
    hour: `Atingiu o limite de ${LIMITS.sharesPerHour} envios por hora.`,
    day: `Atingiu o limite de ${LIMITS.sharesPerDay} envios por dia.`,
    company: 'A sua empresa atingiu o limite de envios.',
  },
  sendLimitWait: (wait: string) => `Pode voltar a enviar dentro de ${wait}.`,
  sendLimitLater: 'Tente novamente mais tarde.',
} as const;

const byCode: Record<string, string> = {
  invalid_credentials: 'Email ou palavra-passe incorretos.',
  invalid_code: 'O código não está correto ou já expirou. Tente novamente.',
  mfa_challenge_expired: 'O início de sessão expirou. Entre novamente para continuar.',
  invalid_token: 'Este link não é válido ou já expirou. Peça um novo.',
  invalid_current_password: 'A palavra-passe atual não está correta.',
  weak_password: 'Esta palavra-passe aparece em listas de palavras-passe expostas. Escolha outra.',
  already_member: 'Já existe um membro ou convite com este email.',
  last_admin: 'A empresa tem de manter pelo menos um administrador.',
  invalid_transition: 'O estado atual do cartão não permite esta ação.',
  mfa_required_for_role: 'Os administradores não podem desativar a verificação em dois passos.',
  profile_without_card: 'Este perfil ainda não tem um cartão ativo para partilhar.',
  upload_rejected: 'A imagem não foi aceite. Use JPEG, PNG ou WebP até 2 MB.',
  csrf_invalid: 'O pedido não pôde ser validado. Atualize a página e tente novamente.',
};

/** Texto a mostrar ao utilizador para qualquer erro de um pedido à API. */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return errorTexts.generic;

  if (error.status === 429) {
    const wait = error.retryAfter === undefined ? null : formatDuration(error.retryAfter);
    if (error.scope) {
      return `${errorTexts.sendLimit[error.scope]} ${wait ? errorTexts.sendLimitWait(wait) : errorTexts.sendLimitLater}`;
    }
    return wait ? errorTexts.rateLimitedWait(wait) : errorTexts.rateLimited;
  }

  const known = byCode[error.code];
  if (known) return known;

  switch (error.status) {
    case 0:
      return errorTexts.network;
    case 400:
    case 422:
      return errorTexts.invalidData;
    case 401:
      return errorTexts.sessionEnded;
    case 403:
      return errorTexts.forbidden;
    case 404:
      return errorTexts.notFound;
    case 413:
      return errorTexts.tooLarge;
    default:
      return errorTexts.generic;
  }
}
