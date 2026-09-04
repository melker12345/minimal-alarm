import React, {useMemo} from 'react';
import {Animated, StyleSheet, View, ViewStyle} from 'react-native';

type Props = {
  size: number;
  thickness: number;
  /** 0..1 — the fraction of the ring drawn, clockwise from 12 o'clock. */
  progress: Animated.Value;
  trackColor: string;
  color: string;
  children?: React.ReactNode;
};

/**
 * Pure-RN circular progress — no SVG dependency. A CSS-spinner-style
 * half-ring (two adjacent borders colored, rotated 45°) is revealed through
 * each half-screen clip window; two of them cover the full sweep. Both
 * rotations interpolate from one native-driven progress value.
 */
export function ProgressRing({size, thickness, progress, trackColor, color, children}: Props) {
  const styles = useMemo(() => makeStyles(size, thickness, trackColor, color), [size, thickness, trackColor, color]);

  // First half sweeps 12→6 o'clock (progress 0..0.5), second 6→12 (0.5..1).
  const rightRotate = progress.interpolate({inputRange: [0, 0.5], outputRange: ['-180deg', '0deg'], extrapolate: 'clamp'});
  const leftRotate = progress.interpolate({inputRange: [0.5, 1], outputRange: ['-180deg', '0deg'], extrapolate: 'clamp'});

  return (
    <View style={styles.box}>
      <View style={styles.track} />
      <View style={styles.rightWindow}>
        <Animated.View style={[styles.halfRight, {transform: [{rotate: rightRotate}, {rotate: '45deg'}]}]} />
      </View>
      <View style={styles.leftWindow}>
        <Animated.View style={[styles.halfLeft, {transform: [{rotate: leftRotate}, {rotate: '45deg'}]}]} />
      </View>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const makeStyles = (size: number, t: number, trackColor: string, color: string) => {
  const circle: ViewStyle = {width: size, height: size, borderRadius: size / 2, borderWidth: t};
  return StyleSheet.create({
    box: {width: size, height: size},
    track: {...circle, position: 'absolute', borderColor: trackColor},
    // The windows overlap the center line by a pixel so the two half-arcs
    // meet without a hairline seam at 6 o'clock.
    rightWindow: {position: 'absolute', left: size / 2 - 1, width: size / 2 + 1, height: size, overflow: 'hidden'},
    leftWindow: {position: 'absolute', left: 0, width: size / 2 + 1, height: size, overflow: 'hidden'},
    // Half-rings: two adjacent borders colored = a semicircle once rotated 45°.
    // Each sits inside its window offset so the circle stays centered on the box.
    halfRight: {
      ...circle,
      marginLeft: -size / 2 + 1,
      borderTopColor: color,
      borderRightColor: color,
      borderBottomColor: 'transparent',
      borderLeftColor: 'transparent',
    },
    halfLeft: {
      ...circle,
      borderBottomColor: color,
      borderLeftColor: color,
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
    },
    center: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'},
  });
};
