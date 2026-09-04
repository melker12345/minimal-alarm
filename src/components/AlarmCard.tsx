import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Surface, Switch, Text} from 'react-native-paper';
import {Alarm, daysText, ringtoneLabel, sequenceTimes, shiftDays, timeText} from '../domain/alarm';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';

type Props = {
  alarm: Alarm;
  expanded: boolean;
  onPress: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function AlarmCard({alarm, expanded, onPress, onToggle, onDelete, onEdit}: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const off = !alarm.enabled;
  const meta =
    alarm.kind === 'sequence'
      ? `${alarm.count} alarms  ·  ${alarm.spacingMinutes} min apart`
      : `${daysText(alarm.days)}  ·  ${ringtoneLabel(alarm.ringtone)}`;
  const hint =
    alarm.kind === 'sequence'
      ? expanded
        ? 'TAP TO COLLAPSE  ·  HOLD TO EDIT'
        : 'TAP TO VIEW  ·  HOLD TO EDIT'
      : null;

  return (
    <View>
      <Pressable
        onPress={onPress}
        onLongPress={onEdit}
        delayLongPress={420}
        style={styles.press}
        android_ripple={{color: c.ripple}}
        accessibilityLabel={`Edit ${timeText(alarm)} alarm`}>
        <Surface style={[styles.card, off && styles.cardOff]} elevation={0}>
          <View style={styles.info}>
            <Text style={[styles.time, off && styles.textOff]}>{timeText(alarm)}</Text>
            <Text style={[styles.label, off && styles.textOff]}>{alarm.label}</Text>
            <Text style={styles.meta}>{meta}</Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </View>
          <View style={styles.controls}>
            <Switch value={alarm.enabled} onValueChange={onToggle} color={c.accent} />
            <Pressable
              style={styles.deleteBtn}
              onPress={onDelete}
              hitSlop={8}
              android_ripple={{color: c.ripple, borderless: true, radius: 22}}
              accessibilityLabel="Delete alarm">
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={c.muted} />
            </Pressable>
          </View>
        </Surface>
      </Pressable>
      {expanded && alarm.kind === 'sequence' ? (
        <View style={styles.sequence}>
          {sequenceTimes(alarm).map((time, index) => (
            <View key={`${alarm.id}-${index}`} style={styles.sequenceRow}>
              <Text style={styles.sequenceIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.sequenceTime}>{timeText(time)}</Text>
              <Text style={styles.sequenceDay}>{daysText(shiftDays(alarm.days, time.dayShift))}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  press: {borderRadius: 24, overflow: 'hidden', marginBottom: 10},
  card: {
    minHeight: 132,
    borderRadius: 24,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 21,
    paddingRight: 16,
    paddingVertical: 18,
  },
  cardOff: {backgroundColor: c.surfaceMuted},
  info: {flex: 1},
  time: {fontSize: 43, lineHeight: 48, letterSpacing: -1.7, fontWeight: '300', color: c.ink},
  label: {fontSize: 15, fontWeight: '600', color: c.ink, marginTop: 4},
  meta: {fontSize: 13, color: c.muted, marginTop: 3},
  hint: {fontSize: 9, letterSpacing: 1.2, fontWeight: '700', color: c.disabled, marginTop: 9},
  textOff: {color: c.disabled},
  controls: {alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 2},
  deleteBtn: {padding: 8},
  sequence: {marginTop: -2, marginBottom: 8, marginHorizontal: 12, padding: 10, borderRadius: 18, backgroundColor: c.accentPale},
  sequenceRow: {flexDirection: 'row', alignItems: 'center', minHeight: 34, paddingHorizontal: 8},
  sequenceIndex: {width: 28, fontSize: 11, color: c.disabled, fontWeight: '700'},
  sequenceTime: {width: 70, fontSize: 16, color: c.ink, fontWeight: '600'},
  sequenceDay: {fontSize: 12, color: c.muted},
});
