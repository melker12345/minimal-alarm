import {Alarm} from './alarm';

/** Minutes-since-midnight, used to order alarms chronologically. */
export const minuteOfDay = (alarm: Pick<Alarm, 'hour' | 'minute'>) => alarm.hour * 60 + alarm.minute;

export const activeAlarms = (alarms: Alarm[]) => alarms.filter(alarm => alarm.enabled);

/** The soonest enabled alarm by wall-clock time (not accounting for weekday). */
export const nextAlarm = (alarms: Alarm[]): Alarm | undefined =>
  [...activeAlarms(alarms)].sort((a, b) => minuteOfDay(a) - minuteOfDay(b))[0];

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
