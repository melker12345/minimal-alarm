import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Button, Surface, Text, TextInput} from 'react-native-paper';
import {Colors, spacing} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {TimerController} from '../state/useTimer';

const PRESETS = [5, 10, 15];

// State lives in a hook above the screens (see App) so the countdown keeps
// running when you switch tabs — the screen is just a view over it.
export function TimerScreen({timer}: {timer: TimerController}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const {durationSec: duration, remaining, running, minutesInput, setMinutes, toggle, reset} = timer;

  const formatted = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const progress = duration > 0 ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 0;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>MINIMAL ALARM</Text>
      <Text style={styles.title}>Timer</Text>
      <Text style={styles.subtitle}>A quiet countdown for whatever comes next.</Text>
      <Surface style={styles.card} elevation={0}>
        <Text style={styles.cardEyebrow}>{running ? 'COUNTING DOWN' : remaining === 0 ? 'FINISHED' : 'READY WHEN YOU ARE'}</Text>
        <Text style={styles.value}>{formatted}</Text>
        <View style={styles.progress}>
          <View style={[styles.progressFill, {width: `${progress}%`}]} />
        </View>
      </Surface>
      <View style={styles.presets}>
        {PRESETS.map(value => {
          const active = minutesInput === String(value);
          return (
            <Pressable
              key={value}
              onPress={() => setMinutes(String(value))}
              style={[styles.preset, active && styles.presetActive]}
              android_ripple={{color: c.ripple}}>
              <Text style={[styles.presetText, active && styles.presetTextActive]}>{value} min</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput mode="outlined" label="Minutes" value={minutesInput} onChangeText={setMinutes} keyboardType="number-pad" style={styles.input} disabled={running} />
      <Button mode="contained" onPress={toggle} style={styles.button} contentStyle={styles.buttonContent}>
        {running ? 'Pause timer' : remaining === 0 ? 'Start again' : 'Start timer'}
      </Button>
      {remaining !== duration ? (
        <Button mode="text" onPress={reset}>
          Reset
        </Button>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  scroll: {paddingHorizontal: spacing.page, paddingTop: 24, paddingBottom: 150},
  eyebrow: {fontSize: 11, letterSpacing: 2, fontWeight: '700', color: c.accent, marginBottom: 8},
  title: {fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1.5, color: c.ink, marginTop: 2},
  subtitle: {fontSize: 15, color: c.muted, marginTop: 5},
  card: {marginTop: 30, borderRadius: 28, padding: 24, backgroundColor: c.surface},
  cardEyebrow: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: c.accent},
  value: {fontSize: 64, lineHeight: 78, fontWeight: '300', letterSpacing: -2.5, color: c.ink, marginTop: 16},
  progress: {height: 8, borderRadius: 4, backgroundColor: c.accentPale, overflow: 'hidden', marginTop: 12},
  progressFill: {height: 8, borderRadius: 4, backgroundColor: c.accent},
  presets: {flexDirection: 'row', gap: 9, marginTop: 18},
  preset: {flex: 1, height: 42, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: c.surface},
  presetActive: {backgroundColor: c.accentSoft, borderColor: c.accent},
  presetText: {fontSize: 13, color: c.muted, fontWeight: '600'},
  presetTextActive: {color: c.accent},
  input: {marginTop: 18, backgroundColor: c.surface},
  button: {borderRadius: 16, marginTop: 18},
  buttonContent: {height: 54},
});
