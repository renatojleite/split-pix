# split-pix — PRD

**Versão do documento:** 2.0 · 04/11/2026
**Responsável:** Renato Leite
**Status do produto:** demo de validação (APK Android) → preparação para App Store e Google Play

---

## 1. Visão

App para **casais** (e pequenos grupos) registrarem gastos em comum e dividirem por **percentual**: um padrão do grupo, uma regra por categoria ou um ajuste em cada item. Tudo online e em tempo real para quem participa do grupo.

O split-pix **não movimenta dinheiro**. Ele calcula quem deve a quem e facilita o acerto via **Pix** (QR ou código copia e cola), que cada um paga no próprio banco.

**Princípios**
- Extremamente simples, no estilo do Tricount: poucos toques para lançar um gasto.
- Divisão por % é o centro do produto (ex.: 60/40 no geral, 70/30 em "Filhos").
- Os números batem sempre: centavos inteiros, sobra de arredondamento para quem pagou.
- Português do Brasil e Pix como meio de acerto.

## 2. Público

- **Principal:** casais que dividem as contas da casa de forma proporcional à renda.
- **Secundário:** famílias, amigos que moram juntos e viagens em grupo pequeno.

## 3. Situação atual (entregue)

### 3.1 Acesso e grupos
- Splash com logo, depois login por **link mágico ou código por e-mail** (Supabase Auth). O deep link é `splitpix://login-callback`.
- Pede o nome no primeiro acesso.
- **Home:**
  - lista de grupos com emoji e o saldo do usuário ("Paula te deve R$ X");
  - **ordem dos grupos ajustável arrastando**, salva no aparelho;
  - grupos arquivados numa lista à parte;
  - menu ⋮ com **Atualizar versão**, que busca, baixa e reabre a versão nova na hora;
  - versão do app no rodapé.
- **Criar grupo:** nome, emoji, participantes (podem ainda não ter conta) e a divisão padrão em %.
- **Participar:** código de 6 caracteres ou leitura de QR. Quem entra pode assumir um participante já criado ("sou a Paula").
- **Convite:** código, QR e mensagem para WhatsApp com o link do APK.
- **Editar grupo:** nome, emoji, arquivar/desarquivar e **excluir**. Excluir é lógico: some para todos e o convite deixa de valer. Só quem criou o grupo pode fazer isso.
- **Duplicar grupo:** mesmas pessoas, categorias e divisão, com opção de copiar os lançamentos.

### 3.2 Lançamentos
- Tipos: **despesa**, **entrada** (receita dividida) e **acerto** (transferência entre pessoas).
- Campos:
  - título, emoji e valor;
  - data, escolhida num **calendário**;
  - quem pagou;
  - categoria: chips em linha com rolagem, **Ver todas** (com busca) e **＋ Nova**, que cria a categoria numa janela e já seleciona.
- Divisão do item:
  - padrão (regra vigente);
  - igual;
  - por %;
  - por valores;
  - desmarcar participantes.
- **Prévia** da divisão antes de salvar.
- **Recorrência:** repetir mensal ou semanal, de 1 a 36 vezes, mantendo o dia e ajustando o fim de mês.
- **Excluir** só este ou este e os próximos da série. **Duplicar** um item.

### 3.3 Grupo — abas
- **Despesas:**
  - lista por mês;
  - bloco de pessoas, expansível e fixável;
  - **calendário** que destaca os dias com lançamento, com filtro por dia.
- **Saldos:** saldo de cada pessoa, sugestão de acertos ("Paula → Renato R$ X"), registro de acerto e o Pix.
- **Resumo:**
  - acumulado (padrão) ou por mês;
  - gasto total, entradas, saldo e pendente;
  - por pessoa e por categoria;
  - botão **Compartilhar relatório**.
- **Divisão:**
  - padrão do grupo e regra por categoria, cada uma vigente a partir de um mês;
  - editar ou excluir categorias;
  - participantes: renomear, chave Pix, remover;
  - código de convite.

### 3.4 Participantes
- Renomear.
- Remover ou sair do grupo. Exige saldo zerado; quem criou o grupo não sai; o % de quem sai é redistribuído proporcionalmente; o histórico mantém o nome.
- **Chave Pix do participante:**
  - fica salva no grupo, visível só para os membros;
  - cada um cadastra a própria chave;
  - a chave de quem ainda não tem conta qualquer membro cadastra.

