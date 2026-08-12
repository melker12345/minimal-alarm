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

describe('nextAlarm', () => {
  test('returns the earliest enabled alarm by time of day', () => {
    const early = make({id: 'a', hour: 6, minute: 30});
    const late = make({id: 'b', hour: 9, minute: 0});
    expect(nextAlarm([late, early])?.id).toBe('a');
  });

  test('ignores disabled alarms', () => {
    const disabledEarly = make({id: 'a', hour: 5, minute: 0, enabled: false});
    const active = make({id: 'b', hour: 8, minute: 0});
    expect(nextAlarm([disabledEarly, active])?.id).toBe('b');
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
