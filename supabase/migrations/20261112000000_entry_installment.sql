-- Parcela só informativa ("1/3"): não cria lançamentos nos próximos meses nem muda valores.

alter table public.entries
  add column if not exists installment_no smallint,
  add column if not exists installment_of smallint;

do $$ begin
  alter table public.entries add constraint entries_installment_chk check (
    (installment_no is null and installment_of is null)
    or (installment_of between 2 and 99 and installment_no between 1 and installment_of)
  );
exception when duplicate_object then null;
end $$;

-- Define (ou limpa, com nulos) a parcela de um lançamento.
create or replace function public.set_entry_installment(p_entry_id uuid, p_no int, p_of int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
begin
  select group_id into v_group from entries where id = p_entry_id and deleted_at is null;
  if v_group is null or not is_member(v_group) then raise exception 'Lançamento não encontrado'; end if;
  if (p_no is null) <> (p_of is null) then raise exception 'Informe a parcela e o total'; end if;
  if p_of is not null and (p_of < 2 or p_of > 99 or p_no < 1 or p_no > p_of) then
    raise exception 'Parcela inválida';
  end if;
  update entries set installment_no = p_no, installment_of = p_of, updated_by = auth.uid(), updated_at = now()
   where id = p_entry_id;
end $$;

revoke execute on function public.set_entry_installment(uuid, int, int) from public, anon;
grant execute on function public.set_entry_installment(uuid, int, int) to authenticated;
