import React, {useMemo, useState} from 'react';
import {Alert, StatusBar, StyleSheet, View} from 'react-native';
import {FAB, Portal} from 'react-native-paper';
import {SafeAreaProvider, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import {Alarm, AlarmDraft, AlarmKind, timeText} from './src/domain/alarm';
import {Colors} from './src/design/theme';
import {ThemeProvider, useColors, useScheme} from './src/design/ThemeProvider';
import {useAlarms} from './src/state/useAlarms';
import {useTimer} from './src/state/useTimer';
import {openExactAlarmSettings, openFullScreenSettings, openOverlaySettings, usePermissions} from './src/state/usePermissions';
import {AlarmsScreen} from './src/screens/AlarmsScreen';
import {TimerScreen} from './src/screens/TimerScreen';
import {BottomNav, Tab} from './src/components/BottomNav';
import {CreateSheet} from './src/components/CreateSheet';
import {SettingsModal} from './src/components/SettingsModal';
import {UpdateGate} from './src/components/UpdateGate';
import {HueScreen} from './src/screens/HueScreen';
import {useUpdateCheck} from './src/state/useUpdateCheck';

function AlarmApp() {
  const c = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  // Keep the nav pill (and the FAB above it) clear of the system bar.
  const navBottom = Math.max(22, insets.bottom + 10);
  const styles = useMemo(() => makeStyles(c), [c]);

  const {alarms, save, toggle, remove} = useAlarms();
  const permissions = usePermissions();
  const timer = useTimer();
  const update = useUpdateCheck();

  const [activeTab, setActiveTab] = useState<Tab>('alarms');
  const [sheetKind, setSheetKind] = useState<AlarmKind | null>(null);
  const [editing, setEditing] = useState<Alarm | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hueOpen, setHueOpen] = useState(false);

  const openCreate = (kind: AlarmKind = 'alarm') => {
    setEditing(undefined);
    setSheetKind(kind);
  };
  const openEdit = (alarm: Alarm) => {
    setEditing(alarm);
    setSheetKind(alarm.kind);
  };
  const closeSheet = () => {
    setEditing(undefined);
    setSheetKind(null);
  };
  const handleSave = (draft: AlarmDraft) => {
    if (save(draft, editing)) closeSheet();
    else Alert.alert('Already set', 'An identical alarm already exists.');
  };
  const openSettings = () => {
    permissions.refresh();
    setSettingsOpen(true);
  };
  const confirmDelete = (alarm: Alarm) => {
    Alert.alert('Delete alarm?', `The ${timeText(alarm)} alarm will be removed.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => remove(alarm)},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={c.canvas} />
      <View style={styles.page}>
        {activeTab === 'alarms' ? (
          <AlarmsScreen
            alarms={alarms}
            onCreate={() => openCreate()}
            onEdit={openEdit}
            onToggle={toggle}
            onDelete={confirmDelete}
            onOpenSettings={openSettings}
          />
        ) : (
          <TimerScreen timer={timer} />
        )}
        {activeTab === 'alarms' ? (
          <FAB
            icon="plus"
            label="New alarm"
            onPress={() => openCreate()}
            style={[styles.fab, {bottom: navBottom + 78}]}
            color={c.onAccent}
            customSize={56}
          />
        ) : null}
        <BottomNav activeTab={activeTab} onChange={setActiveTab} bottom={navBottom} />
      </View>
      <Portal>
        {sheetKind ? <CreateSheet kind={sheetKind} initial={editing} onDismiss={closeSheet} onSave={handleSave} /> : null}
        {settingsOpen ? (
          <SettingsModal
            exactAllowed={permissions.exactAlarm}
            fullScreenAllowed={permissions.fullScreen}
            overlayAllowed={permissions.overlay}
            onOpenExact={openExactAlarmSettings}
            onOpenFullScreen={openFullScreenSettings}
            onOpenOverlay={openOverlaySettings}
            onOpenHue={() => {
              setSettingsOpen(false);
              setHueOpen(true);
            }}
            onDismiss={() => setSettingsOpen(false)}
          />
        ) : null}
        {hueOpen ? <HueScreen onClose={() => setHueOpen(false)} /> : null}
        {update ? <UpdateGate update={update} /> : null}
      </Portal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlarmApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.canvas},
    page: {flex: 1, backgroundColor: c.canvas},
    // Sits above the bottom nav pill so it's never covered.
    fab: {position: 'absolute', right: 22, backgroundColor: c.accent, borderRadius: 18},
  });
