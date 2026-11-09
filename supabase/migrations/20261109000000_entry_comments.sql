-- Comentários nos lançamentos: quem escreveu (participante), quando e o texto.
-- Leitura por RLS (membros do grupo); escrita só pelas funções abaixo.
-- Apagar é lógico (deleted_at), e só quem escreveu apaga.

create table if not exists public.entry_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  author_member_id uuid not null references public.group_members(id),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists entry_comments_group_idx on public.entry_comments (group_id, entry_id) where deleted_at is null;

alter table public.entry_comments enable row level security;

drop policy if exists "comentários: membros leem" on public.entry_comments;
create policy "comentários: membros leem" on public.entry_comments
  for select to authenticated using (is_member(group_id));

revoke all on public.entry_comments from anon, authenticated;
grant select on public.entry_comments to authenticated;

create or replace function public.add_entry_comment(p_entry_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_member uuid;
  v_id uuid;
begin
  select group_id into v_group from entries where id = p_entry_id and deleted_at is null;
  if v_group is null then raise exception 'Lançamento não encontrado'; end if;
  if not is_member(v_group) then raise exception 'Sem acesso ao grupo'; end if;
  select id into v_member from group_members where group_id = v_group and user_id = auth.uid() and left_at is null;
  if v_member is null then raise exception 'Sem acesso ao grupo'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'Escreva o comentário'; end if;
  insert into entry_comments (entry_id, group_id, author_member_id, body)
  values (p_entry_id, v_group, v_member, btrim(p_body))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.remove_entry_comment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c entry_comments%rowtype;
begin
  select * into v_c from entry_comments where id = p_id and deleted_at is null;
  if not found or not is_member(v_c.group_id) then raise exception 'Comentário não encontrado'; end if;
  if not exists (select 1 from group_members where id = v_c.author_member_id and user_id = auth.uid()) then
    raise exception 'Só quem escreveu pode apagar o comentário';
  end if;
  update entry_comments set deleted_at = now() where id = p_id;
end $$;

revoke execute on function public.add_entry_comment(uuid, text) from public, anon;
revoke execute on function public.remove_entry_comment(uuid) from public, anon;
grant execute on function public.add_entry_comment(uuid, text) to authenticated;
grant execute on function public.remove_entry_comment(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.entry_comments;
exception when duplicate_object or undefined_object then null;
end $$;
