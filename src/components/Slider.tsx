import React, {useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, PanResponder, StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
  /** Optional gradient-ish track tint (e.g. warmth). */
  trackColors?: [string, string];
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A lightweight themed slider — pure JS (PanResponder), no native module. */
export function Slider({label, value, min, max, step = 1, onChange, format, disabled, trackColors}: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const ratio = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;

  const emit = (locationX: number) => {
    if (widthRef.current <= 0) return;
    const r = clamp(locationX / widthRef.current, 0, 1);
    const raw = min + r * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(clamp(snapped, min, max));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: evt => emit(evt.nativeEvent.locationX),
        onPanResponderMove: evt => emit(evt.nativeEvent.locationX),
      }),
    // emit closes over widthRef/props via refs and current render; recreate on deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, min, max, step, onChange],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const fillColor = trackColors ? trackColors[1] : c.accent;

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format ? format(value) : String(value)}</Text>
      </View>
      <View style={styles.trackArea} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.track} />
        <View style={[styles.fill, {width: ratio * width, backgroundColor: fillColor}]} />
        <View style={[styles.thumb, {left: clamp(ratio * width - 12, 0, Math.max(0, width - 24)), backgroundColor: fillColor}]} />
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: {marginBottom: 4},
    disabled: {opacity: 0.45},
    header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6},
    label: {fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: c.muted},
    value: {fontSize: 13, fontWeight: '700', color: c.accent},
    trackArea: {height: 34, justifyContent: 'center'},
    track: {height: 6, borderRadius: 3, backgroundColor: c.line},
    fill: {position: 'absolute', height: 6, borderRadius: 3, left: 0},
    thumb: {position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: c.surface, elevation: 3, shadowColor: '#0B1220', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: {width: 0, height: 1}},
  });
