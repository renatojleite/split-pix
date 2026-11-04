import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, Text, View } from 'react-native';

import { MonthNav } from '@/components/group/month-nav';
import { Button, Card, Chip, ErrorText, Header, Loading, Screen, Segmented } from '@/components/ui';
import { useAllEntries, useEntries, useGroup, type GroupDetail } from '@/lib/api';
import { APK_DOWNLOAD_URL } from '@/lib/config';
import { monthStart, today } from '@/lib/dates';
import { buildReport, type ReportKind } from '@/lib/report';
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
  const [copied, setCopied] = useState(false);
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

  async function whatsapp() {
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    if (url.length > WHATSAPP_URL_LIMIT) return Share.share({ message: text });
    try {
      await Linking.openURL(url);
    } catch {
      await Share.share({ message: text }); // sem WhatsApp instalado
    }
  }

  async function copy() {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Screen footer={(
      <View style={{ gap: space.sm }}>
        <Button title="Enviar no WhatsApp" icon="share" variant="positive" onPress={whatsapp} disabled={!text} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title={copied ? 'Copiado ✓' : 'Copiar texto'} icon="copy" variant="secondary" onPress={copy}
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
      <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
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
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
          Sem chave Pix no grupo: {missingPix.join(', ')}. Aparece como (ausente). Cadastre em Divisão › Participantes.
        </Text>
      ) : null}

      {source.error ? <ErrorText>{source.error.message}</ErrorText> : null}
      {!source.data ? <Loading /> : (
        <Card style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, color: colors.muted }}>Prévia</Text>
          <Text selectable style={{ fontSize: 14, lineHeight: 20, color: colors.text }}>
            {text}
          </Text>
        </Card>
      )}
    </Screen>
  );
}
