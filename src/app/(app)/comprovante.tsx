import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AI_MIN_MS, AiAnalysis } from '@/components/ai-analysis';
import { Button, Card, EmojiTile, Header, Input, Loading, Screen } from '@/components/ui';
import { useGroup, useGroups, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatBRL } from '@/lib/money';
import { ocrSupported, readFile, readImage } from '@/lib/ocr';
import { matchMember, parseReceipt, redactReceipt, type ReceiptFields } from '@/lib/receipt';
import { colors, radius, space } from '@/theme';

// Passo a passo: enviar → (análise) → conferir → grupo → lançar.
// O texto lido vive só nesta tela, em memória. Nada é salvo além do que a pessoa confere no formulário.

type Step = 'source' | 'review' | 'group' | 'confirm';
type Source = 'camera' | 'gallery' | 'file';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AI_TEXT = '#93C5FD';

export default function ComprovanteScreen() {
  const params = useLocalSearchParams<{ groupId?: string; shared?: string; source?: Source }>();
  const userId = useUserId();
  const groups = useGroups(userId);
  const share = useShareIntentContext();
  const [step, setStep] = useState<Step>('source');
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(params.groupId ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(!ocrSupported);
  const started = useRef(false);

  const active = (groups.data ?? []).filter((g) => !g.archived_at);
  const groupId = picked ?? (active.length === 1 ? active[0].id : null);
  const r = text.trim() ? parseReceipt(text) : null;
  // Veio de dentro de um grupo: não pergunta o grupo de novo.
  const steps: Step[] = params.groupId ? ['source', 'review', 'confirm'] : ['source', 'review', 'group', 'confirm'];
  const index = steps.indexOf(step);
  const go = (delta: number) => setStep(steps[Math.min(Math.max(index + delta, 0), steps.length - 1)]);

  async function analyze(read: () => Promise<string>) {
    setError(null);
    setDone(false);
    setAnalyzing(true);
    try {
      const [t] = await Promise.all([read(), wait(AI_MIN_MS)]);
      const parsed = parseReceipt(t);
      if (parsed.amountCents === null && parsed.date === null && parsed.toName === null) {
        throw new Error('Não achei valor, data nem destinatário. Tente uma imagem mais nítida do comprovante inteiro.');
      }
      setText(t);
      setDone(true);
      await wait(900);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui ler esse comprovante.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function camera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError('Sem acesso à câmera. Libere nas configurações ou escolha da galeria.'); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) await analyze(() => readImage(asset.uri));
  }
  async function gallery() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) await analyze(() => readImage(asset.uri));
  }
  async function file() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) await analyze(() => readFile(asset.uri, asset.mimeType));
  }
  async function pasted(t: string) {
    if (t.trim()) await analyze(async () => t);
  }
  const open: Record<Source, () => Promise<void>> = { camera, gallery, file };

  // Entrada automática: compartilhado do banco, ou fonte já escolhida em "Novo lançamento".
  useEffect(() => {
    if (started.current) return;
    if (params.shared && share.hasShareIntent) {
      started.current = true;
      const f = share.shareIntent.files?.[0];
      const sharedText = share.shareIntent.text ?? '';
      share.resetShareIntent();
      // Começa logo depois de a tela aparecer (fora do efeito).
      setTimeout(() => void analyze(f ? () => readFile(f.path, f.mimeType) : async () => sharedText), 0);
    } else if (params.source && ocrSupported) {
      started.current = true;
      const source = params.source;
      setTimeout(() => void open[source](), 250);
    }
  });

  const canNext = step === 'review' ? !!r : step === 'group' ? !!groupId : false;

  return (
    <Screen footer={step === 'review' || step === 'group' ? (
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Voltar" variant="secondary" style={{ flex: 1 }} onPress={() => go(-1)} />
        <Button title="Próximo" style={{ flex: 2 }} disabled={!canNext} onPress={() => go(1)} />
      </View>
    ) : undefined}>
      <Header title="Comprovante com IA" />
      <AiAnalysis visible={analyzing} done={done} />
      <Progress steps={steps.length} index={index} />

      {step === 'source' ? (
        <StepBody emoji="✨" kicker="LEITURA INTELIGENTE COM IA" title="Envie o comprovante"
          text="Tire uma foto, escolha o print ou o PDF do banco. A IA lê no seu celular e preenche o lançamento para você.">
          {ocrSupported ? (
            <View style={{ gap: space.sm }}>
              <SourceTile emoji="📷" label="Tirar foto" sub="Aponte a câmera para o comprovante" onPress={camera} highlight />
              <SourceTile emoji="🖼️" label="Print ou imagem" sub="Escolher da galeria" onPress={gallery} />
              <SourceTile emoji="📄" label="PDF ou arquivo" sub="Comprovante salvo no celular" onPress={file} />
            </View>
          ) : null}
          {error ? <Text style={{ fontSize: 13, lineHeight: 18, color: colors.negative }}>{error}</Text> : null}
          <Card style={{ gap: 6, backgroundColor: colors.primarySoft }}>
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.primaryInk }}>
              💡 Mais rápido: no app do banco, toque em <Text style={{ fontWeight: '700' }}>Compartilhar comprovante</Text> e escolha o split-pix.
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.primaryInk }}>🔒 Nada sai do celular. CPF, chave Pix e códigos são descartados.</Text>
          </Card>
          {showPaste ? (
            <PasteBox onAnalyze={pasted} />
          ) : (
            <Pressable onPress={() => setShowPaste(true)} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Prefere colar o texto do comprovante?</Text>
            </Pressable>
          )}
        </StepBody>
      ) : null}

      {step === 'review' && r ? <Review r={r} text={text} onRetry={() => { setText(''); setStep('source'); }} /> : null}

      {step === 'group' ? (
        <StepBody emoji="👥" title="Em qual grupo?" text="Escolha onde esse gasto vai entrar.">
          {groups.isLoading ? <Loading /> : active.map((g) => (
            <Pressable key={g.id} onPress={() => setPicked(g.id)} accessibilityRole="radio" accessibilityState={{ selected: groupId === g.id }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card,
                borderWidth: 2, borderColor: groupId === g.id ? colors.primary : colors.divider,
                backgroundColor: groupId === g.id ? colors.primarySoft : colors.surface }}>
              <EmojiTile emoji={g.emoji} size={36} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{g.name}</Text>
              {groupId === g.id ? <Text style={{ fontSize: 18, color: colors.primary }}>✓</Text> : null}
            </Pressable>
          ))}
        </StepBody>
      ) : null}

      {step === 'confirm' && r && groupId ? <Confirm groupId={groupId} r={r} onBack={() => go(-1)} /> : null}
    </Screen>
  );
}

