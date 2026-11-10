import { LayoutAnimation } from 'react-native';

/** Transição suave para o próximo abrir/fechar (blocos expansíveis). Chame antes de mudar o estado. */
export function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.create(1000, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}
