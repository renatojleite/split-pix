-- split-pix · schema inicial
-- Valores em centavos (bigint). Percentuais em basis points (10000 = 100,00%).
-- Escritas sensíveis (grupo, membros, regras, lançamentos) passam por funções
-- SECURITY DEFINER que validam a participação; o app só lê direto das tabelas.


-- ───────────────────────────── Tabelas ─────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text,
  created_at  timestamptz not null default now()
);

create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 60),
  emoji        text not null default '🏠' check (char_length(emoji) between 1 and 16),
  currency     text not null default 'BRL',
  invite_code  text not null unique,
  created_by   uuid not null references public.profiles (id),
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table public.group_members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  role          text not null default 'member' check (role in ('owner', 'member')),
  color         text not null default '#2563EB',
  position      int  not null default 0,
  joined_at     timestamptz not null default now(),
  unique (group_id, user_id)
);
create index on public.group_members (user_id);

create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups (id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 30),
  emoji     text not null default '🏷️' check (char_length(emoji) between 1 and 16),
  sort      int  not null default 0,
  unique (group_id, name)
);

-- category_id nulo = padrão do grupo. A regra vigente para um lançamento é a
-- mais recente com effective_from <= data do lançamento.
create table public.split_rules (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups (id) on delete cascade,
  category_id     uuid references public.categories (id) on delete cascade,
  effective_from  date not null,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique nulls not distinct (group_id, category_id, effective_from)
);

create table public.split_rule_shares (
  rule_id        uuid not null references public.split_rules (id) on delete cascade,
  member_id      uuid not null references public.group_members (id) on delete cascade,
  basis_points   int  not null check (basis_points between 0 and 10000),
  primary key (rule_id, member_id)
);

create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  type          text not null check (type in ('expense', 'income', 'transfer')),
  title         text not null check (char_length(title) between 1 and 80),
  amount_cents  bigint not null check (amount_cents > 0),
  paid_by       uuid not null references public.group_members (id),
  transfer_to   uuid references public.group_members (id),
  category_id   uuid references public.categories (id) on delete set null,
  emoji         text check (emoji is null or char_length(emoji) between 1 and 16),
  -- Lançamento recorrente: cada ocorrência é uma linha; a série compartilha recurrence_id.
  recurrence_id     uuid,
  recurrence_index  int,
  recurrence_total  int,
  occurred_on   date not null default current_date,
  split_mode    text not null default 'default'
                check (split_mode in ('default', 'equal', 'percent', 'exact')),
  created_by    uuid references public.profiles (id),
  updated_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  check ((type = 'transfer') = (transfer_to is not null)),
  check (transfer_to is null or transfer_to <> paid_by)
);
create index on public.entries (group_id, occurred_on desc) where deleted_at is null;
create index on public.entries (recurrence_id) where recurrence_id is not null;

-- Cotas congeladas no momento do lançamento (histórico não muda se o % mudar).
create table public.entry_shares (
  entry_id      uuid not null references public.entries (id) on delete cascade,
  member_id     uuid not null references public.group_members (id),
  share_cents   bigint not null check (share_cents >= 0),
  basis_points  int,
  primary key (entry_id, member_id)
);

-- ───────────────────────────── Helpers ─────────────────────────────

create or replace function public.is_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.shares_group_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- 6 caracteres sem 0/O/1/I para não confundir na digitação.
create or replace function public.gen_invite_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function public.member_color(p_position int)
returns text language sql immutable as $$
  select (array['#2563EB', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#14B8A6',
                '#EC4899', '#64748B'])[1 + (p_position % 8)];
$$;

-- Perfil criado no primeiro login.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────── Divisão ─────────────────────────────

-- Regra vigente (category > padrão) para uma data. Retorna member_id → bp.
create or replace function public.effective_rule(
  p_group_id uuid, p_category_id uuid, p_on date
) returns table (member_id uuid, basis_points int)
language sql stable security definer set search_path = public as $$
  with chosen as (
    select r.id
    from split_rules r
    where r.group_id = p_group_id
      and r.effective_from <= p_on
      and (r.category_id = p_category_id or r.category_id is null)
    order by (r.category_id is null), r.effective_from desc
    limit 1
  )
  select s.member_id, s.basis_points
  from split_rule_shares s join chosen c on c.id = s.rule_id;
$$;

