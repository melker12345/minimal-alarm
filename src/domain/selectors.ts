import {Alarm} from './alarm';

/** Minutes-since-midnight, used to order alarms chronologically. */
export const minuteOfDay = (alarm: Pick<Alarm, 'hour' | 'minute'>) => alarm.hour * 60 + alarm.minute;

export const activeAlarms = (alarms: Alarm[]) => alarms.filter(alarm => alarm.enabled);

/** Minutes from `now` until this alarm actually fires, honoring repeat days. */
export const minutesUntilNext = (alarm: Pick<Alarm, 'hour' | 'minute' | 'days'>, now: Date = new Date()): number => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const target = minuteOfDay(alarm);
  if (alarm.days.length === 0) {
    const diff = target - nowMinutes;
    return diff > 0 ? diff : diff + 24 * 60;
  }
  const today = ((now.getDay() + 6) % 7) + 1; // Monday = 1 … Sunday = 7
  for (let offset = 0; offset <= 7; offset++) {
    const day = ((today - 1 + offset) % 7) + 1;
    if (!alarm.days.includes(day)) continue;
    const diff = offset * 24 * 60 + target - nowMinutes;
    if (diff > 0) return diff;
  }
  return 7 * 24 * 60 + target - nowMinutes;
};

/** The enabled alarm that will actually ring soonest. */
export const nextAlarm = (alarms: Alarm[], now: Date = new Date()): Alarm | undefined =>
  [...activeAlarms(alarms)].sort((a, b) => minutesUntilNext(a, now) - minutesUntilNext(b, now))[0];

/** Alarms bucketed by their display group, each bucket sorted by time. */
export const groupedAlarms = (alarms: Alarm[]): [string, Alarm[]][] => {
  const grouped = new Map<string, Alarm[]>();
  alarms.forEach(alarm => grouped.set(alarm.group, [...(grouped.get(alarm.group) ?? []), alarm]));
  return [...grouped.entries()].map(([group, items]) => [
    group,
    [...items].sort((a, b) => minuteOfDay(a) - minuteOfDay(b)),
  ]);
};

export const isDuplicate = (alarms: Alarm[], candidate: Alarm) =>
  alarms.some(
    item =>
      item.id !== candidate.id &&
      item.kind === candidate.kind &&
      item.hour === candidate.hour &&
      item.minute === candidate.minute &&
      item.count === candidate.count &&
      item.spacingMinutes === candidate.spacingMinutes &&
      item.days.join(',') === candidate.days.join(','),
  );