// ── passos ───────────────────────────────────────────────────────────────

function Review({ r, text, onRetry }: { r: ReceiptFields; text: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <StepBody emoji={r.invoice ? '🛒' : '🔎'} kicker={r.invoice ? 'A IA LEU A NOTA FISCAL' : 'A IA ENCONTROU'}
      title={r.amountCents !== null ? formatBRL(r.amountCents) : 'Valor não encontrado'}
      text={r.title ?? 'Confira os dados lidos do comprovante.'}>
      <Card style={{ gap: space.md }}>
        <Found label="Valor" value={r.amountCents !== null ? formatBRL(r.amountCents) : null} low={r.amountConfidence === 'low'} />
        <Found label="Data" value={r.date ? r.date.split('-').reverse().join('/') : null} low={r.dateConfidence === 'low'} />
        <Found label={r.invoice ? 'Loja' : 'Para'} value={r.toName} />
        {r.invoice ? null : <Found label="De" value={r.fromName} />}
      </Card>
      <Text style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>
        {r.invoice ? 'Valor a pagar já com descontos, conferido pela conta da nota. ' : ''}⚠️ marca o que vale conferir com atenção. Você ainda ajusta tudo antes de salvar.
      </Text>
      <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Ler outro comprovante</Text>
        </Pressable>
        <Pressable onPress={async () => { await Clipboard.setStringAsync(redactReceipt(text)); setCopied(true); }} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted }}>{copied ? 'Copiado sem dados pessoais ✓' : 'Leu errado? Copiar texto'}</Text>
        </Pressable>
      </View>
    </StepBody>
  );
}

