// Os schemas partilhados devolvem códigos estáveis (por exemplo `invalid_email`); aqui cada código ganha texto.
import { LIMITS } from '@nfc-business/shared/constants';

const FALLBACK = 'Valor inválido.';

const messages: Record<string, string> = {
  required: 'Preencha este campo.',
  too_short: 'O texto é demasiado curto.',
  too_long: 'O texto é demasiado longo.',
  invalid_email: 'Escreva um email válido, por exemplo nome@empresa.co.mz.',
  invalid_phone: 'Escreva um número de telefone válido, por exemplo +258 84 123 4567.',
  invalid_url: 'Escreva o endereço completo, começado por https://.',
  invalid_social_url: 'O link tem de começar por https:// e pertencer à rede social escolhida.',
  invalid_color: 'Escolha uma cor no formato #RRGGBB.',
  invalid_code: 'O código tem 6 dígitos.',
  invalid_recovery_code: 'O código de recuperação tem o formato XXXXX-XXXXX.',
  password_too_short: `A palavra-passe tem de ter pelo menos ${LIMITS.passwordMin} caracteres.`,
  password_too_long: `A palavra-passe pode ter até ${LIMITS.passwordMax} caracteres.`,
  password_mismatch: 'As duas palavras-passe não são iguais.',
  note_too_long: `A nota pode ter até ${LIMITS.noteMax} caracteres.`,
  note_invalid: 'A nota só pode ter texto simples, sem links nem HTML.',
  invalid_text: 'O texto tem caracteres que não são aceites.',
  invalid_location: 'Escreva uma morada ou local com pelo menos 3 caracteres.',
  recipient_required: 'Indique o destinatário.',
  too_many: 'Atingiu o número máximo de itens.',
  low_contrast_text: 'O texto não tem contraste suficiente sobre o fundo (mínimo 4,5:1).',
  low_contrast_primary: 'A cor principal não tem contraste suficiente sobre o fundo (mínimo 3:1).',
  file_too_large: 'O ficheiro tem mais de 2 MB.',
  invalid_value: FALLBACK,
};

/** Texto de um erro de validação. Códigos desconhecidos (ou mensagens internas do Zod) dão o texto genérico. */
export function validationMessage(code: string | undefined): string | undefined {
  if (code === undefined) return undefined;
  return messages[code] ?? FALLBACK;
}
