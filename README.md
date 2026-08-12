# Minimal Alarm

A polished, local-first alarm app for Android. The UI is React Native and
TypeScript; reliability-critical alarm behavior stays in native Kotlin so it
works even when the JS runtime is not alive.

## Features

- Custom One UI-inspired alarm home screen with a live "Next up" card
- Single alarms and generated wake-up sequences
- Seven-day repeat selection, enable/disable, deletion
- iOS-style snap time wheels with tap-to-type override
- A calm countdown Timer tab
- Local persistence through AsyncStorage
- Native scheduling for exact alarms + reboot / clock-change recovery
- **Auto-presenting full-screen ringing screen** (over lock screen and home),
  with **Snooze (9 min)** and an attractive Stop button
- Guided permission onboarding (notifications, exact-alarm, full-screen-intent)

## Architecture

Single source of truth per concern, with a clean domain / state / native / UI split.

```text
App.tsx                          Thin shell: providers, tabs, modal wiring
src/domain/alarm.ts              Alarm model, ringtones, display helpers
src/domain/selectors.ts          Pure derivations (next alarm, grouping, dedupe)
src/state/useAlarms.ts           Owns the alarm list: persistence + native sync
src/state/usePermissions.ts      Notifications / exact-alarm / full-screen access
src/design/theme.ts              Design tokens (colors, spacing, radii)
src/native/alarmScheduler.ts     JS ⇆ native scheduling boundary
src/components/                  AlarmCard, CreateSheet, WheelColumn, BottomNav, …
src/screens/                     AlarmsScreen, TimerScreen
android/app/src/main/java/com/minimalalarm/
  AlarmSchedulerModule.kt        RN bridge: schedule / cancel / permissions
  AlarmReceiver.kt               Fires the alarm; launches the ringing UI (BAL)
  AlarmRingingService.kt         Single source of truth for sound + notification
  RingingActivity.kt             Full-screen ringing UI (singleInstance)
```

### How ringing works (why there are no more duplicate screens)

1. `AlarmReceiver` runs inside AlarmManager's short background-activity-launch
   grant, so it launches `RingingActivity` directly — the screen opens
   automatically even when the phone is unlocked and in use.
2. `AlarmRingingService` (foreground) owns the alarm sound and posts a
   high-importance notification carrying a **full-screen intent** — the fallback
   that presents the screen when the device is locked or the screen is off.
3. `RingingActivity` is `launchMode="singleInstance"` with its own task
   affinity, so both entry points collapse onto **one** screen. Pressing **Stop**
   stops the service (sound + notification) and finishes cleanly back to where
   you were — never onto a leftover duplicate screen.

## Local verification

```sh
npm run lint
npx tsc --noEmit
JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./android/gradlew -p android assembleRelease -PreactNativeArchitectures=arm64-v8a
```

> Build with **JDK 17**. The system default JDK (25/26) crashes Gradle.

The release APK is written to
`android/app/build/outputs/apk/release/app-release.apk` (arm64, ~22 MB, signed
with the debug key so it installs directly).

## Install on your phone (no ADB)

Put the phone on the same Wi-Fi as this computer, then:

```sh
python3 serve_apk.py            # auto-serves the newest built APK
# PORT=9000 python3 serve_apk.py   # optional custom port
```

It prints a `http://<your-computer-ip>:8000` URL. Open it in the phone's
browser, tap **Download APK**, then open the file to install. On first run,
grant the notification / alarm / full-screen prompts so alarms present
themselves automatically.
