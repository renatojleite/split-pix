import { PGlite } from '@electric-sql/pglite';
// Roda as migrações num Postgres embutido (PGlite) com stubs do Supabase e
// testa cálculo, vigência das regras, convite e RLS.  npm run test:sql
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../migrations/', import.meta.url);
const migration = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
const db = new PGlite();

// Stubs mínimos do ambiente Supabase.
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  grant usage on schema auth to authenticated, anon;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public to authenticated, anon;
  alter default privileges in schema public grant all on tables to authenticated, anon;
  alter default privileges in schema public grant all on functions to authenticated, anon;
`);
try { await db.exec(migration); } catch (e) { console.log('MIGRATION ERR:', e.message, e.where ?? ''); process.exit(1); }

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users (id, email) values
  ('${A}', 'renato@x.com'), ('${B}', 'paula@x.com'), ('${C}', 'intruso@x.com');`);

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failures++; };

async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.sub', '${uid}', false); set role authenticated;`);
  return (await db.query(sql, params)).rows;
}
async function fails(uid, sql, params = []) {
  try { await as(uid, sql, params); return null; } catch (e) { return e.message; }
}

ok((await db.query('select count(*)::int n from profiles')).rows[0].n === 3, 'perfil criado por trigger');

const [{ g }] = await as(A, `select create_group('Casa', '🏠', 'Renato', array['Paula'], array[6000, 4000]) g`);
const members = await as(A, `select id, display_name, role from group_members where group_id = $1 order by position`, [g]);
const R = members[0].id, P = members[1].id;
ok(members.length === 2 && members[0].role === 'owner', 'grupo criado com dono + placeholder');
ok((await as(A, `select count(*)::int n from categories where group_id = $1`, [g]))[0].n === 8, '8 categorias semeadas');

const cat = async (name) => (await as(A, `select id from categories where group_id=$1 and name=$2`, [g, name]))[0].id;
const moradia = await cat('Moradia'), mercado = await cat('Mercado'), filhos = await cat('Filhos'), lazer = await cat('Lazer');

await as(A, `select set_split_rule($1, $2, '2026-10-01', array[$3, $4]::uuid[], array[5000, 5000])`, [g, moradia, R, P]);
await as(A, `select set_split_rule($1, $2, '2026-10-01', array[$3, $4]::uuid[], array[7000, 3000])`, [g, filhos, R, P]);

const save = (args) => as(A, `select save_entry(p_group_id => $1, p_type => $2, p_title => $3, p_amount_cents => $4,
  p_paid_by => $5, p_occurred_on => $6, p_category_id => $7, p_split_mode => $8, p_custom => $9, p_transfer_to => $10, p_id => $11) id`,
  [g, args.type ?? 'expense', args.title, args.amount, args.paidBy, args.on ?? '2026-10-15', args.cat ?? null,
   args.mode ?? 'default', args.custom ? JSON.stringify(args.custom) : null, args.to ?? null, args.id ?? null]);

// Exemplo do PRD
await save({ title: 'Aluguel', amount: 200000, paidBy: R, cat: moradia, on: '2026-10-05' });
await save({ title: 'Mercado', amount: 80000, paidBy: P, cat: mercado });
await save({ title: 'Natação Ber', amount: 35000, paidBy: R, cat: filhos, on: '2026-10-28' });
await save({ title: 'Jantar', amount: 20000, paidBy: P, cat: lazer, mode: 'equal', on: '2026-10-29' });

const bal = async (uid, month = '2026-10-01') => Object.fromEntries((await as(uid,
  `select member_id, sum(balance_cents)::bigint b from member_balances where group_id=$1 and month <= $2 group by member_id`, [g, month]))
  .map((r) => [r.member_id, Number(r.b)]));
let b = await bal(A);
ok(b[R] === 52500 && b[P] === -52500, `saldos do exemplo: Renato ${b[R]}, Paula ${b[P]}`);

const shares = await as(A, `select e.title, s.member_id, s.share_cents from entries e join entry_shares s on s.entry_id=e.id where e.title='Natação Ber'`);
ok(shares.find((s) => s.member_id === R).share_cents == 24500, 'Natação 70/30 → Renato R$ 245,00');

