// Leitor de comprovantes (Pix, transferência, boleto) a partir do TEXTO já extraído
// da imagem (OCR no aparelho) ou do PDF. Puro e sem rede: nada sai do celular.
//
// Devolve só o que vira campo do lançamento: valor, data e nomes. CPF, chave Pix,
// autenticação, ID da transação e instituição são ignorados — nunca retornados.

export type Confidence = 'high' | 'low';

export type ReceiptFields = {
  amountCents: number | null;
  amountConfidence: Confidence;
  date: string | null; // 'YYYY-MM-DD'
  dateConfidence: Confidence;
  /** Quem recebeu (Para / Destinatário / Favorecido…). */
  toName: string | null;
  /** Quem pagou (De / Pagador / Origem…). */
  fromName: string | null;
  method: 'pix' | 'ted' | 'boleto' | 'card' | null;
  /** Título sugerido para o lançamento, ex.: "Pix para Maria Souza". */
  title: string | null;
};

// ── texto ────────────────────────────────────────────────────────────────

/** Sem acento, minúsculo: para comparar rótulos. */
export function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function lines(text: string): string[] {
  return text
    .replace(/[   ]/g, ' ')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// ── valor ────────────────────────────────────────────────────────────────

const MONEY = /R\$\s*-?\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/g;
const MONEY_NO_SYMBOL = /^(?:valor[^:]*:?\s*)((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})$/;

function toCents(s: string): number {
  const [int, dec] = s.replace(/\./g, '').split(',');
  return Number(int) * 100 + Number(dec);
}

// Valores que aparecem em comprovante mas não são o pagamento.
const NOT_PAYMENT = /saldo|limite|disponivel|tarifa|juros|multa|desconto|cashback|parcela de|taxa/;

function findAmount(ls: string[]): { cents: number; confidence: Confidence } | null {
  type Cand = { cents: number; score: number; order: number };
  const cands: Cand[] = [];
  ls.forEach((line, i) => {
    const p = plain(line);
    // A linha anterior só conta se for um rótulo solto (sem valor próprio).
    const prevRaw = ls[i - 1] ?? '';
    const prev = /\d,\d{2}/.test(prevRaw) ? '' : plain(prevRaw);
    const push = (cents: number, base: number) => {
      let score = base;
      if (/valor|total|pago|pagou|enviad|transferid|recebid/.test(p)) score += 3;
      if (/^valor\b/.test(prev) || /^(valor|total)( pago| da transferencia| do pix)?:?$/.test(prev)) score += 3;
      if (/via pix|pix/.test(p)) score += 1;
      if (/^r\$\s*[\d.,]+$/.test(p)) score += 2; // sozinho na linha: costuma ser o destaque
      if (NOT_PAYMENT.test(p) || NOT_PAYMENT.test(prev)) score -= 6;
      if (/\bpago\b|total pago/.test(p)) score += 1; // boleto: "valor pago" vence "valor do documento"
      if (/documento|original/.test(p) && !/pago/.test(p)) score -= 1;
      cands.push({ cents, score, order: i });
    };
    for (const m of line.matchAll(MONEY)) push(toCents(m[1]), 1);
    const bare = p.match(MONEY_NO_SYMBOL);
    if (bare) push(toCents(bare[1]), 0);
  });
  const valid = cands.filter((c) => c.cents > 0 && c.score > -3);
  if (!valid.length) return null;
  valid.sort((a, b) => b.score - a.score || a.order - b.order);
  const best = valid[0];
  // Confiável se ganhou com folga ou se todos os candidatos concordam no valor.
  const sameValue = valid.every((c) => c.cents === best.cents);
  const margin = valid.length === 1 || sameValue || best.score - valid[1].score >= 2;
  return { cents: best.cents, confidence: best.score >= 3 && margin ? 'high' : 'low' };
}

// ── data ─────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6,
  jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
};

