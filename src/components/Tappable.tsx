import React from 'react';
import {Pressable, PressableProps, StyleProp, View, ViewStyle} from 'react-native';
import {useColors} from '../design/ThemeProvider';

type Props = PressableProps & {
  /** Outer look: radius, background, border, margins. The ripple clips to it. */
  frame?: StyleProp<ViewStyle>;
  /** Inner layout: padding, direction, centering. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Pressable whose Android ripple respects rounded corners. The ripple ignores
 * the pressable's own borderRadius (it fills the rectangular bounds), so it
 * must be clipped by a parent that carries the radius — this wrapper.
 */
export function Tappable({frame, style, children, ...rest}: Props) {
  const c = useColors();
  return (
    <View style={[frame, clip]}>
      <Pressable android_ripple={{color: c.ripple}} style={style} {...rest}>
        {children}
      </Pressable>
    </View>
  );
}

const clip: ViewStyle = {overflow: 'hidden'};
