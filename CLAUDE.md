# split-pix — contexto para o Claude Code

Leia também `AGENTS.md` (regras do Expo SDK 58) e o `README.md`.

- Produto: app para casais dividirem gastos por % (padrão do grupo › categoria › item). Sem pagamentos.
- Regras de negócio vivem no banco: `supabase/migrations/*.sql` (`save_entry`, `allocate_cents`, `effective_rule`, view `member_balances`). `src/lib/split.ts` só espelha para prévia — mudou um, mude o outro e os dois testes.
- Dinheiro em centavos inteiros (`bigint`), percentuais em basis points (10000 = 100%). Nunca float.
- Escritas sensíveis só por RPC `SECURITY DEFINER` que checa `is_member`; o app lê tabelas protegidas por RLS.
- Mudança de schema = nova migração em `supabase/migrations/` (não editar a inicial depois de aplicada) + caso em `supabase/tests/schema.test.mjs`.
- UI: tokens em `src/theme.ts`, componentes em `src/components/ui.tsx`. Textos em português do Brasil.
- Antes de concluir: `npm run typecheck && npm run lint && npm test && npm run test:sql`.
- `npx expo install` precisa de rede para resolver versões; offline use `EXPO_OFFLINE=1 npx expo install <pacote>`.
