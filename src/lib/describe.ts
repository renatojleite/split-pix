import { formatBRL } from './money';
import type { Member } from './types';

/** Saldo de quem está usando o app, em linguagem neutra: "A receber R$ …" / "A pagar R$ …". */
export function describeMyBalance(myBalance: number, _me?: Member | null, _members?: Member[]) {
  if (myBalance > 0) return { text: `A receber ${formatBRL(myBalance)}`, tone: 'positive' as const };
  if (myBalance < 0) return { text: `A pagar ${formatBRL(-myBalance)}`, tone: 'negative' as const };
  return { text: 'Tudo em dia', tone: 'neutral' as const };
}