// Arredondamento: R$ 100,01 em 60/40, pago pela Paula → sobra fica com ela
const [{ id: odd }] = await save({ title: 'Ímpar', amount: 10001, paidBy: P, cat: mercado, on: '2026-11-02' });
const oddShares = await as(A, `select member_id, share_cents from entry_shares where entry_id=$1`, [odd]);
const sumOdd = oddShares.reduce((a, s) => a + Number(s.share_cents), 0);
ok(sumOdd === 10001, 'cotas somam o total exato');
ok(Number(oddShares.find((s) => s.member_id === P).share_cents) === 4001, 'centavo de sobra vai para quem pagou');

// Regra com vigência: mudar padrão em novembro não altera outubro
await as(A, `select set_split_rule($1, null, '2026-11-01', array[$2, $3]::uuid[], array[5000, 5000])`, [g, R, P]);
b = await bal(A);
ok(b[R] === 52500, 'histórico de outubro intacto após mudar o padrão');
const [{ id: nov }] = await save({ title: 'Farmácia', amount: 10000, paidBy: R, on: '2026-11-03' });
const novShares = await as(A, `select share_cents from entry_shares where entry_id=$1 and member_id=$2`, [nov, P]);
ok(Number(novShares[0].share_cents) === 5000, 'novembro usa o novo padrão 50/50');

// Modos percent e exact
const [{ id: pct }] = await save({ title: 'Pct', amount: 1000, paidBy: R, mode: 'percent', custom: { [R]: 2500, [P]: 7500 }, on: '2026-11-03' });
ok(Number((await as(A, `select share_cents from entry_shares where entry_id=$1 and member_id=$2`, [pct, P]))[0].share_cents) === 750, 'modo percentual');
ok(!!(await fails(A, `select save_entry($1,'expense','x',1000,$2,'2026-11-03', p_split_mode=>'percent', p_custom=>$3)`, [g, R, JSON.stringify({ [R]: 2500 })])), 'percentual que não soma 100% é recusado');
const [{ id: ex }] = await save({ title: 'Exato', amount: 1000, paidBy: R, mode: 'exact', custom: { [R]: 300, [P]: 700 }, on: '2026-11-03' });
ok(Number((await as(A, `select share_cents from entry_shares where entry_id=$1 and member_id=$2`, [ex, P]))[0].share_cents) === 700, 'modo valores exatos');
ok(!!(await fails(A, `select save_entry($1,'expense','x',1000,$2,'2026-11-03', p_split_mode=>'exact', p_custom=>$3)`, [g, R, JSON.stringify({ [R]: 300 })])), 'valores que não somam o total são recusados');

// Editar refaz as cotas
await save({ id: ex, title: 'Exato', amount: 2000, paidBy: R, mode: 'equal', on: '2026-11-03' });
ok(Number((await as(A, `select share_cents from entry_shares where entry_id=$1 and member_id=$2`, [ex, P]))[0].share_cents) === 1000, 'edição recalcula cotas');

// Convite: Paula entra assumindo o placeholder
const [{ code }] = await as(A, `select invite_code code from groups where id=$1`, [g]);
const [{ p: prev }] = await as(B, `select preview_invite($1) p`, [code.toLowerCase()]);
ok(prev.unclaimed.length === 1 && prev.unclaimed[0].id === P && prev.already_member === false, 'prévia do convite mostra "Paula" livre');
ok((await as(B, `select count(*)::int n from entries where group_id=$1`, [g]))[0].n === 0, 'antes de entrar, Paula não vê lançamentos');
await as(B, `select accept_invite($1, $2)`, [code, P]);
ok((await as(B, `select count(*)::int n from entries where group_id=$1`, [g]))[0].n > 0, 'depois de entrar, Paula vê lançamentos');
b = await bal(B, '2026-10-01');
ok(b[P] === -52500, 'Paula vê o mesmo saldo');

// Acerto zera
await as(B, `select save_entry(p_group_id=>$1, p_type=>'transfer', p_title=>'Acerto outubro', p_amount_cents=>52500,
  p_paid_by=>$2, p_occurred_on=>'2026-10-31', p_transfer_to=>$3)`, [g, P, R]);
