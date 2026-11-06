import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Chip, Header, Input, Loading, Screen } from '@/components/ui';
import { useGroup, useGroups, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatBRL } from '@/lib/money';
import { matchMember, parseReceipt, redactReceipt, type ReceiptFields } from '@/lib/receipt';
import { colors, space } from '@/theme';

// O texto colado vive só nesta tela (memória). Nada é salvo: o que segue para o
// lançamento são os campos que a pessoa confere no formulário.

export default function ComprovanteScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const groups = useGroups(useUserId());
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(groupId ?? null);
  const [copiedSupport, setCopiedSupport] = useState(false);

  const active = (groups.data ?? []).filter((g) => !g.archived_at);
  const selected = picked ?? active[0]?.id ?? null;
  const r = text.trim() ? parseReceipt(text) : null;
  const found = !!r && (r.amountCents !== null || r.date !== null || r.toName !== null);

  async function paste() {
    const t = await Clipboard.getStringAsync();
    if (t.trim()) setText(t);
  }

  return (
    <Screen>
      <Header title="Ler comprovante" />

      <Card style={{ gap: space.sm }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>1. Copie o texto do comprovante</Text>
        <Tip>📸 Print ou imagem: abra na Galeria e toque no ícone <Text style={{ fontWeight: '700' }}>T</Text> (extrair texto) › Copiar. Ou use o Google Lens › Texto › Copiar tudo.</Tip>
        <Tip>📄 PDF: abra, selecione tudo e copie.</Tip>
        <Tip>🔒 Lido só aqui no celular. O texto não é salvo nem enviado.</Tip>
      </Card>

      <View style={{ gap: space.sm }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>2. Cole aqui</Text>
        <Button title={text ? 'Colar de novo' : 'Colar do comprovante'} icon="copy" variant={text ? 'secondary' : 'primary'} onPress={paste} />
        <Input value={text} onChangeText={setText} multiline placeholder="…ou cole o texto manualmente"
          style={{ minHeight: 70, maxHeight: 140, textAlignVertical: 'top', paddingTop: 10, fontSize: 12 }} />
      </View>

      {r && !found ? (
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.negative }}>
          Não achei valor, data nem destinatário nesse texto. Confira se copiou o comprovante inteiro.
        </Text>
      ) : null}

      {r && found ? (
        <>
          <Card style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>3. Encontrei</Text>
            <Field label="Valor" value={r.amountCents !== null ? formatBRL(r.amountCents) : null} low={r.amountConfidence === 'low'} />
            <Field label="Data" value={r.date ? r.date.split('-').reverse().join('/') : null} low={r.dateConfidence === 'low'} />
            <Field label="Para" value={r.toName} />
            {r.fromName ? <Field label="De" value={r.fromName} /> : null}
            <Text style={{ fontSize: 11, color: colors.muted }}>⚠️ = confira com atenção. Você ajusta tudo no próximo passo.</Text>
          </Card>

          <View style={{ gap: space.sm }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>4. Em qual grupo?</Text>
            {groups.isLoading ? <Loading /> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {active.map((g) => <Chip key={g.id} label={`${g.emoji} ${g.name}`} selected={selected === g.id} onPress={() => setPicked(g.id)} />)}
              </View>
            )}
          </View>

          {selected ? <Continue groupId={selected} r={r} /> : null}

          <Button title={copiedSupport ? 'Copiado ✓ (sem dados pessoais)' : 'Leu errado? Copiar texto para melhorar o leitor'} variant="ghost"
            onPress={async () => { await Clipboard.setStringAsync(redactReceipt(text)); setCopiedSupport(true); }} />
        </>
      ) : null}
    </Screen>
  );
}

/** Decide o tipo (despesa ou acerto entre participantes) com os nomes do grupo e abre o formulário preenchido. */
function Continue({ groupId, r }: { groupId: string; r: ReceiptFields }) {
  const group = useGroup(groupId);
  const userId = useUserId();
  if (!group.data) return <Loading />;
  const s = suggest(group.data, r, userId);
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>{s.hint}</Text>
      <Button title="Continuar para o lançamento" icon="chevron-right"
        onPress={() => router.replace({ pathname: '/g/[id]/item', params: { id: groupId, ...s.params } })} />
    </View>
  );
}

function suggest(detail: GroupDetail, r: ReceiptFields, userId: string) {
  const me = detail.members.find((m) => m.user_id === userId);
  const from = matchMember(r.fromName, detail.members) ?? me ?? detail.members[0];
  const to = matchMember(r.toName, detail.members);
  const base = {
    fromReceipt: '1',
    ...(r.amountCents !== null ? { amount: String(r.amountCents) } : {}),
    ...(r.date ? { date: r.date } : {}),
  };
  if (to && from && to.id !== from.id) {
    return {
      hint: `${r.toName} é ${to.display_name} no grupo: vai como acerto de ${from.display_name} para ${to.display_name}.`,
      params: { ...base, type: 'transfer' as const, from: from.id, to: to.id },
    };
  }
  return {
    hint: `Vai como despesa paga por ${from?.display_name ?? 'você'}. Escolha a categoria e a divisão no próximo passo.`,
    params: { ...base, type: 'expense' as const, ...(from ? { from: from.id } : {}), ...(r.title ? { title: r.title } : {}) },
  };
}

function Field({ label, value, low }: { label: string; value: string | null; low?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ width: 50, fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: value ? colors.text : colors.muted }} numberOfLines={2}>
        {value ? `${value}${low ? '  ⚠️' : ''}` : 'não encontrado'}
      </Text>
    </View>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSoft }}>{children}</Text>;
}
