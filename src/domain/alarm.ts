export type LightProgram = 'instant' | 'sunrise' | 'party';

export type Alarm = {
  id: string;
  kind: 'alarm' | 'sequence';
  hour: number;
  minute: number;
  label: string;
  days: number[];
  enabled: boolean;
  group: string;
  count: number;
  spacingMinutes: number;
  ringtone: 'default' | 'intense' | 'calm' | 'ramp' | 'short';
  // Philips Hue "wake with light"
  hueEnabled: boolean;
  lightProgram: LightProgram;
  fadeMinutes: number; // sunrise: minutes before the alarm the fade begins (peak at ring time)
  startWarmth: number; // 0 = cool daylight … 100 = very warm candle
  endWarmth: number; // sunrise target after the cool shift
  coolShiftMinutes: number; // sunrise: warm→cool transition length at wake (0 = none)
  brightness: number; // peak brightness, 10–100
};

export type AlarmKind = Alarm['kind'];
export type Ringtone = Alarm['ringtone'];

export const lightProgramOptions: {id: LightProgram; label: string; icon: string}[] = [
  {id: 'instant', label: 'Instant', icon: 'lightbulb-on-outline'},
  {id: 'sunrise', label: 'Sunrise', icon: 'weather-sunset-up'},
  {id: 'party', label: 'Party', icon: 'party-popper'},
];

// Defaults for a freshly enabled light program.
export const defaultLight = {
  hueEnabled: false,
  lightProgram: 'sunrise' as LightProgram,
  fadeMinutes: 30,
  startWarmth: 92,
  endWarmth: 20,
  coolShiftMinutes: 5,
  brightness: 100,
};

// Warmth (0 cool … 100 warm) → Hue mired colour temperature (153 cool … 500 warm).
export const warmthToCt = (warmth: number) => Math.round(153 + (Math.max(0, Math.min(100, warmth)) / 100) * (500 - 153));
// Brightness percent → Hue bri (1 … 254).
export const brightnessToBri = (pct: number) => Math.max(1, Math.round((Math.max(0, Math.min(100, pct)) / 100) * 254));

export function warmthLabel(warmth: number) {
  if (warmth >= 80) return 'Very warm';
  if (warmth >= 55) return 'Warm';
  if (warmth >= 35) return 'Neutral';
  if (warmth >= 15) return 'Cool';
  return 'Daylight';
}

// Fields the user actually chooses; id/group/enabled/label are derived on save.
export type AlarmDraft = Omit<Alarm, 'id' | 'group' | 'enabled' | 'label'>;

export const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const ringtoneOptions: {id: Ringtone; label: string; icon: string}[] = [
  {id: 'default', label: 'Default', icon: 'bell-outline'},
  {id: 'intense', label: 'Intense', icon: 'volume-high'},
  {id: 'calm', label: 'Calm', icon: 'weather-night'},
  {id: 'ramp', label: 'Ramp up', icon: 'chart-bell-curve-cumulative'},
  {id: 'short', label: 'Short & loud', icon: 'bell-alert-outline'},
];

export function ringtoneLabel(id: Ringtone) {
  return ringtoneOptions.find(option => option.id === id)?.label ?? 'Default';
}

export function timeText(alarm: Pick<Alarm, 'hour' | 'minute'>) {
  const displayHour = alarm.hour === 0 ? 24 : alarm.hour;
  return `${String(displayHour).padStart(2, '0')}:${String(alarm.minute).padStart(2, '0')}`;
}

export function daysText(days: number[]) {
  const sorted = [...days].sort();
  if (sorted.length === 0) return 'Once';
  if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join(',') === '6,7') return 'Weekends';
  if (sorted.length === 7) return 'Every day';
  return sorted.map(day => dayLabels[day - 1]).join('  ');
}

/** Shift repeat days by whole days (negative = earlier), wrapping Mon(1)–Sun(7). */
export function shiftDays(days: number[], shift: number) {
  return days.map(day => ((((day - 1 + shift) % 7) + 7) % 7) + 1).sort((a, b) => a - b);
}

export function sequenceTimes(alarm: Pick<Alarm, 'hour' | 'minute' | 'count' | 'spacingMinutes'>) {
  return Array.from({length: alarm.count}, (_, index) => {
    const raw = alarm.hour * 60 + alarm.minute - index * alarm.spacingMinutes;
    const total = ((raw % (24 * 60)) + 24 * 60) % (24 * 60);
    // Crossing midnight moves the occurrence to the previous day(s).
    const dayShift = Math.floor(raw / (24 * 60));
    return {hour: Math.floor(total / 60), minute: total % 60, dayShift};
  });
}
