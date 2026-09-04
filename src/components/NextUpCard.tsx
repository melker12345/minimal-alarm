import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Surface, Text} from 'react-native-paper';
import {Alarm, daysText, timeText, untilText} from '../domain/alarm';
import {minutesUntilNext} from '../domain/selectors';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';

/** The hero card summarising the soonest upcoming alarm, with a live countdown. */
export function NextUpCard({alarm, now}: {alarm?: Alarm; now: Date}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const until = alarm ? untilText(minutesUntilNext(alarm, now)) : null;
  return (
    <Surface style={styles.card} elevation={0}>
      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>NEXT UP</Text>
          {until ? <Text style={styles.until}>{until.toUpperCase()}</Text> : null}
        </View>
        {alarm ? (
          <View style={styles.row}>
            <Text style={styles.time}>{timeText(alarm)}</Text>
            <View style={styles.details}>
              <Text style={styles.label}>{alarm.label}</Text>
              <Text style={styles.meta}>
                {alarm.kind === 'sequence'
                  ? `${alarm.count} alarms  ·  ${alarm.spacingMinutes} min apart`
                  : daysText(alarm.days)}
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.label}>Set the tone for tomorrow</Text>
            <Text style={styles.meta}>Your next alarm will appear here</Text>
          </View>
        )}
      </View>
    </Surface>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {borderRadius: 26, backgroundColor: c.accentSoft, overflow: 'hidden', marginBottom: 28},
  content: {padding: 20},
  eyebrowRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  eyebrow: {fontSize: 11, fontWeight: '700', letterSpacing: 2, color: c.accent},
  until: {fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: c.accent},
  row: {flexDirection: 'row', alignItems: 'center'},
  time: {fontSize: 44, fontWeight: '300', letterSpacing: -2, color: c.ink},
  details: {marginLeft: 18, paddingLeft: 18, borderLeftWidth: 1, borderLeftColor: c.accentLine},
  label: {fontSize: 16, fontWeight: '600', color: c.ink},
  meta: {fontSize: 14, color: c.muted, marginTop: 3},
});
