-- split-pix: parte final do schema (cole no Supabase › SQL Editor › Run).
-- Estas funções contêm DELETE (remover cotas antigas ao editar, trocar regra de %),
-- por isso o Supabase pede aprovação manual. O resto do schema já foi aplicado.

create or replace function public.write_entry(
  p_id uuid, p_group_id uuid, p_type text, p_title text, p_emoji text,
  p_amount_cents bigint, p_paid_by uuid, p_transfer_to uuid, p_category_id uuid,
  p_occurred_on date, p_split_mode text, p_participants uuid[], p_custom jsonb,
  p_recurrence_id uuid, p_recurrence_index int, p_recurrence_total int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_members uuid[];
  v_bps int[];
  v_sum bigint;
begin
  if p_id is null then
    insert into entries (group_id, type, title, emoji, amount_cents, paid_by, transfer_to,
                         category_id, occurred_on, split_mode, created_by, updated_by,
                         recurrence_id, recurrence_index, recurrence_total)
    values (p_group_id, p_type, btrim(p_title), nullif(btrim(p_emoji), ''), p_amount_cents, p_paid_by,
            case when p_type = 'transfer' then p_transfer_to end,
            case when p_type = 'transfer' then null else p_category_id end,
            p_occurred_on, p_split_mode, v_uid, v_uid,
            p_recurrence_id, p_recurrence_index, p_recurrence_total)
    returning id into v_id;
  else
    update entries set
      type = p_type, title = btrim(p_title), emoji = nullif(btrim(p_emoji), ''),
      amount_cents = p_amount_cents, paid_by = p_paid_by,
      transfer_to = case when p_type = 'transfer' then p_transfer_to end,
      category_id = case when p_type = 'transfer' then null else p_category_id end,
      occurred_on = p_occurred_on, split_mode = p_split_mode,
      updated_by = v_uid, updated_at = now()
    where id = p_id and group_id = p_group_id and deleted_at is null
    returning id into v_id;
    if v_id is null then raise exception 'Lançamento não encontrado'; end if;
    delete from entry_shares where entry_id = v_id;
  end if;

  if p_type = 'transfer' then return v_id; end if;

  if p_split_mode = 'exact' then
    select array_agg(key::uuid), sum(value::bigint) into v_members, v_sum from jsonb_each_text(p_custom);
    if v_sum is distinct from p_amount_cents then raise exception 'Valores somam diferente do total'; end if;
    insert into entry_shares (entry_id, member_id, share_cents, basis_points)
    select v_id, key::uuid, value::bigint, round(value::bigint * 10000.0 / p_amount_cents)::int
    from jsonb_each_text(p_custom) where value::bigint > 0;
  else
    if p_split_mode = 'percent' then
      select array_agg(key::uuid), array_agg(value::int) into v_members, v_bps
      from jsonb_each_text(p_custom) where value::int > 0;
      select sum(value::int) into v_sum from jsonb_each_text(p_custom);
      if v_sum is distinct from 10000 then raise exception 'Percentuais devem somar 100%%'; end if;
    elsif p_split_mode = 'equal' then
      select array_agg(id order by position), array_agg(1) into v_members, v_bps
      from group_members where group_id = p_group_id and (p_participants is null or id = any (p_participants));
    else
      select array_agg(r.member_id), array_agg(r.basis_points) into v_members, v_bps
      from effective_rule(p_group_id, p_category_id, p_occurred_on) r
      where r.basis_points > 0 and (p_participants is null or r.member_id = any (p_participants));
    end if;
    insert into entry_shares (entry_id, member_id, share_cents, basis_points)
    select v_id, a.member_id, a.share_cents, a.basis_points
    from allocate_cents(p_amount_cents, v_members, v_bps, p_paid_by) a;
  end if;

  if exists (select 1 from entry_shares s where s.entry_id = v_id
             and s.member_id not in (select id from group_members where group_id = p_group_id)) then
    raise exception 'Participante de outro grupo';
  end if;
  return v_id;
end $$;

create or replace function public.delete_entry(p_id uuid, p_scope text default 'one')
returns int language plpgsql security definer set search_path = public as $$
declare
  v_entry entries%rowtype;
  v_count int;
begin
  select * into v_entry from entries where id = p_id;
  if v_entry.id is null or not is_member(v_entry.group_id) then raise exception 'Sem acesso'; end if;
  update entries set deleted_at = now(), updated_by = auth.uid(), updated_at = now()
  where deleted_at is null and (
    id = p_id
    or (p_scope = 'following' and v_entry.recurrence_id is not null
        and recurrence_id = v_entry.recurrence_id and recurrence_index >= v_entry.recurrence_index));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.set_split_rule(
  p_group_id uuid, p_category_id uuid, p_effective_from date, p_member_ids uuid[], p_basis_points int[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_rule uuid;
  v_sum int;
begin
  if not is_member(p_group_id) then raise exception 'Sem acesso ao grupo'; end if;
  if array_length(p_member_ids, 1) is distinct from array_length(p_basis_points, 1) then
    raise exception 'Um percentual por participante';
  end if;
  select sum(x) into v_sum from unnest(p_basis_points) x;
  if v_sum <> 10000 then raise exception 'Percentuais devem somar 100%%'; end if;
  if exists (select 1 from unnest(p_member_ids) m
             where m not in (select id from group_members where group_id = p_group_id)) then
    raise exception 'Participante de outro grupo';
  end if;
  insert into split_rules (group_id, category_id, effective_from, created_by)
  values (p_group_id, p_category_id, date_trunc('month', p_effective_from)::date, auth.uid())
  on conflict (group_id, category_id, effective_from)
  do update set created_by = excluded.created_by, created_at = now()
  returning id into v_rule;
  delete from split_rule_shares where rule_id = v_rule;
  insert into split_rule_shares (rule_id, member_id, basis_points)
  select v_rule, m, b from unnest(p_member_ids, p_basis_points) as t(m, b);
  return v_rule;
end $$;

create or replace function public.clear_category_rule(p_group_id uuid, p_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_group_id) then raise exception 'Sem acesso ao grupo'; end if;
  delete from split_rules where group_id = p_group_id and category_id = p_category_id;
end $$;

create policy "categorias: membros apagam" on public.categories
  for delete to authenticated using (is_member(group_id));

revoke execute on function public.write_entry(uuid, uuid, text, text, text, bigint, uuid, uuid, uuid, date, text, uuid[], jsonb, uuid, int, int) from public, anon, authenticated;
