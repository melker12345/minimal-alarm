import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Vibration} from 'react-native';

/**
 * A countdown timer whose truth is a target end-timestamp, not a tick counter.
 * That means it keeps correct time across tab switches (the hook lives above the
 * screens) and app backgrounding (JS timers pause; we recompute from the clock).
 */
export function useTimer() {
  const [durationSec, setDurationSec] = useState(10 * 60);
  const [minutesInput, setMinutesInput] = useState('10');
  const [remaining, setRemaining] = useState(10 * 60);
  const endsAt = useRef<number | null>(null); // ms epoch, or null when paused
  const [running, setRunning] = useState(false);

  const recompute = useCallback(() => {
    if (endsAt.current == null) return;
    const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
    setRemaining(left);
    if (left <= 0) {
      endsAt.current = null;
      setRunning(false);
      Vibration.vibrate([0, 120, 80, 120]);
    }
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(recompute, 250);
    return () => clearInterval(interval);
  }, [running, recompute]);

  // Re-sync the instant the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') recompute();
    });
    return () => sub.remove();
  }, [recompute]);

  const setMinutes = useCallback(
    (value: string) => {
      const clean = value.replace(/\D/g, '').slice(0, 3);
      setMinutesInput(clean);
      const next = Math.max(0, Number(clean) || 0) * 60;
      setDurationSec(next);
      if (endsAt.current == null) setRemaining(next);
    },
    [],
  );

  const toggle = useCallback(() => {
    Vibration.vibrate(10);
    if (endsAt.current != null) {
      // Pause: freeze the remaining time.
      recompute();
      endsAt.current = null;
      setRunning(false);
    } else {
      const seconds = remaining > 0 ? remaining : durationSec;
      if (seconds <= 0) return;
      endsAt.current = Date.now() + seconds * 1000;
      setRemaining(seconds);
      setRunning(true);
    }
  }, [remaining, durationSec, recompute]);

  const reset = useCallback(() => {
    endsAt.current = null;
    setRunning(false);
    setRemaining(durationSec);
  }, [durationSec]);

  return {durationSec, minutesInput, remaining, running, setMinutes, toggle, reset};
}

export type TimerController = ReturnType<typeof useTimer>;
