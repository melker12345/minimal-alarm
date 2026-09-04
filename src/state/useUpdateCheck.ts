import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {appVersion} from '../native/alarmScheduler';

const REPO = 'melker12345/minimal-alarm';
const CHECK_EVERY_MS = 60 * 60 * 1000; // at most once an hour

export type AvailableUpdate = {version: string; apkUrl: string};

/** "v1.2.3" / "1.2.3-rc1" → [1, 2, 3]; null if it doesn't look like a version. */
export const parseVersion = (raw: string): number[] | null => {
  const match = raw.trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : null;
};

/** > 0 when `a` is newer than `b`. */
export const compareVersions = (a: string, b: string): number => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0; // unparseable: never force anything
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
};

/**
 * Checks the GitHub release feed for a version newer than the running app.
 * Fails silent (offline, rate-limited, bad data → no update gate); only a
 * confirmed newer release with an APK asset blocks the app.
 */
export function useUpdateCheck() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    lastCheck.current = Date.now();
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: {Accept: 'application/vnd.github+json'},
      });
      if (!res.ok) return;
      const release = (await res.json()) as {tag_name?: string; assets?: {name: string; browser_download_url: string}[]};
      const tag = release.tag_name ?? '';
      const apk = release.assets?.find(asset => asset.name.endsWith('.apk'));
      if (apk && compareVersions(tag, appVersion) > 0) {
        setUpdate({version: tag.replace(/^v/, ''), apkUrl: apk.browser_download_url});
      }
    } catch {
      // Offline or GitHub unreachable — never block the app over that.
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  return update;
}
