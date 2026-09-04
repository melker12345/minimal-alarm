/**
 * @format
 */
import {compareVersions, parseVersion} from '../src/state/useUpdateCheck';

describe('parseVersion', () => {
  test('accepts v-prefixed and suffixed tags', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2')).toEqual([1, 2, 0]);
    expect(parseVersion('1.2.3-rc1')).toEqual([1, 2, 3]);
  });

  test('rejects garbage', () => {
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions', () => {
  test('orders semantically, not lexically', () => {
    expect(compareVersions('v1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3', 'v1.2.3')).toBe(0);
    expect(compareVersions('1.2.2', '1.2.10')).toBeLessThan(0);
  });

  test('never forces an update on unparseable input', () => {
    expect(compareVersions('latest', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '')).toBe(0);
  });
});
