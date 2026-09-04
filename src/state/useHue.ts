import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useEffect, useRef, useState} from 'react';
import {HueBridge, HueCreds, HueLight, LinkButtonNotPressed, discoverBridges, fetchLights, pair, setLight} from '../native/hue';
import {hueCredentials} from '../native/alarmScheduler';

const CREDS_KEY = '@minimal-alarm/hue-creds';

export type HueStatus =
  | {kind: 'idle'}
  | {kind: 'discovering'}
  | {kind: 'pairing'; message: string}
  | {kind: 'connected'}
  | {kind: 'error'; message: string};

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Setup + control state for a Philips Hue bridge on the local network. */
export function useHue() {
  const [creds, setCreds] = useState<HueCreds | null>(null);
  const [bridges, setBridges] = useState<HueBridge[]>([]);
  const [lights, setLights] = useState<HueLight[]>([]);
  const [status, setStatus] = useState<HueStatus>({kind: 'idle'});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CREDS_KEY)
      .then(value => {
        if (value) {
          const saved = JSON.parse(value) as HueCreds;
          setCreds(saved);
          setStatus({kind: 'connected'});
          // Keep native storage in sync (used to fire lights at alarm time).
          hueCredentials.save(saved.ip, saved.username);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const refreshLights = useCallback(async (using?: HueCreds) => {
    const active = using ?? creds;
    if (!active) return;
    try {
      setLights(await fetchLights(active));
    } catch (err: any) {
      setStatus({kind: 'error', message: err?.message ?? 'Could not reach the bridge'});
    }
  }, [creds]);

  useEffect(() => {
    if (hydrated && creds) refreshLights(creds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const discover = useCallback(async () => {
    setStatus({kind: 'discovering'});
    try {
      const found = await discoverBridges();
      setBridges(found);
      setStatus(found.length ? {kind: 'idle'} : {kind: 'error', message: 'No bridge found. Enter its IP manually.'});
    } catch {
      setStatus({kind: 'error', message: 'Discovery failed. Check Wi-Fi or enter the IP manually.'});
    }
  }, []);

  /** Polls the bridge for ~30s while the user presses the link button. */
  const connect = useCallback(
    async (ip: string) => {
      for (let attempt = 0; attempt < 15; attempt++) {
        setStatus({kind: 'pairing', message: 'Press the round button on your Hue bridge…'});
        try {
          const username = await pair(ip);
          const nextCreds = {ip, username};
          await AsyncStorage.setItem(CREDS_KEY, JSON.stringify(nextCreds));
          await hueCredentials.save(ip, username);
          setCreds(nextCreds);
          setStatus({kind: 'connected'});
          await refreshLights(nextCreds);
          return true;
        } catch (err) {
          if (err instanceof LinkButtonNotPressed) {
            await delay(2000);
            continue;
          }
          setStatus({kind: 'error', message: (err as Error)?.message ?? 'Pairing failed'});
          return false;
        }
      }
      setStatus({kind: 'error', message: 'Timed out. Press the bridge button, then try again.'});
      return false;
    },
    [refreshLights],
  );

  // Bumped per light on every toggle so a slow request can't revert a newer one.
  const toggleSeq = useRef(new Map<string, number>());

  const toggleLight = useCallback(
    async (light: HueLight) => {
      if (!creds) return;
      const next = !light.on;
      const seq = (toggleSeq.current.get(light.id) ?? 0) + 1;
      toggleSeq.current.set(light.id, seq);
      setLights(previous => previous.map(item => (item.id === light.id ? {...item, on: next} : item)));
      try {
        await setLight(creds, light.id, next);
      } catch {
        // Only roll back if this is still the latest toggle for the light.
        if (toggleSeq.current.get(light.id) === seq) {
          setLights(previous => previous.map(item => (item.id === light.id ? {...item, on: light.on} : item)));
        }
      }
    },
    [creds],
  );

  /** Flash every light on, then restore each to how it was before the test. */
  const testLights = useCallback(async () => {
    if (!creds || !lights.length) return;
    const before = lights.map(light => ({id: light.id, on: light.on}));
    await Promise.all(lights.map(light => setLight(creds, light.id, true).catch(() => {})));
    await delay(1200);
    await Promise.all(before.map(light => setLight(creds, light.id, light.on).catch(() => {})));
    await refreshLights(creds);
  }, [creds, lights, refreshLights]);

  const disconnect = useCallback(async () => {
    await AsyncStorage.removeItem(CREDS_KEY);
    await hueCredentials.clear();
    setCreds(null);
    setLights([]);
    setBridges([]);
    setStatus({kind: 'idle'});
  }, []);

  return {creds, bridges, lights, status, discover, connect, toggleLight, testLights, refreshLights, disconnect};
}
