-- Chave Pix por participante do grupo (visível só aos membros, via RLS de group_members).
-- Cada um cadastra a própria; a de quem ainda não tem conta qualquer membro cadastra.

alter table public.group_members
  add column if not exists pix_key_type text check (pix_key_type in ('cpf', 'phone', 'email', 'random')),
  add column if not exists pix_key text check (pix_key is null or char_length(pix_key) between 3 and 77),
  add column if not exists pix_name text check (pix_name is null or char_length(pix_name) between 1 and 40),
  add column if not exists pix_city text check (pix_city is null or char_length(pix_city) <= 30);

-- p_key_type nulo limpa a chave.
create or replace function public.set_member_pix(
  p_member_id uuid, p_key_type text, p_key text, p_name text, p_city text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m group_members%rowtype;
begin
  select * into v_m from group_members where id = p_member_id and left_at is null;
  if not found then raise exception 'Participante não encontrado'; end if;
  if not is_member(v_m.group_id) then raise exception 'Sem acesso ao grupo'; end if;
  if v_m.user_id is not null and v_m.user_id <> auth.uid() then
    raise exception 'Só % pode alterar a própria chave Pix', v_m.display_name;
  end if;
  update group_members set
    pix_key_type = p_key_type,
    pix_key = case when p_key_type is null then null else btrim(p_key) end,
    pix_name = case when p_key_type is null then null else nullif(btrim(p_name), '') end,
    pix_city = case when p_key_type is null then null else nullif(btrim(coalesce(p_city, '')), '') end
  where id = p_member_id;
end $$;

revoke execute on function public.set_member_pix(uuid, text, text, text, text) from public, anon;
grant execute on function public.set_member_pix(uuid, text, text, text, text) to authenticated;