### 3.5 Pix
- Pix **estático (BR Code / EMV)**, com CRC16 validado no exemplo oficial do Banco Central.
- **Receber:** QR e código com o valor, envio pelo WhatsApp e opção de copiar.
- **Pagar:** gera o código com a chave da outra pessoa para colar no banco.
- Pix "livre" pelo menu ⋮, para qualquer valor.
- Depois do Pix, **registrar o acerto** atualiza o saldo. O app não confirma pagamento.

### 3.6 Relatórios (WhatsApp)
- **Resumido** ou **Extrato completo**, acumulado ou de um mês, com prévia na tela.
- Formato:
  - cabeçalho `💸 split-pix`, grupo e período (dd/mm/aaaa a dd/mm/aaaa);
  - Números do período;
  - Por pessoa, em blocos: parte, valor gasto, acertos e **saldo em destaque**;
  - Por categoria: valor e %;
  - Pendente: um bloco por dívida, com o **Pix copia e cola no valor** quando quem recebe tem chave;
  - Chaves Pix: tipo e chave, ou "(ausente)";
  - Extrato (só no completo): data, emoji, título, valor e "Pago por X · regra", sem valores por pessoa;
  - rodapé com link do app e código do grupo.
- Na tela: **Copiar código** e **Enviar só o código** para cada pendência, porque no WhatsApp segurar a mensagem copia ela inteira.

### 3.7 Ler comprovante com IA
- Entrada: print ou foto, PDF, "Compartilhar comprovante" do app do banco direto para o split-pix, ou colar o texto.
- Leitura **no aparelho** (ML Kit / Apple Vision) + leitor de campos próprio (`src/lib/receipt.ts`): valor, data, destinatário, pagador e título sugerido ("Pix para Maria Lima").
- Tela de análise ("Leitura inteligente") com os passos, depois a confirmação: o que foi encontrado, com ⚠️ nos campos duvidosos, e a escolha do grupo.
- Se o destinatário é participante do grupo, sugere **acerto**; se não, **despesa**. Abre o formulário do item pré-preenchido.
- **Nunca salva dados sensíveis**: CPF, chave Pix, instituição, autenticação e ID não saem do leitor; imagem e páginas do PDF são apagadas após a leitura; o texto fica só em memória.
- "Leu errado? Copiar texto para melhorar o leitor" copia uma versão sem dados pessoais.

### 3.8 Atualizações e distribuição
- O APK é gerado no GitHub Actions; a release `latest` fica com `split-pix.apk`.
- **EAS Update:** mudança só de código JS vira atualização em cerca de 2 minutos, sem APK novo. O que é decidido pelo fingerprint nativo:
  - fingerprint igual: só a atualização;
  - fingerprint diferente: APK novo, com cerca de 14 minutos de build.

## 4. Regras de negócio (fonte da verdade: banco)

| Regra | Onde |
|---|---|
| Dinheiro em centavos (`bigint`), % em basis points (10000 = 100%) | todo o schema |
| Regra vigente: item › categoria › padrão do grupo, por mês (`effective_from`) | `effective_rule` |
| Rateio com sobra de centavos para quem pagou | `allocate_cents` |
| Partes congeladas no lançamento (mudar a regra não reescreve o passado) | `entry_shares` |
| Saldo = pagou − parte − entradas recebidas + parte nas entradas + acertos enviados − acertos recebidos | view `member_balances` |
| Escritas sensíveis só via RPC `SECURITY DEFINER` com `is_member` | `save_entry`, `delete_entry`, `remove_member`, `set_member_pix`, `delete_group`… |
| Leitura protegida por RLS; grupo excluído some para todos | `is_member` / `is_owner` |
| Chave Pix alheia (de quem tem conta) não pode ser alterada | `set_member_pix` + grant de colunas |

`src/lib/split.ts` e `src/lib/summary.ts` espelham as regras para prévia e resumo. Mudou um lado, muda o outro e os testes.

## 5. Arquitetura

- **App:**
  - Expo SDK 58, React Native 0.88, Expo Router, TanStack Query, TypeScript e React Compiler;
  - Reanimated e Gesture Handler para arrastar.
- **Backend:** Supabase (Postgres, Auth, Realtime e RLS). Migrações em `supabase/migrations/`.
- **Testes:**
  - `npm test`: regras, resumo, Pix, datas e relatório;
  - `npm run test:sql`: schema, RLS e RPCs em PGlite.