-- Distribui p_amount entre membros conforme basis points. Centavos de sobra
-- vão para quem pagou (se participar); senão para quem tem maior bp.
create or replace function public.allocate_cents(
  p_amount bigint, p_members uuid[], p_bps int[], p_payer uuid
) returns table (member_id uuid, share_cents bigint, basis_points int)
language plpgsql immutable as $$
declare
  total_bp int := 0;
  allocated bigint := 0;
  shares bigint[] := '{}';
  remainder bigint;
  target int;
  i int;
begin
  if coalesce(array_length(p_members, 1), 0) = 0 then
    raise exception 'Divisão sem participantes';
  end if;
  for i in 1..array_length(p_members, 1) loop
    total_bp := total_bp + p_bps[i];
  end loop;
  if total_bp <= 0 then
    raise exception 'Percentuais somam zero';
  end if;
  for i in 1..array_length(p_members, 1) loop
    shares := shares || ((p_amount * p_bps[i]) / total_bp);
    allocated := allocated + shares[i];
  end loop;
  remainder := p_amount - allocated;
  target := array_position(p_members, p_payer);
  if target is null or p_bps[target] = 0 then
    target := 1;
    for i in 2..array_length(p_members, 1) loop
      if p_bps[i] > p_bps[target] then target := i; end if;
    end loop;
  end if;
  shares[target] := shares[target] + remainder;
  for i in 1..array_length(p_members, 1) loop
    member_id := p_members[i];
    share_cents := shares[i];
    basis_points := round(p_bps[i] * 10000.0 / total_bp)::int;
    return next;
  end loop;
end $$;

-- ─────────────────────────── Saldos ───────────────────────────

-- Saldo por membro e mês: positivo = tem a receber.
create or replace view public.member_balances
with (security_invoker = true) as
with movements as (
  -- quem pagou uma despesa
  select e.group_id, e.paid_by as member_id, e.occurred_on, e.amount_cents as delta
  from entries e where e.deleted_at is null and e.type = 'expense'
  union all
  -- quem recebeu uma receita (dinheiro do grupo na mão dele)
  select e.group_id, e.paid_by, e.occurred_on, -e.amount_cents
  from entries e where e.deleted_at is null and e.type = 'income'
  union all
  -- cotas: despesa consome, receita credita
  select e.group_id, s.member_id, e.occurred_on,
         case when e.type = 'expense' then -s.share_cents else s.share_cents end
  from entries e join entry_shares s on s.entry_id = e.id
  where e.deleted_at is null and e.type in ('expense', 'income')
  union all
  -- transferência: quem enviou fica a receber, quem recebeu passa a dever
  select e.group_id, e.paid_by, e.occurred_on, e.amount_cents
  from entries e where e.deleted_at is null and e.type = 'transfer'
  union all
  select e.group_id, e.transfer_to, e.occurred_on, -e.amount_cents
  from entries e where e.deleted_at is null and e.type = 'transfer'
)
select group_id, member_id,
       date_trunc('month', occurred_on)::date as month,
       sum(delta)::bigint as balance_cents
from movements
group by group_id, member_id, date_trunc('month', occurred_on);

-- ─────────────────────────── RPCs ───────────────────────────

create or replace function public.create_group(
  p_name text,
  p_emoji text,
  p_my_name text,
  p_other_names text[],
  p_basis_points int[]      -- [eu, outros...] somando 10000
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_rule uuid;
  v_member uuid;
  v_names text[] := array[p_my_name] || coalesce(p_other_names, '{}');
  v_sum int := 0;
  i int;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  if array_length(p_basis_points, 1) is distinct from array_length(v_names, 1) then
    raise exception 'Um percentual por participante';
  end if;
  select sum(x) into v_sum from unnest(p_basis_points) x;
  if v_sum <> 10000 then raise exception 'Percentuais devem somar 100%%'; end if;

  update profiles set name = p_my_name where id = v_uid and name = '';

  insert into groups (name, emoji, invite_code, created_by)
  values (p_name, coalesce(nullif(btrim(p_emoji), ''), '🏠'), gen_invite_code(), v_uid)
  returning id into v_group;

  insert into categories (group_id, name, emoji, sort)
  select v_group, c.name, c.emoji, c.sort
  from (values ('Moradia', '🏠', 1), ('Mercado', '🛒', 2), ('Contas', '💡', 3),
               ('Filhos', '🧒', 4), ('Lazer', '🎉', 5), ('Transporte', '🚗', 6),
               ('Saúde', '💊', 7), ('Outros', '🏷️', 8)) as c(name, emoji, sort);

  insert into split_rules (group_id, category_id, effective_from, created_by)
  values (v_group, null, date '1900-01-01', v_uid)
  returning id into v_rule;

  for i in 1..array_length(v_names, 1) loop
    insert into group_members (group_id, user_id, display_name, role, color, position)
    values (v_group,
            case when i = 1 then v_uid end,
            btrim(v_names[i]),
            case when i = 1 then 'owner' else 'member' end,
            member_color(i - 1),
            i - 1)
    returning id into v_member;
    insert into split_rule_shares (rule_id, member_id, basis_points)
    values (v_rule, v_member, p_basis_points[i]);
  end loop;

  return v_group;
end $$;

-- Prévia do convite: nome do grupo e participantes ainda sem conta.
create or replace function public.preview_invite(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_group groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into v_group from groups
  where invite_code = upper(btrim(p_code)) and archived_at is null;
  if not found then raise exception 'Código inválido'; end if;
  return jsonb_build_object(
    'group_id', v_group.id,
    'name', v_group.name,
    'emoji', v_group.emoji,
    'already_member', is_member(v_group.id),
    'unclaimed', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name)
                       order by m.position)
      from group_members m where m.group_id = v_group.id and m.user_id is null
    ), '[]'::jsonb)
  );
