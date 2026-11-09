import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Positions = Record<string, number>;

/**
 * Lista que reordena arrastando pela alça. Linhas de altura fixa (rowHeight).
 * Monte com key = ids na ordem atual: quando a ordem salva muda, a lista recomeça dela.
 */
export function SortableList<T extends { id: string }>({ items, rowHeight, gap, renderItem, onReorder, onDragging }: {
  items: T[];
  rowHeight: number;
  gap: number;
  renderItem: (item: T, handle: (child: ReactNode) => ReactNode) => ReactNode;
  onReorder: (ids: string[]) => void;
  onDragging?: (dragging: boolean) => void;
}) {
  const positions = useSharedValue<Positions>(Object.fromEntries(items.map((it, i) => [it.id, i])));
  const step = rowHeight + gap;

  function drop(final: Positions) {
    const ids = Object.keys(final).sort((a, b) => final[a] - final[b]);
    if (ids.some((id, i) => items[i]?.id !== id)) onReorder(ids);
  }

  return (
    <View style={{ height: Math.max(0, items.length * step - gap) }}>
      {items.map((it, i) => (
        <Row key={it.id} id={it.id} index={i} count={items.length} step={step} height={rowHeight}
          positions={positions} onDrop={drop} onDragging={onDragging ?? (() => {})}
          render={(handle) => renderItem(it, handle)} />
      ))}
    </View>
  );
}

function Row({ id, index, count, step, height, positions, onDrop, onDragging, render }: {
  id: string; index: number; count: number; step: number; height: number; positions: SharedValue<Positions>;
  onDrop: (p: Positions) => void; onDragging: (d: boolean) => void;
  render: (handle: (child: ReactNode) => ReactNode) => ReactNode;
}) {
  const top = useSharedValue(index * step);
  const start = useSharedValue(0);
  const active = useSharedValue(false);

  // Outra linha mudou de lugar: desliza esta até a nova posição.
  useAnimatedReaction(() => positions.get()[id], (cur, prev) => {
    if (cur !== prev && cur !== undefined && !active.get()) top.set(withTiming(cur * step, { duration: 180 }));
  });

  const pan = Gesture.Pan()
    .minDistance(1)
    .onBegin(() => { scheduleOnRN(onDragging, true); }) // trava a rolagem já no toque na alça
    .onStart(() => { active.set(true); start.set(top.get()); })
    .onUpdate((e) => {
      top.set(Math.min(Math.max(start.get() + e.translationY, -step / 3), (count - 1) * step + step / 3));
      const to = Math.min(Math.max(Math.round(top.get() / step), 0), count - 1);
      const from = positions.get()[id];
      if (to === from) return;
      const next: Positions = { ...positions.get() };
      for (const k of Object.keys(next)) {
        if (k === id) continue;
        const p = next[k];
        if (from < to && p > from && p <= to) next[k] = p - 1;
        else if (from > to && p >= to && p < from) next[k] = p + 1;
      }
      next[id] = to;
      positions.set(next);
    })
    .onFinalize(() => {
      if (active.get()) {
        active.set(false);
        top.set(withTiming(positions.get()[id] * step, { duration: 160 }));
        scheduleOnRN(onDrop, positions.get());
      }
      scheduleOnRN(onDragging, false);
    });

  const style = useAnimatedStyle(() => ({
    top: top.get(),
    zIndex: active.get() ? 10 : 0,
    transform: [{ scale: withTiming(active.get() ? 1.03 : 1, { duration: 120 }) }],
    shadowOpacity: active.get() ? 0.18 : 0,
    elevation: active.get() ? 8 : 0,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height, shadowColor: '#000', shadowRadius: 11, shadowOffset: { width: 0, height: 6 }, borderRadius: 21 }, style]}>
      {render((child) => <GestureDetector gesture={pan}>{child}</GestureDetector>)}
    </Animated.View>
  );
}