b = await bal(A, '2026-10-01');
ok(b[R] === 0 && b[P] === 0, 'transferência de acerto zera o saldo de outubro');

// Segurança
ok((await as(C, `select count(*)::int n from entries`))[0].n === 0, 'intruso não vê lançamentos');
ok((await as(C, `select count(*)::int n from member_balances`))[0].n === 0, 'intruso não vê saldos (view com security_invoker)');
ok((await as(C, `select count(*)::int n from groups`))[0].n === 0, 'intruso não vê grupos');
ok(!!(await fails(C, `select save_entry($1,'expense','hack',100,$2,'2026-11-03')`, [g, R])), 'intruso não lança');
ok(!!(await fails(C, `insert into entries (group_id,type,title,amount_cents,paid_by) values ($1,'expense','x',1,$2)`, [g, R])), 'insert direto bloqueado');
ok(!!(await fails(B, `select regenerate_invite($1)`, [g])), 'só o dono troca o código');
await as(B, `update groups set name='Hack' where id=$1`, [g]);
ok((await as(A, `select name from groups where id=$1`, [g]))[0].name === 'Casa', 'membro comum não renomeia o grupo (RLS)');
ok(!!(await fails(A, `update groups set invite_code='AAAAAA' where id=$1`, [g])), 'código não editável direto');
ok(!!(await fails(A, `select allocate_cents(100, array[$1]::uuid[], array[1], $1)`, [R])), 'função interna não exposta');
ok(!!(await fails(C, `select accept_invite('ZZZZZZ')`)), 'código inválido recusado');

// Novo membro por convite entra com 0%
await as(C, `select accept_invite($1, null, 'Ana')`, [code]);
const [{ n: anaBp }] = await as(C, `select coalesce(sum(s.basis_points),0)::int n from split_rule_shares s join group_members m on m.id=s.member_id where m.display_name='Ana'`);
ok(anaBp === 0, 'novo membro entra com 0% até ajustarem a divisão');

// Exclusão lógica
await as(A, `select delete_entry($1)`, [nov]);
ok((await as(A, `select deleted_at is not null d from entries where id=$1`, [nov]))[0].d, 'excluir marca deleted_at');

// ───── Emoji, recorrência, duplicar ─────
ok((await as(A, `select emoji from groups where id=$1`, [g]))[0].emoji === '🏠', 'grupo tem emoji');
ok((await as(A, `select emoji from categories where id=$1`, [filhos]))[0].emoji === '🧒', 'categoria tem emoji');

const [{ id: serie }] = await as(A, `select save_entry(p_group_id=>$1, p_type=>'expense', p_title=>'Escola', p_amount_cents=>90000,
  p_paid_by=>$2, p_occurred_on=>'2026-10-31', p_category_id=>$3, p_emoji=>'🎒', p_repeat_count=>3, p_repeat_every=>'month') id`, [g, R, filhos]);
const occ = await as(A, `select occurred_on::text d, recurrence_index i, recurrence_total t, emoji from entries
  where recurrence_id = (select recurrence_id from entries where id=$1) order by recurrence_index`, [serie]);
ok(occ.length === 3 && occ.every((o) => o.t === 3 && o.emoji === '🎒'), 'recorrente gera 3 ocorrências com emoji');
ok(occ.map((o) => o.d).join(',') === '2026-10-31,2026-11-30,2026-12-31', `datas mensais ajustam fim de mês (${occ.map((o) => o.d)})`);
const occShares = await as(A, `select e.recurrence_index i, s.share_cents c from entries e join entry_shares s on s.entry_id=e.id
  where e.recurrence_id=(select recurrence_id from entries where id=$1) and s.member_id=$2 order by 1`, [serie, R]);
ok(occShares.every((x) => Number(x.c) === 63000), 'cada ocorrência usa a regra Filhos 70/30');

const [{ id: semanal }] = await as(A, `select save_entry(p_group_id=>$1, p_type=>'expense', p_title=>'Feira', p_amount_cents=>5000,
  p_paid_by=>$2, p_occurred_on=>'2026-11-02', p_repeat_count=>4, p_repeat_every=>'week') id`, [g, P]);
