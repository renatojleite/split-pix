export type EntryType = 'expense' | 'income' | 'transfer';
export type SplitMode = 'default' | 'equal' | 'percent' | 'exact';

export type Profile = { id: string; name: string; email: string | null };

export type Group = {
  id: string;
  name: string;
  icon: string;
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
};

export type Category = { id: string; group_id: string; name: string; icon: string; sort: number };

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
  occurred_on: string;
  split_mode: SplitMode;
  updated_by: string | null;
  updated_at: string;
  shares: EntryShare[];
};

export type Balance = { member_id: string; month: string; balance_cents: number };

export type InvitePreview = {
  group_id: string;
  name: string;
  icon: string;
  already_member: boolean;
  unclaimed: { id: string; display_name: string }[];
};
