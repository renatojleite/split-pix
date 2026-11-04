// Preferências guardadas só neste celular (localStorage via expo-sqlite).
// Chaves Pix aqui são só reserva: a oficial fica no grupo (group_members.pix_*).
import 'expo-sqlite/localStorage/install';
import { useState } from 'react';

import type { PixKeyType } from './pix';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem armazenamento: segue só na memória
  }
}

/** useState que persiste no aparelho. */
export function usePref<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  const set = (next: T) => {
    setValue(next);
    write(key, next);
  };
  return [value, set] as const;
}

export type PixProfile = { keyType: PixKeyType; key: string; name: string; city: string };

export const PREF = {
  peoplePinned: 'splitpix.group.peoplePinned',
  calendarOpen: 'splitpix.group.calendarOpen',
  pix: 'splitpix.pix.profile',
  /** Chaves Pix de outros membros (para pagar), por id do membro. */
  pixOthers: 'splitpix.pix.others',
} as const;
