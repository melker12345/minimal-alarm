import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  TextInput as NativeTextInput,
  Vibration,
  View,
} from 'react-native';
import {Text} from 'react-native-paper';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';

export const ITEM_HEIGHT = 48;
/** One wheel size everywhere: center value + two neighbours each side. */
export const WHEEL_ROWS = 5;
export const WHEEL_HEIGHT = ITEM_HEIGHT * WHEEL_ROWS;
const REPEAT = 15; // copies of the value range, for seamless wrap
const BASE = Math.floor(REPEAT / 2);

type Props = {
  label: string;
  values: number[];
  selected: number;
  onChange: (value: number) => void;
  manualActive: boolean;
  manualValue: string;
  onManual: () => void;
  onManualChange: (value: string) => void;
  onManualCommit: () => void;
  /** Column width; the default suits two columns, narrower fits three. */
  width?: number;
};

/**
 * Samsung/iOS-style time wheel: a smooth momentum picker where the centered
 * value scales up and neighbours shrink and fade (driven natively for 60fps).
 * Scrolls infinitely by silently recentering onto the middle cycle when the
 * user drifts far, so there is never a visible jump. Tap the centered value to
 * type it directly.
 */
export function WheelColumn({label, values, selected, onChange, manualActive, manualValue, onManual, onManualChange, onManualCommit, width = 104}: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Animated.FlatList forwards FlatList methods (scrollToOffset) but its ref
  // type doesn't expose them; `any` keeps this readable without ceremony.
  const listRef = useRef<any>(null);
  const len = values.length;
  const data = useMemo(() => Array.from({length: REPEAT}, () => values).flat(), [values]);

  const indexOfSelected = Math.max(0, values.indexOf(selected));
  const initialIndex = BASE * len + indexOfSelected;
  // Seed scrollY to the initial offset so the centered item renders full-size
  // immediately (initialScrollIndex positions the list but emits no scroll event).
  const scrollY = useRef(new Animated.Value(initialIndex * ITEM_HEIGHT)).current;
  const centeredIdx = useRef(initialIndex); // data index currently at center
  const reported = useRef(selected); // last value we told the parent about

  // Follow external changes to `selected` (e.g. typed value) without a loop.
  useEffect(() => {
    if (selected === reported.current) return;
    reported.current = selected;
    const target = values.indexOf(selected);
    if (target < 0) return;
    const cycle = Math.round((centeredIdx.current - target) / len);
    const nextIdx = cycle * len + target;
    centeredIdx.current = nextIdx;
    listRef.current?.scrollToOffset({offset: nextIdx * ITEM_HEIGHT, animated: true});
  }, [selected, values, len]);

  const lastTick = useRef(initialIndex);
  const onScroll = useMemo(
    () =>
      Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const idx = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (idx !== lastTick.current) {
            lastTick.current = idx;
            Vibration.vibrate(4);
          }
        },
      }),
    [scrollY],
  );

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      let idx = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      idx = Math.min(data.length - 1, Math.max(0, idx));
      const value = data[idx];
      centeredIdx.current = idx;
      if (value !== reported.current) {
        reported.current = value;
        onChange(value);
      }
      // Silently hop back to the middle cycle if we've drifted far, so we never
      // run out of buffer. Invisible because the same number stays centered.
      const target = BASE * len + (idx % len);
      if (Math.abs(idx - target) >= len) {
        centeredIdx.current = target;
        requestAnimationFrame(() => listRef.current?.scrollToOffset({offset: target * ITEM_HEIGHT, animated: false}));
      }
    },
    [data, len, onChange],
  );

  const tapItem = useCallback(
    (dataIndex: number) => {
      Vibration.vibrate(4);
      if (dataIndex === centeredIdx.current) {
        onManual();
      } else {
        centeredIdx.current = dataIndex;
        listRef.current?.scrollToOffset({offset: dataIndex * ITEM_HEIGHT, animated: true});
      }
    },
    [onManual],
  );

  const renderItem = useCallback(
    ({item, index}: {item: number; index: number}) => {
      const center = index * ITEM_HEIGHT;
      const inputRange = [center - 2 * ITEM_HEIGHT, center - ITEM_HEIGHT, center, center + ITEM_HEIGHT, center + 2 * ITEM_HEIGHT];
      const scale = scrollY.interpolate({inputRange, outputRange: [0.68, 0.84, 1.16, 0.84, 0.68], extrapolate: 'clamp'});
      const opacity = scrollY.interpolate({inputRange, outputRange: [0.28, 0.5, 1, 0.5, 0.28], extrapolate: 'clamp'});
      const isCenter = index === centeredIdx.current;
      return (
        <Pressable onPress={() => tapItem(index)} style={styles.item}>
          {isCenter && manualActive ? (
            <NativeTextInput
              autoFocus
              selectTextOnFocus
              value={manualValue}
              onChangeText={onManualChange}
              onBlur={onManualCommit}
              onSubmitEditing={onManualCommit}
              keyboardType="number-pad"
              style={styles.manualInput}
            />
          ) : (
            <Animated.Text style={[styles.text, {opacity, transform: [{scale}]}]}>{String(item).padStart(2, '0')}</Animated.Text>
          )}
        </Pressable>
      );
    },
    [manualActive, manualValue, onManualChange, onManualCommit, scrollY, styles, tapItem],
  );

  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.window, {width, height: WHEEL_HEIGHT}]}>
        <View pointerEvents="none" style={styles.selection} />
        <Animated.FlatList
          ref={listRef}
          data={data}
          keyExtractor={(_, index) => String(index)}
          getItemLayout={(_, index) => ({length: ITEM_HEIGHT, offset: index * ITEM_HEIGHT, index})}
          initialScrollIndex={initialIndex}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          overScrollMode="never"
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={settle}
          contentContainerStyle={{paddingVertical: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2}}
          renderItem={renderItem}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  column: {alignItems: 'center'},
  label: {fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: c.muted, marginBottom: 8},
  window: {borderRadius: 22, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, justifyContent: 'center'},
  selection: {position: 'absolute', left: 8, right: 8, height: ITEM_HEIGHT, borderRadius: 14, backgroundColor: c.accentSoft},
  item: {height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center'},
  text: {fontSize: 24, color: c.ink, fontWeight: '600'},
  manualInput: {width: 76, height: 44, padding: 0, textAlign: 'center', fontSize: 24, color: c.accent, fontWeight: '700', backgroundColor: 'transparent'},
});
