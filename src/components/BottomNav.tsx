import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Text} from 'react-native-paper';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {Tappable} from './Tappable';

export type Tab = 'alarms' | 'timer';

const items: {id: Tab; label: string; icon: string}[] = [
  {id: 'alarms', label: 'Alarms', icon: 'alarm'},
  {id: 'timer', label: 'Timer', icon: 'timer-outline'},
];

export function BottomNav({activeTab, onChange, bottom}: {activeTab: Tab; onChange: (tab: Tab) => void; bottom: number}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.wrap, {bottom}]}>
      <View style={styles.nav}>
        {items.map(item => {
          const active = activeTab === item.id;
          return (
            <Tappable
              key={item.id}
              onPress={() => onChange(item.id)}
              frame={[styles.item, active && styles.itemActive]}
              style={styles.itemInner}
              accessibilityRole="tab"
              accessibilityState={{selected: active}}>
              <MaterialCommunityIcons name={item.icon} size={20} color={active ? c.accent : c.muted} />
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Tappable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  wrap: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  nav: {
    height: 64,
    padding: 6,
    borderRadius: 24,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    flexDirection: 'row',
    gap: 5,
    elevation: 5,
    shadowColor: '#0B1220',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
  },
  item: {minWidth: 112, height: 52, borderRadius: 19},
  itemInner: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 15},
  itemActive: {backgroundColor: c.accentSoft},
  // includeFontPadding: Android reserves extra space under the baseline, which
  // sinks the label — without it icon + text share a true vertical center.
  label: {fontSize: 14, lineHeight: 18, fontWeight: '600', color: c.muted, includeFontPadding: false},
  labelActive: {color: c.accent},
});
