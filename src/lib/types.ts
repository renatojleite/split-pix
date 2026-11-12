export type EntryType = 'expense' | 'income' | 'transfer';
export type RepeatEvery = 'month' | 'week';
export type SplitMode = 'default' | 'equal' | 'percent' | 'exact';

export type Profile = { id: string; name: string; email: string | null };

export type Group = {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  invite_code: string;
  created_by: string;
  archived_at: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  role: 'owner' | 'member';
  color: string;
  position: number;
  left_at: string | null; // saiu do grupo (histórico mantido)
  // Chave Pix para receber (visível só aos membros; altera via set_member_pix)
  pix_key_type: 'cpf' | 'phone' | 'email' | 'random' | null;
  pix_key: string | null;
  pix_name: string | null;
  pix_city: string | null;
};

export type Category = { id: string; group_id: string; name: string; emoji: string; sort: number };

export type RuleShare = { member_id: string; basis_points: number };

export type Rule = {
  id: string;
  group_id: string;
  category_id: string | null;
  effective_from: string; // YYYY-MM-DD
  shares: RuleShare[];
};

export type EntryShare = { member_id: string; share_cents: number; basis_points: number | null };

export type Entry = {
  id: string;
  group_id: string;
  type: EntryType;
  title: string;
  amount_cents: number;
  paid_by: string;
  transfer_to: string | null;
  category_id: string | null;
  emoji: string | null;
  occurred_on: string;
  split_mode: SplitMode;
  recurrence_id: string | null;
  recurrence_index: number | null;
  recurrence_total: number | null;
  updated_by: string | null;
  updated_at: string;
  created_by?: string | null; // conta que incluiu (destaque de novidades)
  created_at?: string;
  installment_no?: number | null; // parcela só informativa ("1/3")
  installment_of?: number | null;
  shares: EntryShare[];
};

export type Balance = { member_id: string; month: string; balance_cents: number };

export type InvitePreview = {
  group_id: string;
  name: string;
  emoji: string;
  already_member: boolean;
  unclaimed: { id: string; display_name: string }[];
};

export type EntryComment = {
  id: string;
  entry_id: string;
  group_id: string;
  author_member_id: string;
  body: string;
  created_at: string;
};