- **CI:** GitHub Actions, que testa, compara o fingerprint e escolhe entre `eas update` (canal `preview`) e o build do APK (arm64).

### Modelo de dados (resumo)
- `profiles`
- `groups`: emoji, invite_code, archived_at, deleted_at
- `group_members`: user_id opcional, role, color, position, left_at, pix_*
- `categories`
- `split_rules` / `split_rule_shares`
- `entries`: tipo, valor, pagador, transfer_to, categoria, emoji, data, split_mode, recorrência, deleted_at
- `entry_shares`

## 6. Fora de escopo (por enquanto)
- Pagamento ou confirmação automática de Pix (Pix dinâmico, gateway, Open Finance).
- Multimoeda.
- Anexar comprovantes ou fotos.
- Versão web.

## 7. Próxima fase — lojas e assinatura

### 7.1 Modelo comercial
- **Grátis:** tudo liberado, limitado a **2 grupos criados** pela pessoa. Entrar em grupos de outros é sempre grátis.
- **Assinatura anual (ex.: R$ 24/ano):** grupos ilimitados.
- Grupos excluídos não contam no limite. **Decidir:** se grupos arquivados contam.
- **Assinatura vencida:** nada é travado. A pessoa continua vendo e lançando nos grupos existentes, só não cria novos acima do limite.

### 7.2 Requisitos

| # | Item | Observação |
|---|---|---|
| 1 | Compra dentro do app (Apple IAP / Google Play Billing) | Obrigatório para recurso digital. Sugestão: RevenueCat. Exige APK/build nativo novo. |
| 2 | Tabela de assinaturas + `has_pro(uid)` | Atualizada por Edge Function (webhook do RevenueCat). |
| 3 | Limite em `create_group` e `duplicate_group` | Checagem no banco, com teste SQL. |
| 4 | Tela de assinatura (paywall) | Preço, benefícios, **Restaurar compras**, Termos, Privacidade, gerenciar assinatura. |
| 5 | **Excluir conta** dentro do app | Exigência da Apple. |
| 6 | Política de privacidade e termos publicados | URLs nas lojas e no app. |
| 7 | Trocar o link do APK por links das lojas | Convite e relatório. A Apple rejeita orientação para instalar por fora. |
| 8 | Build iOS (EAS), bundle id, ícones, screenshots | Conta Apple Developer (US$ 99/ano) e Google Play (US$ 25 único). |
| 9 | SMTP próprio no Supabase | O envio padrão de e-mail não aguenta usuários reais. |
| 10 | Supabase plano Pro | O plano grátis pausa projetos parados. Cerca de US$ 25/mês. |

### 7.3 Economia (estimativa)
- Comissão das lojas: **15%** (programas para quem fatura menos de US$ 1 mi/ano). De R$ 24 sobram cerca de **R$ 20,40** por assinante/ano, antes de impostos.
- No Brasil a Apple aceita pagamento alternativo desde 2026 (acordo com o CADE), com taxas próprias. Para esse ticket, IAP é o caminho mais simples.
- Custo fixo de cerca de US$ 25/mês (Supabase Pro) → cerca de **70–80 assinantes** para empatar.

### 7.4 Esforço estimado
- Banco (limite, assinaturas, testes): cerca de 1 dia.
- IAP, paywall e excluir conta: cerca de 1 semana.
- Build iOS, fichas das lojas e revisão: 1–2 semanas (a primeira revisão da Apple costuma ter idas e vindas).

## 8. Métricas de sucesso
- Ativação: grupo criado com o segundo participante entrando em até 7 dias.
- Uso: lançamentos por grupo por semana; % de meses com acerto registrado.
- Compartilhamento: relatórios e Pix enviados por mês.
- Comercial: conversão do grátis para assinatura ao bater o limite; renovação anual.

## 9. Pendências e riscos
- [ ] Confirmar a Redirect URL `splitpix://**` no Supabase Auth.
- [ ] Testar o QR e o copia e cola do Pix com apps de bancos reais.
- [ ] SMTP próprio, antes de abrir para mais usuários.
- [ ] Testar no aparelho o arrastar da Home, a folha de nova categoria e o "Atualizar versão".
- Risco: Pix estático não confirma pagamento, então o acerto depende de registro manual.
- Risco: a ordem dos grupos e as chaves Pix reserva ficam só no aparelho (trocar de celular perde a ordem).
