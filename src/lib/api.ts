// Leituras via tabelas (protegidas por RLS) e escritas via funções do banco.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { addMonths } from './dates';
import { supabase } from './supabase';
import type {
  Balance, Category, Entry, EntryType, Group, InvitePreview, Member, Profile, RepeatEvery, Rule, SplitMode,
} from './types';

const keys = {
  profile: ['profile'] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  entries: (id: string, month: string) => ['group', id, 'entries', month] as const,
  entry: (id: string, entryId: string) => ['group', id, 'entry', entryId] as const,
  balances: (id: string) => ['group', id, 'balances'] as const,
};

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendly(res.error.message));
  return res.data as T;
}

/** Mensagens das RAISE EXCEPTION do banco já vêm em português; o resto vira genérico. */
function friendly(message: string) {
  if (/fetch|network/i.test(message)) return 'Sem conexão. Tente de novo.';
  if (/categories_group_id_name_key/.test(message)) return 'Já existe uma categoria com esse nome.';
  return message;
}

// ───────────── Perfil ─────────────

export function useProfile(userId: string) {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async () =>
      must(await supabase.from('profiles').select('id, name, email').eq('id', userId).single()) as Profile,
  });
}

export function useUpdateProfileName(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      must(await supabase.from('profiles').update({ name: name.trim() }).eq('id', userId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profile }),
  });
}

// ───────────── Grupos ─────────────

export type GroupSummary = Group & { members: Member[]; me: Member | null; myBalance: number };

export function useGroups(userId: string) {
  return useQuery({
    queryKey: keys.groups,
    queryFn: async (): Promise<GroupSummary[]> => {
      const groups = must(
        await supabase.from('groups').select('*, members:group_members(*)').order('created_at', { ascending: false }),
      ) as (Group & { members: Member[] })[];
      if (groups.length === 0) return [];
      const balances = must(
        await supabase.from('member_balances').select('member_id, balance_cents').in('group_id', groups.map((g) => g.id)),
      ) as { member_id: string; balance_cents: number }[];
      return groups.map((g) => {
        const me = g.members.find((m) => m.user_id === userId) ?? null;
        const myBalance = me
          ? balances.filter((b) => b.member_id === me.id).reduce((a, b) => a + Number(b.balance_cents), 0)
          : 0;
        const active = g.members.filter((m) => !m.left_at).sort((a, b) => a.position - b.position);
        return { ...g, members: active, me, myBalance };
      });
    },
  });
}

/** members = ativos (divisão, escolhas); allMembers inclui quem saiu (nomes no histórico). */
export type GroupDetail = { group: Group; members: Member[]; allMembers: Member[]; categories: Category[]; rules: Rule[] };

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: keys.group(groupId),
    queryFn: async (): Promise<GroupDetail> => {
      const [group, members, categories, rules] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase.from('group_members').select('*').eq('group_id', groupId).order('position'),
        supabase.from('categories').select('*').eq('group_id', groupId).order('sort'),
        supabase.from('split_rules').select('id, group_id, category_id, effective_from, shares:split_rule_shares(member_id, basis_points)').eq('group_id', groupId),
      ]);
      const all = must(members) as Member[];
      return {
        group: must(group) as Group,
        members: all.filter((m) => !m.left_at),
        allMembers: all,
        categories: must(categories) as Category[],
        rules: must(rules) as Rule[],
      };
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; emoji: string; myName: string; others: string[]; basisPoints: number[] }) =>
      must(
        await supabase.rpc('create_group', {
          p_name: input.name.trim(),
          p_emoji: input.emoji,
          p_my_name: input.myName.trim(),
          p_other_names: input.others.map((o) => o.trim()),
          p_basis_points: input.basisPoints,
        }),
      ) as string,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.groups });
      qc.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Group, 'name' | 'emoji' | 'archived_at'>>) =>
      must(await supabase.from('groups').update(patch).eq('id', groupId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.groups });
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
    },
  });
}

export function useDuplicateGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; emoji: string; copyEntries: boolean }) =>
      must(
        await supabase.rpc('duplicate_group', {
          p_group_id: groupId,
          p_name: input.name.trim(),
          p_emoji: input.emoji,
          p_copy_entries: input.copyEntries,
        }),
      ) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

export function useRenameMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, name }: { memberId: string; name: string }) =>
      must(await supabase.from('group_members').update({ display_name: name.trim() }).eq('id', memberId).select('id').single()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
      qc.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

/** Remove (ou sai do grupo). O banco exige saldo zerado e redistribui o %. */
export function useRemoveMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => must(await supabase.rpc('remove_member', { p_member_id: memberId })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
      qc.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

export function useRegenerateInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => must(await supabase.rpc('regenerate_invite', { p_group_id: groupId })) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.group(groupId) }),
  });
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  return must(await supabase.rpc('preview_invite', { p_code: code })) as InvitePreview;
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; memberId?: string; name?: string }) =>
      must(
        await supabase.rpc('accept_invite', {
          p_code: input.code,
          p_member_id: input.memberId ?? null,
          p_name: input.name ?? null,
        }),
      ) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

export function useAddMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      must(await supabase.rpc('add_member', { p_group_id: groupId, p_name: name })) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.group(groupId) }),
  });
}

export function useAddCategory(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, emoji }: { name: string; emoji: string }) =>
      must(
        await supabase
          .from('categories')
          .insert({ group_id: groupId, name: name.trim(), emoji, sort: 100 })
          .select('id')
          .single(),
      ) as { id: string },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.group(groupId) }),
  });
}

