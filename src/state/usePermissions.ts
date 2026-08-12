import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, PermissionsAndroid, Platform} from 'react-native';
import {exactAlarmAccess, fullScreenAccess, overlayAccess} from '../native/alarmScheduler';

const isAndroid = Platform.OS === 'android';

export type PermissionState = {
  exactAlarm: boolean;
  fullScreen: boolean;
  overlay: boolean;
};

/**
 * Centralizes the permissions an alarm app needs on modern Android/Samsung:
 *  - notifications (runtime, Android 13+)
 *  - exact-alarm scheduling (so it fires on the minute)
 *  - full-screen-intent (present over the lock screen)
 *  - "display over other apps" / overlay — the exemption that lets the ringing
 *    screen pop over everything even while the phone is unlocked and in use.
 * Re-checks whenever the app returns to the foreground (e.g. back from Settings).
 */
export function usePermissions() {
  const [state, setState] = useState<PermissionState>({exactAlarm: true, fullScreen: true, overlay: true});
  const nudged = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAndroid) return;
    const [exactAlarm, fullScreen, overlay] = await Promise.all([
      exactAlarmAccess.check(),
      fullScreenAccess.check(),
      overlayAccess.check(),
    ]);
    setState({exactAlarm, fullScreen, overlay});
  }, []);

  useEffect(() => {
    if (!isAndroid) return;
    if (Number(Platform.Version) >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    refresh();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // One-time guided nudge if the alarm can't present itself automatically.
  useEffect(() => {
    if (!isAndroid || nudged.current) return;
    if (state.overlay && state.fullScreen) return;
    nudged.current = true;
    const timer = setTimeout(() => {
      Alert.alert(
        'Let alarms open automatically',
        'So the alarm screen appears instantly over everything — instead of a notification you have to tap first — Minimal Alarm needs “Display over other apps”. We’ll open that screen; turn it on for Minimal Alarm.',
        [
          {text: 'Later', style: 'cancel'},
          {
            text: 'Open settings',
            onPress: async () => {
              if (!state.overlay) await overlayAccess.openSettings();
              else await fullScreenAccess.openSettings();
            },
          },
        ],
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [state.overlay, state.fullScreen]);

  return {...state, refresh};
}

export const openExactAlarmSettings = () => exactAlarmAccess.openSettings();
export const openFullScreenSettings = () => fullScreenAccess.openSettings();
export const openOverlaySettings = () => overlayAccess.openSettings();
