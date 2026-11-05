import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, Text, View } from 'react-native';

import { MonthNav } from '@/components/group/month-nav';
import { Button, Card, Chip, ErrorText, Header, Loading, Screen, Segmented } from '@/components/ui';
import { useAllEntries, useEntries, useGroup, type GroupDetail } from '@/lib/api';
import { APK_DOWNLOAD_URL } from '@/lib/config';
import { monthStart, today } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { buildReport, pendingPix, type ReportKind } from '@/lib/report';
import { colors, space } from '@/theme';

// Da aba Resumo chegam o período escolhido lá; do menu ⋮, nada (acumulado).
type Params = { id: string; month?: string; kind?: ReportKind };

// Acima disso o link do WhatsApp pode não abrir; vai pelo menu de compartilhar.
const WHATSAPP_URL_LIMIT = 30000;

export default function RelatorioScreen() {
  const params = useLocalSearchParams<Params>();
  const group = useGroup(params.id);
  if (!group.data) return <Screen><Header title="Relatório" /><Loading /></Screen>;
  return <ReportForm params={params} detail={group.data} />;
}

function ReportForm({ params, detail }: { params: Params; detail: GroupDetail }) {
  const [kind, setKind] = useState<ReportKind>(params.kind ?? 'summary');
  const [scope, setScope] = useState<'all' | 'month'>(params.month ? 'month' : 'all');
  const [month, setMonth] = useState(params.month ?? monthStart(today()));
  const [copied, setCopied] = useState<string | null>(null); // 'report' ou o código Pix copiado
  const monthly = useEntries(detail.group.id, month);
  const all = useAllEntries(detail.group.id, scope === 'all');
  const source = scope === 'month' ? monthly : all;

  const text = source.data
    ? buildReport({
        kind, group: detail.group, members: detail.allMembers, categories: detail.categories, entries: source.data,
        month: scope === 'month' ? month : null, appUrl: APK_DOWNLOAD_URL, generatedOn: today(),
      })
    : '';
  const missingPix = detail.members.filter((m) => !m.pix_key).map((m) => m.display_name);
  const pending = source.data
    ? pendingPix({ entries: source.data, members: detail.allMembers, categories: detail.categories, group: detail.group })
    : [];

  async function whatsapp(message: string) {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    if (url.length > WHATSAPP_URL_LIMIT) return Share.share({ message });
    try {
      await Linking.openURL(url);
    } catch {
      await Share.share({ message }); // sem WhatsApp instalado
    }
  }

  async function copy(value: string, tag: string) {
    await Clipboard.setStringAsync(value);
    setCopied(tag);
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <Screen footer={(
      <View style={{ gap: space.sm }}>
        <Button title="Enviar no WhatsApp" icon="share" variant="positive" onPress={() => whatsapp(text)} disabled={!text} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title={copied === 'report' ? 'Copiado ✓' : 'Copiar texto'} icon="copy" variant="secondary" onPress={() => copy(text, 'report')}
            disabled={!text} style={{ flex: 1 }} />
          <Button title="Outro app" variant="secondary" onPress={() => Share.share({ message: text })}
            disabled={!text} style={{ flex: 1 }} />
        </View>
      </View>
    )}>
      <Header title="Compartilhar relatório" />

      <Segmented<ReportKind> value={kind} onChange={setKind} options={[
        { value: 'summary', label: 'Resumido' },
        { value: 'statement', label: 'Extrato completo' },
      ]} />
      <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }}>
        {kind === 'summary'
          ? 'Números, saldo de cada pessoa, categorias, quem deve a quem (com o Pix no valor) e as chaves Pix.'
          : 'Tudo do resumido mais a lista de todos os lançamentos, com data, valor e quem pagou.'}
      </Text>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Acumulado" selected={scope === 'all'} onPress={() => setScope('all')} />
        <Chip label="Por mês" selected={scope === 'month'} onPress={() => setScope('month')} />
      </View>
      {scope === 'month' ? <MonthNav month={month} onMonth={setMonth} /> : null}

      {missingPix.length ? (
        <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }}>
          Sem chave Pix no grupo: {missingPix.join(', ')}. Aparece como (ausente). Cadastre em Divisão › Participantes.
        </Text>
      ) : null}

      {pending.some((t) => t.code) ? (
        <Card style={{ gap: space.md }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Pix das pendências</Text>
            <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }}>
              No WhatsApp, segurar a mensagem copia ela inteira. Para colar no banco, envie o código sozinho
              (quem recebe segura e copia) ou copie aqui.
            </Text>
          </View>
          {pending.filter((t) => t.code).map((t, i) => (
            <View key={`${t.from}-${t.to}`} style={{ gap: 6, paddingTop: i ? space.md : 0,
              borderTopWidth: i ? 1 : 0, borderColor: colors.divider }}>
              <Text style={{ fontSize: 12, color: colors.text }}>
                {t.fromName} → {t.toName} · <Text style={{ fontWeight: '700' }}>{formatBRL(t.cents)}</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button title={copied === t.code ? 'Copiado ✓' : 'Copiar código'} icon="copy" variant="secondary"
                  onPress={() => copy(t.code!, t.code!)} style={{ flex: 1, height: 35 }} />
                <Button title="Enviar só o código" variant="secondary" onPress={() => whatsapp(t.code!)}
                  style={{ flex: 1, height: 35 }} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {source.error ? <ErrorText>{source.error.message}</ErrorText> : null}
      {!source.data ? <Loading /> : (
        <Card style={{ gap: 5 }}>
          <Text style={{ fontSize: 11, color: colors.muted }}>Prévia</Text>
          <Text selectable style={{ fontSize: 11, lineHeight: 16, color: colors.text }}>
            {text}
          </Text>
        </Card>
      )}
    </Screen>
  );
}