const iso = (y: number, m: number, d: number) => {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31/02 etc.
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

function datesIn(p: string): string[] {
  const out: string[] = [];
  for (const m of p.matchAll(/(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/g)) {
    const v = iso(Number(m[3]), Number(m[2]), Number(m[1])); if (v) out.push(v);
  }
  for (const m of p.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    const v = iso(Number(m[1]), Number(m[2]), Number(m[3])); if (v) out.push(v);
  }
  for (const m of p.matchAll(/(?<!\d)(\d{1,2})(?:\s+de)?\s+([a-z]{3,9})\.?(?:\s+de)?\s+(\d{4})(?!\d)/g)) {
    const mon = MONTHS[m[2]];
    if (mon) { const v = iso(Number(m[3]), mon, Number(m[1])); if (v) out.push(v); }
  }
  return out;
}

function findDate(ls: string[]): { date: string; confidence: Confidence } | null {
  type Cand = { date: string; score: number; order: number };
  const cands: Cand[] = [];
  ls.forEach((line, i) => {
    const p = plain(line);
    const prev = plain(ls[i - 1] ?? '');
    for (const d of datesIn(p)) {
      let score = 1;
      if (/realizad|efetuad|pagament|pago em|transferid|enviad|data( da| do)? (transacao|transferencia|pagamento|operacao)?|^data\b|em \d/.test(p)) score += 2;
      if (/^data\b|realizad|efetuad/.test(prev)) score += 2;
      if (/\d{1,2}:\d{2}/.test(p)) score += 1; // data com hora costuma ser a da operação
      if (/vencimento|nascimento|validade|emissao|agendad/.test(p) || /vencimento|nascimento|validade/.test(prev)) score -= 4;
      cands.push({ date: d, score, order: i });
    }
  });
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score || a.order - b.order);
  const best = cands[0];
  const agree = cands.every((c) => c.date === best.date || c.score < 0);
  return { date: best.date, confidence: best.score >= 3 || agree ? 'high' : 'low' };
}

// ── nomes ────────────────────────────────────────────────────────────────

const TO_LABELS = ['para', 'destinatario', 'recebedor', 'favorecido', 'beneficiario', 'quem recebeu', 'nome do recebedor', 'destino', 'pago a', 'enviado para'];
const FROM_LABELS = ['de', 'pagador', 'origem', 'remetente', 'quem pagou', 'quem enviou', 'nome do pagador', 'enviado por'];
// Linhas que nunca são um nome (dados do documento, banco, campos).
const NOT_A_NAME = /\b(cpf|cnpj|instituicao|banco|agencia|conta|chave|tipo|valor|data|autenticacao|id da|transacao|realizad|comprovante|pix|ted|doc|celular|telefone|e-?mail|nome|dados|central|ouvidoria|sac|via|ltda\.?\s*$)\b/;
const CONNECTORS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

function looksLikeName(s: string): boolean {
  if (s.length < 3 || s.length > 70) return false;
  if (/\d|[@*•]/.test(s)) return false;
  const words = s.split(' ');
  if (!words.every((w) => /^[\p{L}'.&-]+$/u.test(w))) return false;
  const p = plain(s);
  if (NOT_A_NAME.test(p) && !/ ltda\.?$| me$| s\.?a\.?$/.test(p)) return false;
  return words.filter((w) => !CONNECTORS.has(plain(w))).length >= 1 && /\p{L}{2}/u.test(s);
}

/** "MARIA APARECIDA DE SOUZA" → "Maria Aparecida de Souza" (mantém siglas curtas tipo LTDA, S.A.). */
export function nameCase(s: string): string {
  return s.split(' ').map((w, i) => {
    const lw = w.toLowerCase();
    if (i > 0 && CONNECTORS.has(lw)) return lw;
    if (/^(ltda|me|s\.?a\.?|eireli|epp)$/i.test(w)) return w.toUpperCase();
    return lw.replace(/(^|[-'])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  }).join(' ');
}

function labelValue(ls: string[], labels: string[]): string | null {
  for (let i = 0; i < ls.length; i++) {
    const p = plain(ls[i]).replace(/[:\-–]\s*$/, '').trim();
    for (const label of labels) {
      // Rótulo e valor na mesma linha: "Favorecido: Fulano"
      const inline = plain(ls[i]).match(new RegExp(`^${label}\\s*[:\\-–]\\s*(.+)$`));
      if (inline) {
        const raw = ls[i].slice(ls[i].length - inline[1].length).trim();
        if (looksLikeName(raw)) return raw;
      }
      // Rótulo sozinho e o nome nas linhas seguintes (pulando "Nome").
      if (p === label) {
        for (let j = i + 1; j < Math.min(i + 4, ls.length); j++) {
          const pj = plain(ls[j]).replace(/:$/, '');
          if (pj === 'nome' || pj === 'nome completo') continue;
          const fromNome = ls[j].match(/^nome\s*:\s*(.+)$/i);
          const cand = fromNome ? fromNome[1].trim() : ls[j];
          if (looksLikeName(cand)) return cand;
          break;
        }
      }
    }
  }
  return null;
}

/** Frases do tipo "Você pagou R$ 45,00 para Ana Lima". */
function sentenceName(text: string, word: 'para' | 'de'): string | null {
  const re = new RegExp(`\\b${word}\\s+(\\p{Lu}[\\p{L}'-]+(?:\\s+(?:de|da|do|dos|das|e|\\p{Lu}[\\p{L}'-]+))*)`, 'u');
  const m = text.replace(/\n/g, ' ').match(re);
  if (!m) return null;
  const name = m[1].replace(/\s+(?:de|da|do|dos|das|e)$/u, '');
  return looksLikeName(name) ? name : null;
}

// ── principal ────────────────────────────────────────────────────────────

export function parseReceipt(text: string): ReceiptFields {
  const ls = lines(text);
  const all = plain(ls.join('\n'));
  const amount = findAmount(ls);
  const date = findDate(ls);
  const toRaw = labelValue(ls, TO_LABELS) ?? sentenceName(ls.join('\n'), 'para');
  const fromRaw = labelValue(ls, FROM_LABELS);
  const toName = toRaw ? nameCase(toRaw) : null;
  const fromName = fromRaw && fromRaw !== toRaw ? nameCase(fromRaw) : null;

  const method: ReceiptFields['method'] =
    /\bpix\b/.test(all) ? 'pix'
    : /\bted\b|\bdoc\b/.test(all) ? 'ted'
    : /boleto|codigo de barras|linha digitavel/.test(all) ? 'boleto'
    : /cartao|credito|debito/.test(all) ? 'card'
    : null;

  const short = toName ? shortName(toName) : null;
  const title = short
    ? method === 'boleto' ? `Boleto ${short}` : method === 'pix' ? `Pix para ${short}` : `Pagamento para ${short}`
    : method === 'boleto' ? 'Boleto' : method === 'pix' ? 'Pix' : null;

  return {
    amountCents: amount?.cents ?? null,
    amountConfidence: amount?.confidence ?? 'low',
    date: date?.date ?? null,
    dateConfidence: date?.confidence ?? 'low',
    toName, fromName, method, title,
  };
}

/** Primeiro e último nome para o título ("Maria Aparecida de Souza Lima" → "Maria Lima"); empresa fica inteira. */
export function shortName(name: string): string {
  if (/\b(ltda|me|s\.?a\.?|eireli|epp)\b/i.test(name)) return name.slice(0, 40);
  const words = name.split(' ').filter((w) => !CONNECTORS.has(w.toLowerCase()));
  return words.length <= 2 ? words.join(' ') : `${words[0]} ${words[words.length - 1]}`;
}

/** Acha o participante do grupo pelo nome lido (primeiro nome ou nome do grupo contido no comprovante). */
export function matchMember<M extends { id: string; display_name: string }>(name: string | null, members: M[]): M | null {
  if (!name) return null;
  const n = plain(name);
  const first = n.split(' ')[0];
  const hits = members.filter((m) => {
    const d = plain(m.display_name).trim();
    return d === n || n.includes(d) || d.split(' ')[0] === first;
  });
  return hits.length === 1 ? hits[0] : null;
}

// ── texto para suporte, sem dados pessoais ───────────────────────────────

/**
 * Versão do texto lido que pode ser enviada para melhorar o leitor: troca nomes,
 * documentos, chaves e códigos por marcadores e mantém só a estrutura (rótulos,
 * valores e datas).
 */
export function redactReceipt(text: string): string {
  let hideNext = 0;
  return lines(text).map((line) => {
    const p = plain(line);
    if (hideNext > 0) { hideNext--; return looksLikeName(line) || /\d{4,}|[*•]/.test(line) || /^[a-z0-9]{10,}$/i.test(line) ? '[removido]' : line; }
    // Rótulo de dado sensível: esconde o valor (na linha ou na seguinte).
    const sens = p.match(/^(cpf|cnpj|chave( pix)?|autenticacao|id da transacao|codigo|agencia|conta|e2e|protocolo|nsu|identificador)\b[^:]*:?\s*(.*)$/);
    if (sens) {
      if (!sens[3]) { hideNext = 1; return line; }
      return `${line.slice(0, line.length - sens[3].length).trim()} [removido]`;
    }
    if (TO_LABELS.includes(p.replace(/:$/, '')) || FROM_LABELS.includes(p.replace(/:$/, ''))) hideNext = 2;
    return line
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]')
      .replace(/(?:[\d*•]{3}[.\s]?){3}-?[\d*•]{2}/g, '[documento]')
      .replace(/\b[A-Z0-9]{16,}\b/g, '[código]')
      .replace(/(?<![\d,.])\+?\d[\d\s()-]{9,}\d(?![\d,])/g, '[número]')
      .replace(new RegExp(`^(${[...TO_LABELS, ...FROM_LABELS].join('|')})\\s*[:\\-–]\\s*.+$`, 'i'), '$1: [nome]');
  }).join('\n');
}
