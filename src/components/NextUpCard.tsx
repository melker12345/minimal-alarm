import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Surface, Text} from 'react-native-paper';
import {Alarm, daysText, timeText} from '../domain/alarm';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';

/** The hero card summarising the soonest upcoming alarm. */
export function NextUpCard({alarm}: {alarm?: Alarm}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Surface style={styles.card} elevation={0}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>NEXT UP</Text>
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
  eyebrow: {fontSize: 11, fontWeight: '700', letterSpacing: 2, color: c.accent, marginBottom: 12},
  row: {flexDirection: 'row', alignItems: 'center'},
  time: {fontSize: 44, fontWeight: '300', letterSpacing: -2, color: c.ink},
  details: {marginLeft: 18, paddingLeft: 18, borderLeftWidth: 1, borderLeftColor: c.accentLine},
  label: {fontSize: 16, fontWeight: '600', color: c.ink},
  meta: {fontSize: 14, color: c.muted, marginTop: 3},
});