const lastWeek = await as(A, `select max(occurred_on)::text d from entries where recurrence_id=(select recurrence_id from entries where id=$1)`, [semanal]);
ok(lastWeek[0].d === '2026-11-23', 'recorrência semanal');
ok(!!(await fails(A, `select save_entry(p_group_id=>$1, p_type=>'expense', p_title=>'x', p_amount_cents=>1, p_paid_by=>$2, p_occurred_on=>'2026-11-02', p_repeat_count=>99)`, [g, R])), 'repetição acima de 36 recusada');

const [{ id: second }] = await as(A, `select id from entries where recurrence_id=(select recurrence_id from entries where id=$1) and recurrence_index=2`, [serie]);
const [{ n: removed }] = await as(A, `select delete_entry($1, 'following') n`, [second]);
ok(removed === 2, 'excluir "este e os próximos" apaga 2 de 3');
ok((await as(A, `select deleted_at is null alive from entries where id=$1`, [serie]))[0].alive, 'a primeira ocorrência continua');

const [{ id: dup }] = await as(A, `select duplicate_group($1, 'Casa 2027', '🏡') id`, [g]);
const dupMembers = await as(A, `select display_name, user_id, role from group_members where group_id=$1 order by position`, [dup]);
ok(dupMembers.length === 3 && dupMembers[0].role === 'owner' && dupMembers[1].user_id === B, 'grupo duplicado leva as mesmas pessoas (com conta)');
ok((await as(B, `select count(*)::int n from groups where id=$1`, [dup]))[0].n === 1, 'Paula já vê o grupo duplicado');
ok((await as(A, `select count(*)::int n from entries where group_id=$1`, [dup]))[0].n === 0, 'sem copiar lançamentos por padrão');
const dupRule = await as(A, `select s.basis_points bp from split_rules r join split_rule_shares s on s.rule_id=r.id
  join group_members m on m.id=s.member_id where r.group_id=$1 and r.category_id is null and m.display_name='Renato'`, [dup]);
ok(dupRule.length === 1 && dupRule[0].bp === 5000, 'divisão vigente (50/50) copiada');
const dupFilhos = await as(A, `select count(*)::int n from split_rules r join categories c on c.id=r.category_id where r.group_id=$1 and c.name='Filhos'`, [dup]);
ok(dupFilhos[0].n === 1, 'regra da categoria copiada');
ok((await as(A, `select invite_code <> $2 diff from groups where id=$1`, [dup, code]))[0].diff, 'grupo duplicado tem código próprio');

const [{ id: dup2 }] = await as(A, `select duplicate_group($1, 'Casa cópia', null, true) id`, [g]);
const srcCount = (await as(A, `select count(*)::int n from entries where group_id=$1 and deleted_at is null`, [g]))[0].n;
ok((await as(A, `select count(*)::int n from entries where group_id=$1`, [dup2]))[0].n === srcCount, 'com cópia: mesmos lançamentos');
const bSrc = await as(A, `select sum(balance_cents)::bigint b from member_balances b join group_members m on m.id=b.member_id where b.group_id=$1 and m.display_name='Renato'`, [g]);
const bDup = await as(A, `select sum(balance_cents)::bigint b from member_balances b join group_members m on m.id=b.member_id where b.group_id=$1 and m.display_name='Renato'`, [dup2]);
ok(Number(bSrc[0].b) === Number(bDup[0].b), `saldos iguais no grupo copiado (${bSrc[0].b} = ${bDup[0].b})`);
ok(!!(await fails(C, `select duplicate_group($1, 'hack')`, ['00000000-0000-0000-0000-000000000999'])), 'não duplica grupo alheio');
ok(!!(await fails(A, `select write_entry(null,$1,'expense','x',null,1,$2,null,null,'2026-11-01','default',null,null,null,null,null)`, [g, R])), 'write_entry interna não exposta');

ok(!!(await (async () => { try { await db.exec(`reset role; set role anon;`); await db.query(`select preview_invite('AAAAAA')`); return null; } catch (e) { return e.message; } finally { await db.exec('reset role;'); } })()), 'sem login não chama funções');

console.log(failures ? `\n${failures} falha(s)` : '\ntodos os testes passaram');
process.exit(failures ? 1 : 0);
