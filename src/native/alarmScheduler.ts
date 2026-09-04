import {NativeModules} from 'react-native';
import {Alarm} from '../domain/alarm';

type AlarmSchedulerModule = {
  schedule(alarm: Alarm): Promise<void>;
  cancel(id: string): Promise<void>;
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenSettings(): Promise<void>;
  canDrawOverlays(): Promise<boolean>;
  openOverlaySettings(): Promise<void>;
  setHueCredentials(ip: string, username: string): Promise<void>;
  clearHueCredentials(): Promise<void>;
  previewRingtone(profile: Alarm['ringtone']): Promise<void>;
  stopRingtonePreview(): Promise<void>;
  downloadAndInstallUpdate(url: string): Promise<void>;
  versionName?: string;
};

const nativeScheduler = NativeModules.AlarmScheduler as AlarmSchedulerModule | undefined;

export const alarmScheduler = {
  schedule: (alarm: Alarm) => nativeScheduler?.schedule(alarm) ?? Promise.resolve(),
  cancel: (id: string) => nativeScheduler?.cancel(id) ?? Promise.resolve(),
};

export const exactAlarmAccess = {
  check: () => nativeScheduler?.canScheduleExactAlarms() ?? Promise.resolve(true),
  openSettings: () => nativeScheduler?.openExactAlarmSettings() ?? Promise.resolve(),
};

export const fullScreenAccess = {
  check: () => nativeScheduler?.canUseFullScreenIntent() ?? Promise.resolve(true),
  openSettings: () => nativeScheduler?.openFullScreenSettings() ?? Promise.resolve(),
};

export const overlayAccess = {
  check: () => nativeScheduler?.canDrawOverlays() ?? Promise.resolve(true),
  openSettings: () => nativeScheduler?.openOverlaySettings() ?? Promise.resolve(),
};

// Mirror the Hue bridge credentials into native storage so the alarm receiver
// (which runs with no JS) can turn the lights on at ring time.
export const hueCredentials = {
  save: (ip: string, username: string) => nativeScheduler?.setHueCredentials(ip, username) ?? Promise.resolve(),
  clear: () => nativeScheduler?.clearHueCredentials() ?? Promise.resolve(),
};

export const appVersion: string = nativeScheduler?.versionName ?? '0.0.0';

export const appUpdater = {
  downloadAndInstall: (url: string) => nativeScheduler?.downloadAndInstallUpdate(url) ?? Promise.resolve(),
};

export const ringtonePreview = {
  play: (profile: Alarm['ringtone']) => nativeScheduler?.previewRingtone(profile) ?? Promise.resolve(),
  stop: () => nativeScheduler?.stopRingtonePreview() ?? Promise.resolve(),
};