function Confirm({ groupId, r, onBack }: { groupId: string; r: ReceiptFields; onBack: () => void }) {
  const group = useGroup(groupId);
  const userId = useUserId();
  const [type, setType] = useState<'expense' | 'transfer' | null>(null);
  if (!group.data) return <Loading />;
  const s = suggest(group.data, r, userId);
  const chosen = type ?? s.type;
  const g = group.data.group;
  const params = chosen === 'transfer' && s.transfer ? s.transfer : s.expense;
  return (
    <StepBody emoji="✅" title="Tudo pronto para lançar" text={`Em ${g.emoji} ${g.name}. Escolha como esse comprovante entra:`}>
      <Option selected={chosen === 'expense'} onPress={() => setType('expense')} emoji="🧾" title="Despesa"
        sub={`${s.payerName} pagou${r.amountCents !== null ? ` ${formatBRL(r.amountCents)}` : ''}; divide pela regra do grupo.`} />
      <Option selected={chosen === 'transfer'} disabled={!s.transfer} onPress={() => setType('transfer')} emoji="🤝" title="Acerto entre vocês"
        sub={s.transfer ? `${s.transferLabel}. Abate do saldo.` : 'Só quando quem recebeu é participante do grupo.'} />
      <View style={{ gap: space.sm, paddingTop: space.sm }}>
        <Button title="Abrir lançamento preenchido" icon="chevron-right"
          onPress={() => router.replace({ pathname: '/g/[id]/item', params: { id: groupId, ...params } })} />
        <Button title="Voltar" variant="ghost" onPress={onBack} />
      </View>
    </StepBody>
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
  const transfer = to && from && to.id !== from.id ? { ...base, type: 'transfer' as const, from: from.id, to: to.id } : null;
  return {
    type: transfer ? ('transfer' as const) : ('expense' as const),
    payerName: from?.display_name ?? 'Você',
    transfer,
    transferLabel: transfer && to ? `${from.display_name} → ${to.display_name}` : '',
    expense: { ...base, type: 'expense' as const, ...(from ? { from: from.id } : {}), ...(r.title ? { title: r.title } : {}) },
  };
}

// ── peças ────────────────────────────────────────────────────────────────

function Progress({ steps, index }: { steps: number; index: number }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: steps }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? colors.primary : colors.divider }} />
        ))}
      </View>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Passo {index + 1} de {steps}</Text>
    </View>
  );
}

function StepBody({ emoji, kicker, title, text, children }: { emoji: string; kicker?: string; title: string; text: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.lg, paddingTop: space.sm }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryInk, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 34 }}>{emoji}</Text>
        </View>
        {kicker ? <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.primary }}>{kicker}</Text> : null}
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{title}</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSoft, textAlign: 'center' }}>{text}</Text>
      </View>
      {children}
    </View>
  );
}

function SourceTile({ emoji, label, sub, onPress, highlight }: { emoji: string; label: string; sub: string; onPress: () => void; highlight?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card,
        backgroundColor: highlight ? colors.primaryInk : colors.surface, borderWidth: highlight ? 0 : 1, borderColor: colors.divider,
        opacity: pressed ? 0.8 : 1 })}>
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: highlight ? '#FFFFFF' : colors.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: highlight ? AI_TEXT : colors.muted }}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 18, color: highlight ? '#FFFFFF' : colors.muted }}>›</Text>
    </Pressable>
  );
}

function Option({ emoji, title, sub, selected, disabled, onPress }: {
  emoji: string; title: string; sub: string; selected: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ selected, disabled }}
      style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 2,
        borderColor: selected ? colors.primary : colors.divider, backgroundColor: selected ? colors.primarySoft : colors.surface,
        opacity: disabled ? 0.45 : 1 }}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSoft }}>{sub}</Text>
      </View>
      {selected ? <Text style={{ fontSize: 18, color: colors.primary }}>✓</Text> : null}
    </Pressable>
  );
}

function Found({ label, value, low }: { label: string; value: string | null; low?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={{ width: 52, fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: value ? colors.text : colors.muted }} numberOfLines={2}>
        {value ?? 'não encontrado'}
      </Text>
      {value ? <Text style={{ fontSize: 14 }}>{low ? '⚠️' : '✓'}</Text> : null}
    </View>
  );
}

function PasteBox({ onAnalyze }: { onAnalyze: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <View style={{ gap: space.sm }}>
      <Button title="Colar do comprovante" icon="copy" variant="secondary"
        onPress={async () => { const c = await Clipboard.getStringAsync(); if (c.trim()) onAnalyze(c); }} />
      <Input value={t} onChangeText={setT} multiline placeholder="…ou cole/digite o texto aqui"
        style={{ minHeight: 70, maxHeight: 140, textAlignVertical: 'top', paddingTop: 10, fontSize: 12 }} />
      {t.trim() ? <Button title="Analisar texto" onPress={() => onAnalyze(t)} /> : null}
    </View>
  );
}
