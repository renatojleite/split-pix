# split-pix

App para casais registrarem gastos compartilhados e dividirem por percentual — padrão do grupo, por categoria ou ajustado item a item. Sem pagamentos: é um registro colaborativo, sincronizado em tempo real entre os membros.

- **App:** Expo SDK 58 · React Native · TypeScript · Expo Router · TanStack Query
- **Backend:** Supabase (Postgres + Auth por código no e-mail + Realtime + RLS)
- **Demo:** APK Android via EAS Build. O mesmo projeto gera AAB/IPA para as lojas.

## 1. Supabase (uma vez)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **Banco:** abra *SQL Editor*, cole o conteúdo de `supabase/migrations/20261103000000_init.sql` e rode.
   Com a CLI: `supabase link --project-ref SEU_REF` e `supabase db push`.
3. **Login por código:** em *Authentication › Emails › Templates*, edite **Magic Link** (e também **Confirm signup**) para mostrar o código:
   ```html
   <h2>Seu código do split-pix</h2>
   <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>Vale por 1 hora. Se não foi você, ignore este e-mail.</p>
   ```
   Sem `{{ .Token }}` o e-mail chega só com link e o app não tem onde digitar.
4. **E-mail de verdade:** o envio padrão do Supabase é limitado e serve só para testes. Para a validação com casais, configure SMTP próprio em *Authentication › Emails › SMTP Settings* (ex.: Resend, Brevo, SES).
5. Copie a **Project URL** e a **Publishable key** em *Project Settings › API Keys*.

## 2. Rodar no celular (desenvolvimento)

```bash
npm install
cp .env.example .env          # preencha URL e chave do passo 1.5
npm start                     # abra no Expo Go (Android) lendo o QR do terminal
```

Câmera, SQLite e SVG fazem parte do Expo Go, então não precisa de build nativo para testar.

## 3. Gerar o APK da demo

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # cria o projeto na sua conta Expo
npx eas-cli@latest env:create --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_URL --value https://SEU-PROJETO.supabase.co
npx eas-cli@latest env:create --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_...
npm run build:apk                             # perfil "preview" → .apk
```

O `.env` local não vai para o build na nuvem (está no `.gitignore`), por isso as variáveis são cadastradas no EAS. Ao terminar, o EAS mostra um link e um QR para baixar e instalar o APK. Quem for instalar precisa permitir "instalar apps de fontes desconhecidas".

Para as lojas depois: `npx eas-cli@latest build -p android --profile production` gera o AAB da Play Store; `-p ios` gera o IPA (requer conta Apple Developer).

## 4. Testes

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (config Expo)
npm test            # cálculo de divisão, dinheiro e datas no app
npm run test:sql    # schema num Postgres embutido: cálculo, vigência, convite, RLS
```

`test:sql` sobe as migrações no PGlite com stubs do `auth` do Supabase e cobre 31 casos. Entre eles: o exemplo do PRD (Paula deve R$ 525,00), a sobra de centavos indo para quem pagou e a mudança de % que não reescreve meses anteriores. Também confirma que quem não é do grupo não vê nem grava nada.

## Como funciona

**Divisão.** Cada lançamento usa o % mais específico: *item > categoria > padrão do grupo*. Regras têm vigência por mês (`split_rules.effective_from`), e as cotas são gravadas em `entry_shares` no momento do lançamento — mudar o % depois não altera o histórico. O cálculo oficial é a função `save_entry` no banco; `src/lib/split.ts` espelha a mesma lógica só para a prévia no formulário.

**Saldo** de cada pessoa = o que pagou − a sua parte (+ receitas e acertos), pela view `member_balances`. A aba Saldos sugere quem paga quem e o botão "Registrar acerto" cria a transferência que zera.

**Convite.** Código de 6 caracteres (sem 0/O/1/I), mostrado como texto e QR com `splitpix://convite/CODIGO`. Quem entra escolhe "Sou a Paula" e herda os lançamentos já feitos com esse nome, ou entra como pessoa nova com 0% até ajustarem a divisão.

**Segurança.** Leitura direta das tabelas, sempre filtrada por RLS (`is_member`). Escritas sensíveis só por funções `SECURITY DEFINER` que validam a participação. A chave publicável no app é pública por definição.

## Estrutura

```
src/app/                 rotas (Expo Router)
  login.tsx, codigo.tsx  login por código no e-mail
  (app)/index.tsx        Home: grupos e saldo de cada um
  (app)/novo-grupo.tsx   nome, ícone, participantes, % padrão
  (app)/participar.tsx   código ou QR → "quem é você neste grupo?"
  (app)/g/[id]/          grupo: abas Despesas · Saldos · Divisão
    item.tsx             novo/editar lançamento (despesa, receita, transferência)
    regra.tsx            % do grupo ou de uma categoria, a partir de um mês
    convite.tsx          QR + código + compartilhar
src/components/          UI (tokens em src/theme.ts), abas do grupo, editor de %
src/lib/                 supabase, api (queries + realtime), split, money, dates
supabase/migrations/     schema, RLS, funções, realtime
supabase/tests/          testes do schema (PGlite)
tests/                   testes da lógica do app
scripts/make-icons.py    gera ícone e splash a partir do logo
```

## Limites conhecidos da v0.1

- Ícones de grupo/categoria são desenhos fixos; o PRD prevê seletor de emoji como no Tricount.
- Data do lançamento usa setas dia a dia (sem calendário nativo).
- Link de convite aberto sem estar logado leva ao login e perde o código — basta digitá-lo depois.
- Sem notificações push, fotos de comprovante, exportação ou modo offline (fora do escopo da demo).
- Antes das lojas: tela de exclusão de conta (exigida por Google e Apple), política de privacidade e checagem da marca "Pix" (do Banco Central).
