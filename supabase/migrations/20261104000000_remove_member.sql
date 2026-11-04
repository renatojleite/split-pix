-- Remover participante sem apagar histórico: left_at marca a saída e o vínculo
-- com a conta é desfeito (perde acesso). Lançamentos antigos continuam com o nome.

alter table public.group_members add column if not exists left_at timestamptz;

-- Só ativos podem ser assumidos por convite.
create or replace function public.preview_invite(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_group groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into v_group from groups where invite_code = upper(btrim(p_code)) and archived_at is null;
  if not found then raise exception 'Código inválido'; end if;
  return jsonb_build_object(
    'group_id', v_group.id, 'name', v_group.name, 'emoji', v_group.emoji,
    'already_member', is_member(v_group.id),
    'unclaimed', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name) order by m.position)
      from group_members m where m.group_id = v_group.id and m.user_id is null and m.left_at is null
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.accept_invite(p_code text, p_member_id uuid default null, p_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_pos int;
  v_member uuid;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  select id into v_group from groups where invite_code = upper(btrim(p_code)) and archived_at is null;
  if v_group is null then raise exception 'Código inválido'; end if;
  if is_member(v_group) then return v_group; end if;

  if p_member_id is not null then
    update group_members set user_id = v_uid, joined_at = now()
    where id = p_member_id and group_id = v_group and user_id is null and left_at is null
    returning id into v_member;
    if v_member is null then raise exception 'Participante já foi assumido'; end if;
  else
    if coalesce(btrim(p_name), '') = '' then raise exception 'Informe seu nome'; end if;
    select coalesce(max(position) + 1, 0) into v_pos from group_members where group_id = v_group;
    insert into group_members (group_id, user_id, display_name, color, position)
    values (v_group, v_uid, btrim(p_name), member_color(v_pos), v_pos)
    returning id into v_member;
    insert into split_rule_shares (rule_id, member_id, basis_points)
    select r.id, v_member, 0 from split_rules r where r.group_id = v_group;
  end if;
  return v_group;
end $$;

-- Remove (ou sai do grupo). Exige saldo zerado e redistribui o % proporcionalmente.
create or replace function public.remove_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m group_members%rowtype;
  v_balance bigint;
  v_active int;
  v_total int;
  v_rest int;
  r record;
begin
  select * into v_m from group_members where id = p_member_id and left_at is null;
  if not found then raise exception 'Participante não encontrado'; end if;
  if not is_member(v_m.group_id) then raise exception 'Sem acesso ao grupo'; end if;
  if v_m.role = 'owner' then raise exception 'Quem criou o grupo não pode ser removido'; end if;
  if v_m.user_id is not null and v_m.user_id <> auth.uid() and not is_owner(v_m.group_id) then
    raise exception 'Só quem criou o grupo pode remover quem já usa o app';
  end if;

  select coalesce(sum(balance_cents), 0) into v_balance from member_balances where member_id = p_member_id;
  if v_balance <> 0 then
    raise exception 'O saldo de % ainda não está zerado. Registrem o acerto antes de remover.', v_m.display_name;
  end if;

  select count(*) into v_active from group_members
  where group_id = v_m.group_id and left_at is null and id <> p_member_id;
  if v_active = 0 then raise exception 'O grupo precisa de pelo menos uma pessoa'; end if;

  for r in
    select s.rule_id, s.basis_points from split_rule_shares s
    where s.member_id = p_member_id and s.basis_points > 0
  loop
    select coalesce(sum(s.basis_points), 0) into v_total
    from split_rule_shares s join group_members gm on gm.id = s.member_id
    where s.rule_id = r.rule_id and s.member_id <> p_member_id and gm.left_at is null;

    if v_total > 0 then
      update split_rule_shares s
      set basis_points = s.basis_points + (r.basis_points * s.basis_points / v_total)
      from group_members gm
      where gm.id = s.member_id and s.rule_id = r.rule_id and s.member_id <> p_member_id and gm.left_at is null;
    else
      insert into split_rule_shares (rule_id, member_id, basis_points)
      select r.rule_id, gm.id, r.basis_points / v_active
      from group_members gm
      where gm.group_id = v_m.group_id and gm.left_at is null and gm.id <> p_member_id
      on conflict (rule_id, member_id) do update set basis_points = split_rule_shares.basis_points + excluded.basis_points;
    end if;

    update split_rule_shares set basis_points = 0 where rule_id = r.rule_id and member_id = p_member_id;

    -- Sobra do arredondamento vai para quem tem o maior % (a regra volta a somar 100%).
    select 10000 - coalesce(sum(basis_points), 0) into v_rest from split_rule_shares where rule_id = r.rule_id;
    if v_rest <> 0 then
      update split_rule_shares set basis_points = basis_points + v_rest
      where rule_id = r.rule_id and member_id = (
        select s.member_id from split_rule_shares s join group_members gm on gm.id = s.member_id
        where s.rule_id = r.rule_id and gm.left_at is null and s.member_id <> p_member_id
        order by s.basis_points desc, gm.position limit 1);
    end if;
  end loop;

  update group_members set left_at = now(), user_id = null where id = p_member_id;
end $$;

revoke execute on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;

-- Duplicar grupo leva só quem está ativo.
create or replace function public.duplicate_group(
  p_group_id uuid, p_name text, p_emoji text default null, p_copy_entries boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_src groups%rowtype;
  v_new uuid;
  v_rule uuid;
  v_member uuid;
  r record;
begin
  if not is_member(p_group_id) then raise exception 'Sem acesso ao grupo'; end if;
  select * into v_src from groups where id = p_group_id;

  insert into groups (name, emoji, invite_code, created_by)
  values (btrim(p_name), coalesce(nullif(btrim(p_emoji), ''), v_src.emoji), gen_invite_code(), v_uid)
  returning id into v_new;

  create temp table member_map (old_id uuid primary key, new_id uuid) on commit drop;
  -- Ativos viram membros do grupo novo; com cópia de lançamentos, os que saíram
  -- também entram (já marcados como removidos) para o histórico fechar.
  for r in select * from group_members where group_id = p_group_id
           and (left_at is null or p_copy_entries) order by position loop
    insert into group_members (group_id, user_id, display_name, role, color, position, left_at)
    values (v_new, case when r.left_at is null then r.user_id end, r.display_name,
            case when r.user_id = v_uid then 'owner' else 'member' end, r.color, r.position, r.left_at)
    returning id into v_member;
    insert into member_map values (r.id, v_member);
  end loop;

  create temp table category_map (old_id uuid primary key, new_id uuid) on commit drop;
  insert into category_map select c.id, gen_random_uuid() from categories c where c.group_id = p_group_id;
  insert into categories (id, group_id, name, emoji, sort)
  select m.new_id, v_new, c.name, c.emoji, c.sort from categories c join category_map m on m.old_id = c.id;

  for r in
    select distinct on (coalesce(category_id::text, '')) id, category_id
    from split_rules
    where group_id = p_group_id and effective_from <= current_date
    order by coalesce(category_id::text, ''), effective_from desc
  loop
    insert into split_rules (group_id, category_id, effective_from, created_by)
    values (v_new, (select new_id from category_map where old_id = r.category_id), date '1900-01-01', v_uid)
    returning id into v_rule;
    insert into split_rule_shares (rule_id, member_id, basis_points)
    select v_rule, mm.new_id, s.basis_points
    from split_rule_shares s join member_map mm on mm.old_id = s.member_id
    where s.rule_id = r.id;
  end loop;

  if p_copy_entries then
    create temp table entry_map (old_id uuid primary key, new_id uuid) on commit drop;
    insert into entry_map
    select e.id, gen_random_uuid() from entries e where e.group_id = p_group_id and e.deleted_at is null;
    insert into entries (id, group_id, type, title, emoji, amount_cents, paid_by, transfer_to,
                         category_id, occurred_on, split_mode, created_by, updated_by)
    select em.new_id, v_new, e.type, e.title, e.emoji, e.amount_cents,
           (select new_id from member_map where old_id = e.paid_by),
           (select new_id from member_map where old_id = e.transfer_to),
           (select new_id from category_map where old_id = e.category_id),
           e.occurred_on, e.split_mode, v_uid, v_uid
    from entries e join entry_map em on em.old_id = e.id;
    insert into entry_shares (entry_id, member_id, share_cents, basis_points)
    select em.new_id, mm.new_id, s.share_cents, s.basis_points
    from entry_shares s
    join entry_map em on em.old_id = s.entry_id
    join member_map mm on mm.old_id = s.member_id;
  end if;

  return v_new;
end $$;
