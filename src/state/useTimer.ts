import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Vibration} from 'react-native';
import {timerScheduler} from '../native/alarmScheduler';

export type TimerPhase = 'idle' | 'running' | 'paused' | 'finished';

const STORAGE_KEY = '@minimal-alarm/timer';

type Stored = {phase: TimerPhase; durationSec: number; remaining: number; endsAt: number | null};

/**
 * Countdown timer whose truth is a target end-timestamp, mirrored into a
 * native one-shot alarm so it rings (full-screen, with sound) even when the
 * app is backgrounded or killed. State persists across app restarts.
 */
export function useTimer() {
  const [durationSec, setDurationSec] = useState(10 * 60);
  const [remaining, setRemaining] = useState(10 * 60);
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const endsAt = useRef<number | null>(null);
  const hydrated = useRef(false);

  const persist = useCallback((data: Stored) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, []);

  const recompute = useCallback(() => {
    if (endsAt.current == null) return;
    const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
    setRemaining(left);
    if (left <= 0) {
      // The native alarm handles the actual ringing; this is just UI state.
      endsAt.current = null;
      setPhase('finished');
      Vibration.vibrate([0, 120, 80, 120]);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, []);

  // Restore a timer that was running or paused when the app last closed.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (!value) return;
        const saved = JSON.parse(value) as Stored;
        setDurationSec(saved.durationSec);
        if (saved.phase === 'running' && saved.endsAt && saved.endsAt > Date.now()) {
          endsAt.current = saved.endsAt;
          setPhase('running');
          setRemaining(Math.max(0, Math.round((saved.endsAt - Date.now()) / 1000)));
        } else if (saved.phase === 'paused') {
          setPhase('paused');
          setRemaining(saved.remaining);
        } else {
          // Expired while the app was closed — the native alarm already rang.
          setRemaining(saved.durationSec);
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      })
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  useEffect(() => {
    if (phase !== 'running') return undefined;
    const interval = setInterval(recompute, 250);
    return () => clearInterval(interval);
  }, [phase, recompute]);

  // Re-sync the instant the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') recompute();
    });
    return () => sub.remove();
  }, [recompute]);

  /** Pick a new duration (idle only — wheels drive this). */
  const setDuration = useCallback((totalSec: number) => {
    setDurationSec(totalSec);
    setRemaining(totalSec);
  }, []);

  const start = useCallback(() => {
    const seconds = remaining > 0 ? remaining : durationSec;
    if (seconds <= 0) return;
    Vibration.vibrate(10);
    const target = Date.now() + seconds * 1000;
    endsAt.current = target;
    setRemaining(seconds);
    setPhase('running');
    timerScheduler.schedule(target);
    persist({phase: 'running', durationSec, remaining: seconds, endsAt: target});
  }, [remaining, durationSec, persist]);

  const pause = useCallback(() => {
    Vibration.vibrate(10);
    recompute();
    endsAt.current = null;
    setPhase('paused');
    timerScheduler.cancel();
    persist({phase: 'paused', durationSec, remaining, endsAt: null});
  }, [recompute, durationSec, remaining, persist]);

  const reset = useCallback(() => {
    endsAt.current = null;
    setPhase('idle');
    setRemaining(durationSec);
    timerScheduler.cancel();
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, [durationSec]);

  /** One more minute — mid-run it also pushes the native alarm back. */
  const addMinute = useCallback(() => {
    Vibration.vibrate(10);
    if (endsAt.current != null) {
      const target = endsAt.current + 60_000;
      endsAt.current = target;
      setRemaining(previous => previous + 60);
      timerScheduler.schedule(target);
      persist({phase: 'running', durationSec, remaining: remaining + 60, endsAt: target});
    } else {
      setRemaining(previous => previous + 60);
    }
  }, [durationSec, remaining, persist]);

  return {durationSec, remaining, phase, endsAt: endsAt.current, setDuration, start, pause, reset, addMinute};
}

export type TimerController = ReturnType<typeof useTimer>;
