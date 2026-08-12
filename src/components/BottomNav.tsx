import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Text} from 'react-native-paper';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';

export type Tab = 'alarms' | 'timer';

const items: {id: Tab; label: string; icon: string}[] = [
  {id: 'alarms', label: 'Alarms', icon: 'alarm'},
  {id: 'timer', label: 'Timer', icon: 'timer-outline'},
];

export function BottomNav({activeTab, onChange}: {activeTab: Tab; onChange: (tab: Tab) => void}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        {items.map(item => {
          const active = activeTab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(item.id)}
              style={[styles.item, active && styles.itemActive]}
              accessibilityRole="tab"
              accessibilityState={{selected: active}}>
              <MaterialCommunityIcons name={item.icon} size={20} color={active ? c.accent : c.muted} />
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  wrap: {position: 'absolute', left: 0, right: 0, bottom: 22, alignItems: 'center'},
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
  item: {minWidth: 112, height: 52, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 15},
  itemActive: {backgroundColor: c.accentSoft},
  label: {fontSize: 14, fontWeight: '600', color: c.muted},
  labelActive: {color: c.accent},
});
