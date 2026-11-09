-- Ações em vários lançamentos: trocar categoria (recalculando a divisão) e duplicar
-- (no mesmo grupo ou em outro). Tudo passa por write_entry, a mesma regra do save_entry.

-- Como refazer a divisão atual de um lançamento: quem participa e os valores próprios.
create or replace function public.entry_split_args(p_entry_id uuid)
returns table (participants uuid[], custom jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  e entries%rowtype;
begin
  select * into e from entries where id = p_entry_id;
  if e.split_mode = 'percent' then
    return query select null::uuid[], jsonb_object_agg(s.member_id, s.basis_points)
      from entry_shares s where s.entry_id = e.id;
  elsif e.split_mode = 'exact' then
    return query select null::uuid[], jsonb_object_agg(s.member_id, s.share_cents)
      from entry_shares s where s.entry_id = e.id;
  elsif e.split_mode = 'equal' then
    return query select array_agg(s.member_id), null::jsonb
      from entry_shares s where s.entry_id = e.id and s.share_cents > 0;
  else
    -- Padrão: só manda a lista se alguém da regra tinha sido desmarcado no item.
    if exists (
      select 1 from effective_rule(e.group_id, e.category_id, e.occurred_on) r
      where r.basis_points > 0
        and not exists (select 1 from entry_shares s where s.entry_id = e.id and s.member_id = r.member_id and s.share_cents > 0)
    ) then
      return query select array_agg(s.member_id), null::jsonb
        from entry_shares s where s.entry_id = e.id and s.share_cents > 0;
    else
      return query select null::uuid[], null::jsonb;
    end if;
  end if;
end $$;

-- Troca a categoria dos lançamentos; no modo padrão a divisão segue a regra da nova categoria.
create or replace function public.set_entries_category(p_ids uuid[], p_category_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  e entries%rowtype;
  a record;
  v_count int := 0;
begin
  for e in select * from entries where id = any (p_ids) and deleted_at is null and type <> 'transfer' loop
    if not is_member(e.group_id) then raise exception 'Sem acesso ao grupo'; end if;
    if p_category_id is not null and not exists (select 1 from categories where id = p_category_id and group_id = e.group_id) then
      raise exception 'Categoria de outro grupo';
    end if;
    select * into a from entry_split_args(e.id);
    perform write_entry(e.id, e.group_id, e.type, e.title, e.emoji, e.amount_cents, e.paid_by, e.transfer_to,
      p_category_id, e.occurred_on, e.split_mode, a.participants, a.custom,
      e.recurrence_id, e.recurrence_index, e.recurrence_total);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Participante equivalente no grupo de destino: mesma conta, ou mesmo nome.
create or replace function public.map_member(p_member_id uuid, p_target_group uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from group_members s
  join group_members t on t.group_id = p_target_group and t.left_at is null
   and ((s.user_id is not null and t.user_id = s.user_id) or lower(btrim(t.display_name)) = lower(btrim(s.display_name)))
  where s.id = p_member_id
  order by (s.user_id is not null and t.user_id = s.user_id) desc
  limit 1;
$$;

-- Duplica lançamentos. No mesmo grupo: cópia fiel (mesma divisão). Em outro grupo:
-- quem pagou e categoria pelo equivalente (conta ou nome; senão você e sem categoria) e
-- a divisão padrão do grupo de destino. Acerto sem as duas pessoas no destino é pulado.
create or replace function public.duplicate_entries(p_ids uuid[], p_target_group uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  e entries%rowtype;
  a record;
  v_me uuid;
  v_payer uuid;
  v_to uuid;
  v_cat uuid;
  v_count int := 0;
begin
  if not is_member(p_target_group) then raise exception 'Sem acesso ao grupo de destino'; end if;
  select id into v_me from group_members where group_id = p_target_group and user_id = auth.uid() and left_at is null;

  for e in select * from entries where id = any (p_ids) and deleted_at is null order by occurred_on, created_at loop
    if not is_member(e.group_id) then raise exception 'Sem acesso ao grupo'; end if;

    if e.group_id = p_target_group then
      select * into a from entry_split_args(e.id);
      perform write_entry(null, e.group_id, e.type, e.title, e.emoji, e.amount_cents, e.paid_by, e.transfer_to,
        e.category_id, e.occurred_on, e.split_mode, a.participants, a.custom, null, null, null);
      v_count := v_count + 1;
      continue;
    end if;

    v_payer := coalesce(map_member(e.paid_by, p_target_group), v_me);
    v_to := case when e.type = 'transfer' then map_member(e.transfer_to, p_target_group) end;
    if e.type = 'transfer' and (v_to is null or v_to = v_payer) then continue; end if;
    select t.id into v_cat from categories s
      join categories t on t.group_id = p_target_group and lower(btrim(t.name)) = lower(btrim(s.name))
      where s.id = e.category_id limit 1;

    perform write_entry(null, p_target_group, e.type, e.title, e.emoji, e.amount_cents, v_payer, v_to,
      v_cat, e.occurred_on, 'default', null, null, null, null, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke execute on function public.entry_split_args(uuid) from public, anon, authenticated;
revoke execute on function public.map_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.set_entries_category(uuid[], uuid) from public, anon;
revoke execute on function public.duplicate_entries(uuid[], uuid) from public, anon;
grant execute on function public.set_entries_category(uuid[], uuid) to authenticated;
grant execute on function public.duplicate_entries(uuid[], uuid) to authenticated;
