import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useEffect, useState} from 'react';
import {Vibration} from 'react-native';
import {Alarm, AlarmDraft, defaultLight} from '../domain/alarm';
import {isDuplicate} from '../domain/selectors';
import {alarmScheduler} from '../native/alarmScheduler';

const STORAGE_KEY = '@minimal-alarm/alarms';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const decorate = (draft: AlarmDraft, base?: Alarm): Alarm => ({
  ...draft,
  id: base?.id ?? makeId(),
  enabled: base?.enabled ?? true,
  label: draft.kind === 'sequence' ? 'Wake-up sequence' : 'Wake up',
  group: draft.kind === 'sequence' ? 'Wake-up sequences' : 'Morning',
});

/**
 * Owns the full alarm list: hydration from disk, persistence, and keeping the
 * native scheduler in sync. Every mutation goes through here so the JS list and
 * the OS-level alarms can never drift apart — one source of truth.
 */
export function useAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (!value) return;
        const stored = JSON.parse(value) as Alarm[];
        // Backfill fields added in later versions so older saved alarms stay valid.
        setAlarms(
          stored.map(alarm => ({
            ...defaultLight,
            ...alarm,
            hueEnabled: alarm.hueEnabled ?? false,
            lightProgram: alarm.lightProgram ?? defaultLight.lightProgram,
          })),
        );
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  }, [alarms, hydrated]);

  /** Returns false (and changes nothing, schedules nothing) for a duplicate. */
  const save = useCallback(
    (draft: AlarmDraft, editing?: Alarm): boolean => {
      const alarm = decorate(draft, editing);
      if (isDuplicate(alarms, alarm)) return false;
      setAlarms(previous => (editing ? previous.map(item => (item.id === editing.id ? alarm : item)) : [...previous, alarm]));
      if (editing) alarmScheduler.cancel(editing.id);
      if (alarm.enabled) alarmScheduler.schedule(alarm);
      return true;
    },
    [alarms],
  );

  const toggle = useCallback((alarm: Alarm) => {
    const updated = {...alarm, enabled: !alarm.enabled};
    Vibration.vibrate(10);
    setAlarms(previous => previous.map(item => (item.id === alarm.id ? updated : item)));
    if (updated.enabled) alarmScheduler.schedule(updated);
    else alarmScheduler.cancel(alarm.id);
  }, []);

  const remove = useCallback((alarm: Alarm) => {
    setAlarms(previous => previous.filter(item => item.id !== alarm.id));
    alarmScheduler.cancel(alarm.id);
  }, []);

  return {alarms, hydrated, save, toggle, remove};
}
