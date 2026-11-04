import { formatBRL } from './money';
import type { Member } from './types';

/** Frase de saldo do ponto de vista de quem está usando o app. */
export function describeMyBalance(myBalance: number, me: Member | null, members: Member[]) {
  const others = members.filter((m) => m.id !== me?.id);
  const other = others.length === 1 ? others[0].display_name : null;
  if (myBalance > 0) {
    return { text: other ? `${other} te deve ${formatBRL(myBalance)}` : `Você tem a receber ${formatBRL(myBalance)}`, tone: 'positive' as const };
  }
  if (myBalance < 0) {
    return { text: other ? `Você deve ${formatBRL(-myBalance)} a ${other}` : `Você deve ${formatBRL(-myBalance)}`, tone: 'negative' as const };
  }
  return { text: 'Tudo certo, ninguém deve', tone: 'neutral' as const };
}
