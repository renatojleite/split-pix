-- Excluir grupo (só quem criou). Exclusão lógica: marca deleted_at e o grupo some
-- para todos, porque is_member/is_owner (base de todas as RLS) passam a ignorá-lo.
-- Nada é apagado de fato, então dá para recuperar pelo suporte se foi engano.

alter table public.groups add column if not exists deleted_at timestamptz;

create or replace function public.is_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members gm join groups g on g.id = gm.group_id
    where gm.group_id = p_group_id and gm.user_id = auth.uid() and g.deleted_at is null
  );
$$;

create or replace function public.is_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members gm join groups g on g.id = gm.group_id
    where gm.group_id = p_group_id and gm.user_id = auth.uid() and gm.role = 'owner' and g.deleted_at is null
  );
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(p_group_id) then
    raise exception 'Só quem criou o grupo pode excluir';
  end if;
  -- archived_at também: o código de convite para de funcionar.
  update groups set deleted_at = now(), archived_at = coalesce(archived_at, now()) where id = p_group_id;
end $$;

revoke execute on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;
