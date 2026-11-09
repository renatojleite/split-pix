import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type GestureResponderEvent, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, space, type } from '@/theme';
import { Icon, type IconName } from './icons';

// ───────────── Layout ─────────────

export function Screen({
  children, scroll = true, footer, padded = true,
}: { children: ReactNode; scroll?: boolean; footer?: ReactNode; padded?: boolean }) {
  const inner = padded ? styles.padded : undefined;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, styles.gap]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, styles.gap]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Header({ title, right, back = true, center }: {
  title?: string; right?: ReactNode; back?: boolean; center?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton name="back" label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      ) : <View style={{ width: 38 }} />}
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
        {center ?? (title ? <Text style={type.title} numberOfLines={1}>{title}</Text> : null)}
      </View>
      {right ?? <View style={{ width: 38 }} />}
    </View>
  );
}

export function IconButton({ name, label, onPress, color = colors.text }: {
  name: IconName; label: string; onPress: () => void; color?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}>
      <Icon name={name} color={color} />
    </Pressable>
  );
}

// ───────────── Ações ─────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'positive' | 'negative' | 'ghost';

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style }: {
  title: string; onPress: () => void; variant?: ButtonVariant; disabled?: boolean; loading?: boolean;
  icon?: IconName; style?: StyleProp<ViewStyle>;
}) {
  const v = buttonColors[variant];
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [
        styles.button, { backgroundColor: v.bg }, pressed && { opacity: 0.85 },
        (disabled || loading) && { opacity: 0.45 }, style,
      ]}>
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon ? <Icon name={icon} size={18} color={v.fg} strokeWidth={2.5} /> : null}
          <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonColors: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF' },
  secondary: { bg: colors.card, fg: colors.text },
  danger: { bg: colors.negativeSoft, fg: colors.negative },
  positive: { bg: colors.positive, fg: '#FFFFFF' },
  negative: { bg: colors.negative, fg: '#FFFFFF' },
  ghost: { bg: 'transparent', fg: colors.primary },
};

export function Chip({ label, selected, onPress, color }: {
  label: string; selected?: boolean; onPress: () => void; color?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.inverse }]}>
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, selected && { color: '#FFFFFF', fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange, accent = false }: {
  /** `icon` sem `label` vira um botão só de ícone, menor (ex.: configurações). */
  options: { value: T; label: string; icon?: IconName; iconOnly?: boolean }[]; value: T; onChange: (v: T) => void; accent?: boolean;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        const tint = on ? (accent ? '#FFFFFF' : colors.text) : colors.muted;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segment, o.iconOnly && { flex: 0, width: 38 }, on && (accent ? styles.segmentAccent : styles.segmentOn)]}>
            {o.iconOnly && o.icon ? (
              <Icon name={o.icon} size={16} color={tint} strokeWidth={on ? 2.2 : 1.8} />
            ) : (
              <Text style={[styles.segmentText, on && { fontWeight: '600', color: accent ? '#FFFFFF' : colors.text }]}>
                {o.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────── Formulário ─────────────

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}</Text>
      {children}
      {hint ? <Text style={type.caption}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps & { big?: boolean }) {
  const { big, style, ...rest } = props;
  return (
    <TextInput placeholderTextColor={colors.muted} {...rest}
      style={[styles.input, big && styles.inputBig, style]} />
  );
}

// ───────────── Conteúdo ─────────────

export function Card({ children, style, onPress, onLongPress }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: (e: GestureResponderEvent) => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} accessibilityRole="button"
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function EmojiTile({ emoji, size = 46, onPress, label }: {
  emoji: string; size?: number; onPress?: () => void; label?: string;
}) {
  const tile = (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: onPress ? colors.card : '#EEF0F3',
      alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.68 }}>{emoji}</Text>
    </View>
  );
  if (!onPress) return tile;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? 'Escolher emoji'} onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {tile}
    </Pressable>
  );
}

export function Avatar({ name, color, size = 35 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color,
      alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Barra dividida nas cores dos membros — o elemento novo em relação ao Tricount. */
export function SplitBar({ parts, height = 11 }: { parts: { color: string; bp: number }[]; height?: number }) {
  const total = parts.reduce((a, p) => a + p.bp, 0) || 1;
  return (
    <View style={{ height, borderRadius: height / 2, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.card }}>
      {parts.filter((p) => p.bp > 0).map((p, i) => (
        <View key={i} style={{ flex: p.bp / total, backgroundColor: p.color }} />
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 35 }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={{ color: colors.negative, fontSize: 12 }}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.sm }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{children}</Text>
      {right}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  padded: { paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  gap: { gap: space.lg },
  footer: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg, gap: space.md, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 50 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  button: { height: 50, borderRadius: radius.input, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xl },
  buttonText: { fontSize: 15, fontWeight: '600' },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: radius.chip, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 12, color: colors.textSoft },
  dot: { width: 9, height: 9, borderRadius: 4 },
  segmented: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 12, backgroundColor: colors.card },
  segment: { flex: 1, height: 35, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: '#FFFFFF', elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  segmentAccent: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, color: colors.textSoft, fontWeight: '500' },
  input: { height: 50, borderRadius: radius.input, backgroundColor: colors.card, paddingHorizontal: space.lg, fontSize: 15, color: colors.text },
  inputBig: { height: 56, fontSize: 26, fontWeight: '700' },
  card: { borderRadius: radius.row, backgroundColor: colors.card, padding: space.lg },
});
