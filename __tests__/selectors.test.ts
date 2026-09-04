/**
 * @format
 * Pure-domain tests — no React, no native, no async. This is the payoff of the
 * domain/state/native/UI split: the core logic is trivially testable.
 */
import {Alarm} from '../src/domain/alarm';
import {groupedAlarms, isDuplicate, nextAlarm} from '../src/domain/selectors';

const make = (over: Partial<Alarm>): Alarm => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  kind: 'alarm',
  hour: 7,
  minute: 0,
  label: 'Wake up',
  days: [1, 2, 3, 4, 5],
  enabled: true,
  group: 'Morning',
  count: 1,
  spacingMinutes: 0,
  ringtone: 'default',
  hueEnabled: false,
  lightProgram: 'sunrise',
  fadeMinutes: 30,
  startWarmth: 92,
  endWarmth: 20,
  coolShiftMinutes: 5,
  brightness: 100,
  ...over,
});

// A fixed Monday 03:00 so tests don't depend on when they run.
const mondayNight = new Date(2026, 0, 5, 3, 0);

describe('nextAlarm', () => {
  test('returns the alarm that rings soonest', () => {
    const early = make({id: 'a', hour: 6, minute: 30});
    const late = make({id: 'b', hour: 9, minute: 0});
    expect(nextAlarm([late, early], mondayNight)?.id).toBe('a');
  });

  test('an alarm already past today yields to one still ahead', () => {
    const morning = make({id: 'a', hour: 6, minute: 0, days: []});
    const tonight = make({id: 'b', hour: 23, minute: 30, days: []});
    expect(nextAlarm([morning, tonight], new Date(2026, 0, 5, 23, 0))?.id).toBe('b');
  });

  test('honors repeat days', () => {
    const weekendOnly = make({id: 'a', hour: 6, minute: 0, days: [6, 7]});
    const weekday = make({id: 'b', hour: 9, minute: 0, days: [1, 2, 3, 4, 5]});
    expect(nextAlarm([weekendOnly, weekday], mondayNight)?.id).toBe('b');
  });

  test('ignores disabled alarms', () => {
    const disabledEarly = make({id: 'a', hour: 5, minute: 0, enabled: false});
    const active = make({id: 'b', hour: 8, minute: 0});
    expect(nextAlarm([disabledEarly, active], mondayNight)?.id).toBe('b');
  });

  test('returns undefined when nothing is active', () => {
    expect(nextAlarm([make({enabled: false})])).toBeUndefined();
  });
});

describe('groupedAlarms', () => {
  test('buckets by group and sorts each bucket by time', () => {
    const groups = groupedAlarms([
      make({id: 'a', group: 'Morning', hour: 9}),
      make({id: 'b', group: 'Morning', hour: 6}),
      make({id: 'c', group: 'Wake-up sequences', kind: 'sequence'}),
    ]);
    const morning = groups.find(([name]) => name === 'Morning')![1];
    expect(morning.map(alarm => alarm.id)).toEqual(['b', 'a']);
    expect(groups.map(([name]) => name)).toContain('Wake-up sequences');
  });

  test('groups by actual time of day, in day order, sequences last', () => {
    const groups = groupedAlarms([
      make({id: 'night', hour: 23}),
      make({id: 'seq', kind: 'sequence', hour: 7}),
      make({id: 'evening', hour: 19}),
      make({id: 'morning', hour: 8}),
      make({id: 'afternoon', hour: 14}),
    ]);
    expect(groups.map(([name]) => name)).toEqual(['Morning', 'Afternoon', 'Evening', 'Night', 'Wake-up sequences']);
  });
});

describe('isDuplicate', () => {
  test('flags an identical alarm at the same time and cadence', () => {
    const existing = make({id: 'a', hour: 7, minute: 15});
    const clone = make({id: 'b', hour: 7, minute: 15});
    expect(isDuplicate([existing], clone)).toBe(true);
  });

  test('does not flag itself when editing', () => {
    const existing = make({id: 'a', hour: 7, minute: 15});
    expect(isDuplicate([existing], existing)).toBe(false);
  });
});