end $$;

-- Entra no grupo assumindo um participante existente ("Sou a Paula")
-- ou criando um novo (com 0% nas regras até alguém ajustar a divisão).
create or replace function public.accept_invite(
  p_code text, p_member_id uuid default null, p_name text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_pos int;
  v_member uuid;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  select id into v_group from groups
  where invite_code = upper(btrim(p_code)) and archived_at is null;
  if v_group is null then raise exception 'Código inválido'; end if;
  if is_member(v_group) then return v_group; end if;

  if p_member_id is not null then
    update group_members set user_id = v_uid, joined_at = now()
    where id = p_member_id and group_id = v_group and user_id is null
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

create or replace function public.add_member(p_group_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_pos int;
  v_member uuid;
begin
  if not is_member(p_group_id) then raise exception 'Sem acesso ao grupo'; end if;
  select coalesce(max(position) + 1, 0) into v_pos from group_members where group_id = p_group_id;
  insert into group_members (group_id, display_name, color, position)
  values (p_group_id, btrim(p_name), member_color(v_pos), v_pos)
  returning id into v_member;
  insert into split_rule_shares (rule_id, member_id, basis_points)
  select r.id, v_member, 0 from split_rules r where r.group_id = p_group_id;
  return v_member;
end $$;

create or replace function public.regenerate_invite(p_group_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not is_owner(p_group_id) then raise exception 'Só quem criou o grupo pode trocar o código'; end if;
  v_code := gen_invite_code();
  update groups set invite_code = v_code where id = p_group_id;
  return v_code;
end $$;

-- Define o % do grupo (p_category_id nulo) ou de uma categoria a partir de um mês.
create or replace function public.set_split_rule(
  p_group_id uuid, p_category_id uuid, p_effective_from date,
  p_member_ids uuid[], p_basis_points int[]
) returns uuid
language plpgsql security definer set search_path = public as $$
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

-- Volta a categoria a seguir o padrão do grupo.
create or replace function public.clear_category_rule(p_group_id uuid, p_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_group_id) then raise exception 'Sem acesso ao grupo'; end if;
  delete from split_rules where group_id = p_group_id and category_id = p_category_id;
end $$;

-- Grava um lançamento (insert ou update) e suas cotas. Interna: sem checagem
-- de acesso, chamada só por save_entry / duplicate_group.
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

  if p_type = 'transfer' then
    return v_id;
  end if;

  if p_split_mode = 'exact' then
    select array_agg(key::uuid), sum(value::bigint)
      into v_members, v_sum
    from jsonb_each_text(p_custom);
    if v_sum is distinct from p_amount_cents then
      raise exception 'Valores somam diferente do total';
    end if;
    insert into entry_shares (entry_id, member_id, share_cents, basis_points)
    select v_id, key::uuid, value::bigint,
           round(value::bigint * 10000.0 / p_amount_cents)::int
    from jsonb_each_text(p_custom)
    where value::bigint > 0;
  else
    if p_split_mode = 'percent' then
      select array_agg(key::uuid), array_agg(value::int)
        into v_members, v_bps
      from jsonb_each_text(p_custom) where value::int > 0;
      select sum(value::int) into v_sum from jsonb_each_text(p_custom);
      if v_sum is distinct from 10000 then
        raise exception 'Percentuais devem somar 100%%';
      end if;
    elsif p_split_mode = 'equal' then
      select array_agg(id order by position), array_agg(1)
        into v_members, v_bps
      from group_members
      where group_id = p_group_id
        and (p_participants is null or id = any (p_participants));
    else -- 'default'
      select array_agg(r.member_id), array_agg(r.basis_points)
        into v_members, v_bps
      from effective_rule(p_group_id, p_category_id, p_occurred_on) r
      where r.basis_points > 0
        and (p_participants is null or r.member_id = any (p_participants));
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

-- Cria ou edita um lançamento e grava as cotas na mesma transação.
-- p_participants: quem entra na divisão (nulo = todos da regra).
-- p_custom: {member_id: bp} no modo 'percent' ou {member_id: centavos} no 'exact'.
-- p_repeat_count > 1 (só na criação): gera a série, uma ocorrência por mês ou
-- semana a partir de p_occurred_on. Cada ocorrência usa a regra vigente na sua data.
create or replace function public.save_entry(
  p_group_id uuid,
  p_type text,
  p_title text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_occurred_on date,
  p_id uuid default null,
  p_transfer_to uuid default null,
  p_category_id uuid default null,
  p_split_mode text default 'default',
  p_participants uuid[] default null,
  p_custom jsonb default null,
  p_emoji text default null,
  p_repeat_count int default 1,
  p_repeat_every text default 'month'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_first uuid;
  v_series uuid;
  v_step interval;
  i int;
begin
  if not is_member(p_group_id) then raise exception 'Sem acesso ao grupo'; end if;
  if not exists (select 1 from group_members where id = p_paid_by and group_id = p_group_id)
     or (p_transfer_to is not null and not exists (
           select 1 from group_members where id = p_transfer_to and group_id = p_group_id)) then
    raise exception 'Participante de outro grupo';
  end if;
  if p_category_id is not null and not exists (
       select 1 from categories where id = p_category_id and group_id = p_group_id) then
    raise exception 'Categoria de outro grupo';
  end if;

  if p_id is not null then
    -- Edição: só esta ocorrência; mantém o vínculo com a série.
    return write_entry(p_id, p_group_id, p_type, p_title, p_emoji, p_amount_cents, p_paid_by,
                       p_transfer_to, p_category_id, p_occurred_on, p_split_mode,
                       p_participants, p_custom, null, null, null);
  end if;

  if p_repeat_count is null or p_repeat_count < 1 or p_repeat_count > 36 then
    raise exception 'Repetição deve ser de 1 a 36 vezes';
  end if;
  if p_repeat_every not in ('month', 'week') then
    raise exception 'Repetição deve ser mensal ou semanal';
  end if;
  v_step := case p_repeat_every when 'week' then interval '1 week' else interval '1 month' end;
  v_series := case when p_repeat_count > 1 then gen_random_uuid() end;

  for i in 0 .. p_repeat_count - 1 loop
    if i = 0 then
      v_first := write_entry(null, p_group_id, p_type, p_title, p_emoji, p_amount_cents, p_paid_by,
                             p_transfer_to, p_category_id, p_occurred_on, p_split_mode,
                             p_participants, p_custom, v_series,
                             case when v_series is null then null else 1 end,
                             case when v_series is null then null else p_repeat_count end);
    else
      -- '31/jan + 1 mês' vira 28 ou 29/fev (o Postgres ajusta o fim do mês).
      perform write_entry(null, p_group_id, p_type, p_title, p_emoji, p_amount_cents, p_paid_by,
                          p_transfer_to, p_category_id, (p_occurred_on + i * v_step)::date,
                          p_split_mode, p_participants, p_custom, v_series, i + 1, p_repeat_count);
    end if;
  end loop;
  return v_first;
end $$;

-- p_scope 'one' apaga só este; 'following' apaga este e os próximos da série.
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
        and recurrence_id = v_entry.recurrence_id and recurrence_index >= v_entry.recurrence_index)
  );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Novo grupo com as mesmas pessoas (inclusive quem já tem conta), categorias e
-- divisão vigente hoje. Útil para "um grupo por mês" ou uma viagem nova.
-- Com p_copy_entries, copia também os lançamentos com as cotas originais.
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

  -- Mapa membro antigo → novo; quem duplica vira dono do grupo novo.
  create temp table member_map (old_id uuid primary key, new_id uuid) on commit drop;
  for r in select * from group_members where group_id = p_group_id order by position loop
    insert into group_members (group_id, user_id, display_name, role, color, position)
    values (v_new, r.user_id, r.display_name,
            case when r.user_id = v_uid then 'owner' else 'member' end, r.color, r.position)
    returning id into v_member;
    insert into member_map values (r.id, v_member);
  end loop;

  create temp table category_map (old_id uuid primary key, new_id uuid) on commit drop;
  insert into category_map
  select c.id, gen_random_uuid() from categories c where c.group_id = p_group_id;
  insert into categories (id, group_id, name, emoji, sort)
  select m.new_id, v_new, c.name, c.emoji, c.sort
  from categories c join category_map m on m.old_id = c.id;

  -- Regras vigentes hoje (padrão + cada categoria com regra própria), valendo desde sempre.
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
    -- Copia lançamentos e cotas como estão (histórico congelado, sem recalcular).
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

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.categories        enable row level security;
alter table public.split_rules       enable row level security;
alter table public.split_rule_shares enable row level security;
alter table public.entries           enable row level security;
alter table public.entry_shares      enable row level security;

create policy "perfil: ver o meu e de quem divide grupo comigo" on public.profiles
  for select to authenticated using (id = auth.uid() or shares_group_with(id));
create policy "perfil: editar o meu" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "grupo: membros veem" on public.groups
  for select to authenticated using (is_member(id));
create policy "grupo: dono edita" on public.groups
  for update to authenticated using (is_owner(id)) with check (is_owner(id));

create policy "membros: membros veem" on public.group_members
  for select to authenticated using (is_member(group_id));
create policy "membros: renomear" on public.group_members
  for update to authenticated using (is_member(group_id)) with check (is_member(group_id));

create policy "categorias: membros veem" on public.categories
  for select to authenticated using (is_member(group_id));
create policy "categorias: membros criam" on public.categories
  for insert to authenticated with check (is_member(group_id));
create policy "categorias: membros editam" on public.categories
  for update to authenticated using (is_member(group_id)) with check (is_member(group_id));
create policy "categorias: membros apagam" on public.categories
  for delete to authenticated using (is_member(group_id));

create policy "regras: membros veem" on public.split_rules
  for select to authenticated using (is_member(group_id));
create policy "regras (cotas): membros veem" on public.split_rule_shares
  for select to authenticated using (
    exists (select 1 from split_rules r where r.id = rule_id and is_member(r.group_id)));

create policy "lançamentos: membros veem" on public.entries
  for select to authenticated using (is_member(group_id));
create policy "cotas: membros veem" on public.entry_shares
  for select to authenticated using (
    exists (select 1 from entries e where e.id = entry_id and is_member(e.group_id)));

-- Colunas que o cliente pode alterar direto (o resto só via RPC).
revoke update on public.groups from authenticated;
grant update (name, emoji, archived_at) on public.groups to authenticated;
revoke update on public.group_members from authenticated;
grant update (display_name) on public.group_members to authenticated;
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

-- Funções internas não ficam expostas na API.
revoke execute on function public.allocate_cents(bigint, uuid[], int[], uuid) from public, anon, authenticated;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;
revoke execute on function public.write_entry(uuid, uuid, text, text, text, bigint, uuid, uuid, uuid, date, text, uuid[], jsonb, uuid, int, int) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.effective_rule(uuid, uuid, date) from public, anon;

-- ─────────────────────────── Realtime ───────────────────────────

alter publication supabase_realtime add table
  public.entries, public.entry_shares, public.group_members,
  public.split_rules, public.split_rule_shares, public.categories, public.groups;

-- ─────────────────────────── Endurecimento ───────────────────────────
-- (apontado pelo linter de segurança do Supabase)

alter function public.member_color(int) set search_path = public;
alter function public.allocate_cents(bigint, uuid[], int[], uuid) set search_path = public;

-- Nada da API roda sem login; só o necessário fica liberado para quem entrou.
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.is_member(uuid), public.is_owner(uuid), public.shares_group_with(uuid),
  public.effective_rule(uuid, uuid, date), public.member_color(int),
  public.create_group(text, text, text, text[], int[]),
  public.preview_invite(text), public.accept_invite(text, uuid, text),
  public.add_member(uuid, text), public.regenerate_invite(uuid),
  public.set_split_rule(uuid, uuid, date, uuid[], int[]),
  public.clear_category_rule(uuid, uuid),
  public.save_entry(uuid, text, text, bigint, uuid, date, uuid, uuid, uuid, text, uuid[], jsonb, text, int, text),
  public.delete_entry(uuid, text),
  public.duplicate_group(uuid, text, text, boolean)
to authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;