export function useUpdateCategory(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, emoji }: { id: string; name: string; emoji: string }) =>
      must(await supabase.from('categories').update({ name: name.trim(), emoji }).eq('id', id).select('id').single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.group(groupId) }),
  });
}

/** Excluir: lançamentos ficam "Sem categoria" e a regra de % da categoria some. */
export function useDeleteCategory(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from('categories').delete().eq('id', id).select('id');
      const rows = must(res) as { id: string }[];
      if (rows.length === 0) throw new Error('Não foi possível excluir a categoria.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
      qc.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

/** Quantos lançamentos ativos usam a categoria (para o aviso antes de excluir). */
export function useCategoryUsage(groupId: string, categoryId: string | null) {
  return useQuery({
    queryKey: [...keys.group(groupId), 'category-usage', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId!)
        .is('deleted_at', null);
      if (error) throw new Error(friendly(error.message));
      return count ?? 0;
    },
  });
}

// ───────────── Divisão ─────────────

export function useSetSplitRule(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoryId: string | null; effectiveFrom: string; shares: { memberId: string; bp: number }[] }) =>
      must(
        await supabase.rpc('set_split_rule', {
          p_group_id: groupId,
          p_category_id: input.categoryId,
          p_effective_from: input.effectiveFrom,
          p_member_ids: input.shares.map((s) => s.memberId),
          p_basis_points: input.shares.map((s) => s.bp),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.group(groupId) }),
  });
}

export function useClearCategoryRule(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) =>
      must(await supabase.rpc('clear_category_rule', { p_group_id: groupId, p_category_id: categoryId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.group(groupId) }),
  });
}

// ───────────── Lançamentos ─────────────

const ENTRY_COLUMNS =
  'id, group_id, type, title, emoji, amount_cents, paid_by, transfer_to, category_id, occurred_on, split_mode, recurrence_id, recurrence_index, recurrence_total, updated_by, updated_at, shares:entry_shares(member_id, share_cents, basis_points)';

export function useEntries(groupId: string, month: string) {
  return useQuery({
    queryKey: keys.entries(groupId, month),
    queryFn: async () =>
      must(
        await supabase
          .from('entries')
          .select(ENTRY_COLUMNS)
          .eq('group_id', groupId)
          .is('deleted_at', null)
          .gte('occurred_on', month)
          .lt('occurred_on', addMonths(month, 1))
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ) as Entry[],
  });
}

/** Todos os lançamentos do grupo (para o resumo acumulado). */
export function useAllEntries(groupId: string, enabled = true) {
  return useQuery({
    queryKey: keys.entries(groupId, 'all'),
    enabled,
    queryFn: async () =>
      must(
        await supabase
          .from('entries')
          .select(ENTRY_COLUMNS)
          .eq('group_id', groupId)
          .is('deleted_at', null)
          .order('occurred_on', { ascending: false }),
      ) as Entry[],
  });
}

export function useEntry(groupId: string, entryId: string | undefined) {
  return useQuery({
    queryKey: keys.entry(groupId, entryId ?? 'new'),
    enabled: !!entryId,
    queryFn: async () =>
      must(await supabase.from('entries').select(ENTRY_COLUMNS).eq('id', entryId!).single()) as Entry,
  });
}

export type SaveEntryInput = {
  id?: string;
  type: EntryType;
  title: string;
  amountCents: number;
  paidBy: string;
  transferTo?: string | null;
  categoryId?: string | null;
  occurredOn: string;
  splitMode: SplitMode;
  participants?: string[] | null;
  custom?: Record<string, number> | null;
  emoji?: string | null;
  repeatCount?: number;
  repeatEvery?: RepeatEvery;
};

export function useSaveEntry(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: SaveEntryInput) =>
      must(
        await supabase.rpc('save_entry', {
          p_group_id: groupId,
          p_id: e.id ?? null,
          p_type: e.type,
          p_title: e.title.trim(),
          p_amount_cents: e.amountCents,
          p_paid_by: e.paidBy,
          p_transfer_to: e.transferTo ?? null,
          p_category_id: e.categoryId ?? null,
          p_occurred_on: e.occurredOn,
          p_split_mode: e.splitMode,
          p_participants: e.participants ?? null,
          p_custom: e.custom ?? null,
          p_emoji: e.emoji ?? null,
          p_repeat_count: e.repeatCount ?? 1,
          p_repeat_every: e.repeatEvery ?? 'month',
        }),
      ) as string,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
      qc.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

export function useDeleteEntry(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, scope = 'one' }: { entryId: string; scope?: 'one' | 'following' }) =>
      must(await supabase.rpc('delete_entry', { p_id: entryId, p_scope: scope })) as number,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
      qc.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

// ───────────── Saldos ─────────────

export function useBalances(groupId: string) {
  return useQuery({
    queryKey: keys.balances(groupId),
    queryFn: async () =>
      (must(
        await supabase.from('member_balances').select('member_id, month, balance_cents').eq('group_id', groupId),
      ) as Balance[]).map((b) => ({ ...b, balance_cents: Number(b.balance_cents) })),
  });
}

// ───────────── Tempo real ─────────────

/** Qualquer mudança no grupo feita por outro membro recarrega as telas abertas. */
export function useGroupRealtime(groupId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
      qc.invalidateQueries({ queryKey: keys.groups });
    };
    const filter = `group_id=eq.${groupId}`;
    const channel = supabase
      .channel(`group:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_rules', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc]);
}
