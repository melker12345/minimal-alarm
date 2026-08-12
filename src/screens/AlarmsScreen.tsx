import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Button, Surface, Text} from 'react-native-paper';
import {Alarm} from '../domain/alarm';
import {activeAlarms as selectActive, groupedAlarms, nextAlarm as selectNext} from '../domain/selectors';
import {Colors, spacing} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {AlarmCard} from '../components/AlarmCard';
import {NextUpCard} from '../components/NextUpCard';

type Props = {
  alarms: Alarm[];
  onCreate: () => void;
  onEdit: (alarm: Alarm) => void;
  onToggle: (alarm: Alarm) => void;
  onDelete: (alarm: Alarm) => void;
  onOpenSettings: () => void;
};

export function AlarmsScreen({alarms, onCreate, onEdit, onToggle, onDelete, onOpenSettings}: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const active = useMemo(() => selectActive(alarms), [alarms]);
  const next = useMemo(() => selectNext(alarms), [alarms]);
  const groups = useMemo(() => groupedAlarms(alarms), [alarms]);

  const toggleExpand = (id: string) =>
    setExpanded(previous => {
      const nextSet = new Set(previous);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MINIMAL ALARM</Text>
          <Text style={styles.title}>Wake well.</Text>
          <Text style={styles.subtitle}>
            {active.length ? `${active.length} active alarm${active.length === 1 ? '' : 's'}` : 'Nothing active right now'}
          </Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={onOpenSettings} accessibilityLabel="Open settings">
          <MaterialCommunityIcons name="cog-outline" size={24} color={c.ink} />
        </Pressable>
      </View>

      <NextUpCard alarm={next} />

      {alarms.length === 0 ? (
        <View style={styles.empty}>
          <Surface style={styles.emptyIcon} elevation={0}>
            <Text style={styles.emptyIconText}>✦</Text>
          </Surface>
          <Text style={styles.emptyTitle}>A calmer way to wake</Text>
          <Text style={styles.emptyCopy}>Create one alarm or a gentle sequence of alarms for your morning.</Text>
          <Button mode="contained" onPress={onCreate} style={styles.emptyBtn} contentStyle={styles.emptyBtnContent}>
            Create an alarm
          </Button>
        </View>
      ) : (
        <View style={styles.list}>
          {groups.map(([group, groupAlarms]) => (
            <View key={group} style={styles.group}>
              <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
              {groupAlarms.map(alarm => (
                <AlarmCard
                  key={alarm.id}
                  alarm={alarm}
                  expanded={expanded.has(alarm.id)}
                  onPress={() => alarm.kind === 'sequence' && toggleExpand(alarm.id)}
                  onToggle={() => onToggle(alarm)}
                  onDelete={() => onDelete(alarm)}
                  onEdit={() => onEdit(alarm)}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  scroll: {paddingHorizontal: spacing.page, paddingTop: 20, paddingBottom: 150},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24},
  eyebrow: {fontSize: 11, letterSpacing: 2, fontWeight: '700', color: c.accent, marginBottom: 8},
  title: {fontSize: 38, lineHeight: 44, letterSpacing: -1.5, fontWeight: '700', color: c.ink},
  subtitle: {fontSize: 15, color: c.muted, marginTop: 5},
  iconBtn: {width: 48, height: 48, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center'},
  empty: {alignItems: 'center', paddingTop: 34, paddingHorizontal: 22},
  emptyIcon: {width: 64, height: 64, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 18},
  emptyIconText: {fontSize: 28, color: c.onAccent},
  emptyTitle: {fontSize: 22, fontWeight: '700', color: c.ink},
  emptyCopy: {fontSize: 15, lineHeight: 22, textAlign: 'center', color: c.muted, marginTop: 8, maxWidth: 270},
  emptyBtn: {marginTop: 22, borderRadius: 16},
  emptyBtnContent: {height: 50},
  list: {gap: spacing.section},
  group: {gap: 10},
  groupLabel: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: c.muted},
});
