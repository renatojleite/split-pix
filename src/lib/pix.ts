// Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central).
// O app só monta o código/QR; quem paga lê no app do banco. Não há confirmação.

export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random';

export const PIX_KEY_TYPES: { value: PixKeyType; label: string; placeholder: string; keyboard: 'default' | 'number-pad' | 'phone-pad' | 'email-address' }[] = [
  { value: 'cpf', label: 'CPF/CNPJ', placeholder: '000.000.000-00', keyboard: 'number-pad' },
  { value: 'phone', label: 'Celular', placeholder: '(11) 98765-4321', keyboard: 'phone-pad' },
  { value: 'email', label: 'E-mail', placeholder: 'voce@email.com', keyboard: 'email-address' },
  { value: 'random', label: 'Aleatória', placeholder: '123e4567-e89b-12d3-…', keyboard: 'default' },
];

export type PixInput = {
  keyType: PixKeyType;
  key: string;
  name: string; // recebedor
  city?: string;
  amountCents?: number; // vazio = quem paga digita o valor
  description?: string;
  txid?: string;
};

const field = (id: string, value: string) => `${id}${value.length.toString().padStart(2, '0')}${value}`;

/** Remove acentos e símbolos: o BR Code aceita só ASCII básico em nome/cidade. */
function ascii(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,\-/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max);
}

/** Formata a chave como o DICT espera. Lança erro com mensagem para o usuário. */
export function normalizePixKey(type: PixKeyType, raw: string): string {
  const key = raw.trim();
  const digits = key.replace(/\D/g, '');
  switch (type) {
    case 'cpf':
      if (digits.length === 11 || digits.length === 14) return digits;
      throw new Error('CPF tem 11 dígitos (CNPJ, 14).');
    case 'phone': {
      let d = digits.replace(/^0+/, '');
      if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
      if (d.length !== 10 && d.length !== 11) throw new Error('Celular com DDD: 11 dígitos, ex. 11 98765-4321.');
      return `+55${d}`;
    }
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) throw new Error('E-mail inválido.');
      return key.toLowerCase();
    case 'random':
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
        throw new Error('Chave aleatória tem o formato 123e4567-e89b-12d3-a456-426614174000.');
      }
      return key.toLowerCase();
  }
}

/** CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload(input: PixInput): string {
  const key = normalizePixKey(input.keyType, input.key);
  const name = ascii(input.name, 25) || 'RECEBEDOR';
  const city = ascii(input.city ?? '', 15) || 'BRASIL';
  const txid = (input.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  let account = field('00', 'br.gov.bcb.pix') + field('01', key);
  const desc = ascii(input.description ?? '', 40);
  // O campo 26 inteiro tem no máximo 99 caracteres; a descrição só entra se couber.
  if (desc && account.length + 4 + desc.length <= 99) account += field('02', desc);

  let payload =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (input.amountCents && input.amountCents > 0 ? field('54', (input.amountCents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', name) +
    field('60', city) +
    field('62', field('05', txid)) +
    '6304';
  payload += crc16(payload);
  return payload;
}
