import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AI_MIN_MS, AiAnalysis } from '@/components/ai-analysis';
import { Button, Card, Chip, Header, Input, Loading, Screen } from '@/components/ui';
import { useGroup, useGroups, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatBRL } from '@/lib/money';
import { ocrSupported, readFile, readImage } from '@/lib/ocr';
import { matchMember, parseReceipt, redactReceipt, type ReceiptFields } from '@/lib/receipt';
import { colors, radius, space } from '@/theme';

// O texto lido (da imagem, PDF, compartilhamento ou colado) vive só nesta tela, em memória.
// Nada é salvo: o que segue para o lançamento são os campos que a pessoa confere no formulário.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ComprovanteScreen() {
  const { groupId, shared } = useLocalSearchParams<{ groupId?: string; shared?: string }>();
  const groups = useGroups(useUserId());
  const share = useShareIntentContext();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(groupId ?? null);
  const [copiedSupport, setCopiedSupport] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(!ocrSupported);
  const handledShare = useRef(false);

  const active = (groups.data ?? []).filter((g) => !g.archived_at);
  const selected = picked ?? active[0]?.id ?? null;
  const r = text.trim() && !analyzing ? parseReceipt(text) : null;
  const found = !!r && (r.amountCents !== null || r.date !== null || r.toName !== null);

  /** Mostra a tela de análise enquanto lê; no fim o texto fica só em memória. */
  async function analyze(read: () => Promise<string>) {
    setError(null);
    setDone(false);
    setAnalyzing(true);
    try {
      const [t] = await Promise.all([read(), wait(AI_MIN_MS)]);
      if (!t.trim()) throw new Error('Não encontrei texto nesse arquivo.');
      setText(t);
      setDone(true);
      await wait(900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui ler esse comprovante.');
    } finally {
      setAnalyzing(false);
    }
  }

  // Veio pelo "Compartilhar" do app do banco.
  useEffect(() => {
    if (!shared || handledShare.current || !share.hasShareIntent) return;
    handledShare.current = true;
    const file = share.shareIntent.files?.[0];
    const sharedText = share.shareIntent.text ?? '';
    void analyze(file ? () => readFile(file.path, file.mimeType) : async () => sharedText);
    share.resetShareIntent();
  }, [shared, share]);

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) await analyze(() => readImage(asset.uri));
  }

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) await analyze(() => readFile(asset.uri, asset.mimeType));
  }

  async function paste() {
    const t = await Clipboard.getStringAsync();
    if (t.trim()) await analyze(async () => t);
  }

  return (
    <Screen>
      <Header title="Ler comprovante" />
      <AiAnalysis visible={analyzing} done={done} />

      <View style={{ backgroundColor: colors.primaryInk, borderRadius: radius.card, padding: space.xl, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22 }}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#93C5FD' }}>LEITURA INTELIGENTE COM IA</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFFFFF' }}>Do comprovante ao lançamento</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.85)' }}>
          Envie o print ou o PDF do banco. A IA lê no seu celular e já preenche valor, data e destinatário. Você só confere e salva.
        </Text>
        {ocrSupported ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <SourceTile emoji="🖼️" label="Print ou foto" onPress={pickImage} />
            <SourceTile emoji="📄" label="PDF ou arquivo" onPress={pickFile} />
          </View>
        ) : null}
        <Text style={{ fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.7)' }}>
          💡 Mais rápido: no app do banco, toque em <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Compartilhar comprovante</Text> e escolha o split-pix.
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>🔒 Nada sai do aparelho. CPF, chave Pix e códigos são descartados.</Text>
      </View>

      {error ? <Text style={{ fontSize: 13, lineHeight: 18, color: colors.negative }}>{error}</Text> : null}

      {showPaste ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Ou cole o texto do comprovante</Text>
          <Button title="Colar do comprovante" icon="copy" variant="secondary" onPress={paste} />
          <Input value={text} onChangeText={setText} multiline placeholder="…ou digite/cole aqui"
            style={{ minHeight: 70, maxHeight: 140, textAlignVertical: 'top', paddingTop: 10, fontSize: 12 }} />
        </View>
      ) : (
        <Pressable onPress={() => setShowPaste(true)} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Prefere colar o texto?</Text>
        </Pressable>
      )}

      {r && !found ? (
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.negative }}>
          Não achei valor, data nem destinatário nesse texto. Confira se copiou o comprovante inteiro.
        </Text>
      ) : null}

      {r && found ? (
        <>
          <Card style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>✨ A IA encontrou</Text>
            <Field label="Valor" value={r.amountCents !== null ? formatBRL(r.amountCents) : null} low={r.amountConfidence === 'low'} />
            <Field label="Data" value={r.date ? r.date.split('-').reverse().join('/') : null} low={r.dateConfidence === 'low'} />
            <Field label="Para" value={r.toName} />
            {r.fromName ? <Field label="De" value={r.fromName} /> : null}
            <Text style={{ fontSize: 11, color: colors.muted }}>⚠️ = confira com atenção. Você ajusta tudo no próximo passo.</Text>
          </Card>

          <View style={{ gap: space.sm }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Em qual grupo lançar?</Text>
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


function SourceTile({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? '#1D4ED8' : colors.primary, borderRadius: radius.input,
        paddingVertical: space.lg, alignItems: 'center', gap: 6 })}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}
