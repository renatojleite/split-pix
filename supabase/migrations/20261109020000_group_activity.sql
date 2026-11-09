-- Novidades por grupo: quando cada pessoa abriu o grupo pela última vez, a data da
-- última atividade e quantos lançamentos outras pessoas incluíram desde então.

-- Quem já está no grupo começa "em dia" (sem uma enxurrada de novidades antigas).
alter table public.group_members add column if not exists last_seen_at timestamptz not null default now();

-- Marca o grupo como visto agora e devolve quando tinha sido visto antes
-- (o app destaca o que entrou depois disso).
create or replace function public.mark_group_seen(p_group_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_prev timestamptz;
begin
  if not is_member(p_group_id) then raise exception 'Sem acesso ao grupo'; end if;
  select last_seen_at into v_prev from group_members
   where group_id = p_group_id and user_id = auth.uid() and left_at is null;
  update group_members set last_seen_at = now()
   where group_id = p_group_id and user_id = auth.uid() and left_at is null;
  return v_prev;
end $$;

-- Para a Home: última atividade (lançamento criado, editado ou excluído) e novidades de outros.
create or replace function public.my_groups_activity()
returns table (group_id uuid, last_activity timestamptz, unseen int)
language sql stable security definer set search_path = public as $$
  select g.id,
         greatest(g.created_at, max(e.updated_at), max(e.deleted_at)),
         count(e.id) filter (where e.deleted_at is null and e.created_by is distinct from auth.uid()
                                and e.created_at > m.last_seen_at)::int
  from group_members m
  join groups g on g.id = m.group_id and g.deleted_at is null
  left join entries e on e.group_id = g.id
  where m.user_id = auth.uid() and m.left_at is null
  group by g.id, g.created_at, m.last_seen_at;
$$;

revoke execute on function public.mark_group_seen(uuid) from public, anon;
revoke execute on function public.my_groups_activity() from public, anon;
grant execute on function public.mark_group_seen(uuid) to authenticated;
grant execute on function public.my_groups_activity() to authenticated;
