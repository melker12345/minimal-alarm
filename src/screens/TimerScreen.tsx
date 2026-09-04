import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, ScrollView, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Button, Text} from 'react-native-paper';
import {Colors, spacing} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {ProgressRing} from '../components/ProgressRing';
import {Tappable} from '../components/Tappable';
import {WheelColumn} from '../components/WheelColumn';
import {TimerController} from '../state/useTimer';

const RING_SIZE = 264;

const two = (n: number) => String(n).padStart(2, '0');
const formatRemaining = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
};
/** Compact chip label: "7 min", "1:30", "1:20:00". */
const presetLabel = (seconds: number) => {
  if (seconds % 60 === 0 && seconds < 3600) return `${seconds / 60} min`;
  return formatRemaining(seconds);
};

const noop = () => {};
const wheelManual = {manualActive: false, manualValue: '', onManual: noop, onManualChange: noop, onManualCommit: noop};

// State lives in a hook above the screens (see App) so the countdown keeps
// running when you switch tabs — the screen is just a view over it.
export function TimerScreen({timer}: {timer: TimerController}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const {durationSec, remaining, phase, endsAt, presets, setDuration, start, pause, reset, addMinute} = timer;

  // Picker wheels (idle only).
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);
  const hourValues = useMemo(() => Array.from({length: 24}, (_, index) => index), []);
  const sexagesimal = useMemo(() => Array.from({length: 60}, (_, index) => index), []);

  const pick = (h: number, m: number, s: number) => {
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    setDuration(h * 3600 + m * 60 + s);
  };

  // The ring sweeps smoothly between ticks on the native thread.
  const ringProgress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const target = durationSec > 0 ? remaining / durationSec : 0;
    Animated.timing(ringProgress, {
      toValue: target,
      duration: phase === 'running' ? 300 : 180,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [remaining, durationSec, phase, ringProgress]);

  const ringsAt = endsAt ? new Date(endsAt) : null;
  const status =
    phase === 'running' && ringsAt
      ? `RINGS AT ${two(ringsAt.getHours())}:${two(ringsAt.getMinutes())}`
      : phase === 'paused'
        ? 'PAUSED'
        : "TIME'S UP";

  if (phase === 'idle') {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>MINIMAL ALARM</Text>
        <Text style={styles.title}>Timer</Text>
        <Text style={styles.subtitle}>A quiet countdown for whatever comes next.</Text>
        <View style={styles.wheels}>
          <WheelColumn label="HOURS" width={88} values={hourValues} selected={hours} onChange={value => pick(value, minutes, seconds)} {...wheelManual} />
          <Text style={styles.colon}>:</Text>
          <WheelColumn label="MIN" width={88} values={sexagesimal} selected={minutes} onChange={value => pick(hours, value, seconds)} {...wheelManual} />
          <Text style={styles.colon}>:</Text>
          <WheelColumn label="SEC" width={88} values={sexagesimal} selected={seconds} onChange={value => pick(hours, minutes, value)} {...wheelManual} />
        </View>
        <Text style={styles.quickLabel}>QUICK START</Text>
        <View style={styles.presets}>
          {presets.map(preset => (
            <Tappable key={preset} onPress={() => start(preset)} frame={styles.preset} style={styles.presetInner}>
              <MaterialCommunityIcons name="play" size={14} color={c.accent} />
              <Text style={styles.presetText}>{presetLabel(preset)}</Text>
            </Tappable>
          ))}
        </View>
        <Button mode="contained" onPress={() => start()} disabled={durationSec <= 0} style={styles.button} contentStyle={styles.buttonContent}>
          Start timer
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>MINIMAL ALARM</Text>
      <Text style={styles.title}>Timer</Text>
      <View style={styles.ringWrap}>
        <ProgressRing
          size={RING_SIZE}
          thickness={10}
          progress={ringProgress}
          trackColor={phase === 'finished' ? c.coralSoft : c.accentPale}
          color={phase === 'paused' ? c.disabled : phase === 'finished' ? c.coral : c.accent}>
          <Text style={[styles.time, phase === 'paused' && styles.timePaused]}>{formatRemaining(remaining)}</Text>
          <Text style={[styles.status, phase === 'finished' && styles.statusDone]}>{status}</Text>
        </ProgressRing>
      </View>
      {phase === 'finished' ? (
        <Button mode="contained" onPress={reset} style={styles.button} contentStyle={styles.buttonContent}>
          New timer
        </Button>
      ) : (
        <>
          <View style={styles.chips}>
            <Tappable onPress={addMinute} frame={styles.chip} style={styles.chipInner}>
              <Text style={styles.chipText}>+1:00</Text>
            </Tappable>
            <Tappable onPress={reset} frame={styles.chip} style={styles.chipInner}>
              <Text style={styles.chipText}>Reset</Text>
            </Tappable>
          </View>
          <Button mode="contained" onPress={() => (phase === 'running' ? pause() : start())} style={styles.button} contentStyle={styles.buttonContent}>
            {phase === 'running' ? 'Pause' : 'Resume'}
          </Button>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  scroll: {paddingHorizontal: spacing.page, paddingTop: 24, paddingBottom: 150},
  eyebrow: {fontSize: 11, letterSpacing: 2, fontWeight: '700', color: c.accent, marginBottom: 8},
  title: {fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1.5, color: c.ink, marginTop: 2},
  subtitle: {fontSize: 15, color: c.muted, marginTop: 5},
  wheels: {flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 6, marginTop: 26},
  colon: {fontSize: 26, fontWeight: '300', color: c.disabled, height: 240, lineHeight: 240, textAlign: 'center'},
  quickLabel: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: c.muted, marginTop: 26},
  presets: {flexDirection: 'row', gap: 9, marginTop: 10},
  preset: {flex: 1, height: 42, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface},
  presetInner: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6},
  presetText: {fontSize: 13, color: c.ink, fontWeight: '600', includeFontPadding: false},
  button: {borderRadius: 16, marginTop: 24},
  buttonContent: {height: 54},
  ringWrap: {alignItems: 'center', marginTop: 34, marginBottom: 6},
  time: {fontSize: 52, fontWeight: '300', letterSpacing: -1.5, color: c.ink, includeFontPadding: false},
  timePaused: {color: c.muted},
  status: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: c.muted, marginTop: 8},
  statusDone: {color: c.coral},
  chips: {flexDirection: 'row', gap: 9, marginTop: 22},
  chip: {flex: 1, height: 44, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface},
  chipInner: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  chipText: {fontSize: 14, color: c.ink, fontWeight: '600'},
});
