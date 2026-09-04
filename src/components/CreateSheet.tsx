import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal as NativeModal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Gesture, GestureDetector, GestureHandlerRootView, State} from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Button, Divider, SegmentedButtons, Switch, Text, TextInput} from 'react-native-paper';
import {
  Alarm,
  AlarmDraft,
  AlarmKind,
  LightProgram,
  Ringtone,
  dayLabels,
  defaultLight,
  lightProgramOptions,
  ringtoneLabel,
  ringtoneOptions,
  warmthLabel,
} from '../domain/alarm';
import {ringtonePreview} from '../native/alarmScheduler';
import {hasHueBridge} from '../state/useHue';
import {Slider} from './Slider';
import {Tappable} from './Tappable';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {WheelColumn, WHEEL_HEIGHT} from './WheelColumn';

type Props = {
  kind: AlarmKind;
  initial?: Alarm;
  onDismiss: () => void;
  onSave: (draft: AlarmDraft) => void;
};

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const TRAVEL = Dimensions.get('window').height;

export function CreateSheet({kind, initial, onDismiss, onSave}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);

  const translateY = useRef(new Animated.Value(TRAVEL)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const [alarmKind, setAlarmKind] = useState<AlarmKind>(initial?.kind ?? kind);
  const [hour, setHour] = useState(initial ? (initial.hour === 0 ? 24 : initial.hour) : 7);
  const [minute, setMinute] = useState(initial?.minute ?? 0);
  const [days, setDays] = useState(initial?.days ?? ALL_DAYS);
  const [count, setCount] = useState(String(initial?.count ?? 5));
  const [spacingMinutes, setSpacingMinutes] = useState(String(initial?.spacingMinutes ?? 10));
  const [ringtone, setRingtone] = useState<Ringtone>(initial?.ringtone ?? 'default');
  const [hueEnabled, setHueEnabled] = useState(initial?.hueEnabled ?? defaultLight.hueEnabled);
  const [lightProgram, setLightProgram] = useState<LightProgram>(initial?.lightProgram ?? defaultLight.lightProgram);
  const [fadeMinutes, setFadeMinutes] = useState(initial?.fadeMinutes ?? defaultLight.fadeMinutes);
  const [startWarmth, setStartWarmth] = useState(initial?.startWarmth ?? defaultLight.startWarmth);
  const [endWarmth, setEndWarmth] = useState(initial?.endWarmth ?? defaultLight.endWarmth);
  const [coolShiftMinutes, setCoolShiftMinutes] = useState(initial?.coolShiftMinutes ?? defaultLight.coolShiftMinutes);
  const [brightness, setBrightness] = useState(initial?.brightness ?? defaultLight.brightness);
  const [manualField, setManualField] = useState<'hour' | 'minute' | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [ringtoneOpen, setRingtoneOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<Ringtone | null>(null);
  const [huePaired, setHuePaired] = useState(false);
  useEffect(() => {
    hasHueBridge().then(setHuePaired);
  }, []);

  // Without a paired bridge the light options are inert — don't offer them.
  const hueActive = hueEnabled && huePaired;
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hourValues = useMemo(() => Array.from({length: 24}, (_, index) => index + 1), []);
  const minuteValues = useMemo(() => Array.from({length: 60}, (_, index) => index), []);

  // The time wheels scroll their own content; a downward drag starting on them
  // must spin the wheel, never close the sheet. Their on-screen band is
  // measured once the sheet has settled so the close gesture can skip it.
  const wheelsRowRef = useRef<View>(null);
  const wheelBand = useRef<{top: number; bottom: number} | null>(null);
  const measureWheels = useCallback(() => {
    requestAnimationFrame(() =>
      wheelsRowRef.current?.measureInWindow((_x, y, _w, h) => {
        if (h > 0) wheelBand.current = {top: y, bottom: y + h};
      }),
    );
  }, []);

  // Slide up on mount; the controlled animation (not Modal's own) avoids the
  // stray shadow that used to trail the sheet on the way out.
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true, bounciness: 2, speed: 14}),
      Animated.timing(backdrop, {toValue: 1, duration: 180, useNativeDriver: true}),
    ]).start(() => measureWheels());
  }, [translateY, backdrop, measureWheels]);

  const stopPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
    ringtonePreview.stop();
    setPreviewingId(null);
  }, []);

  const closing = useRef(false);
  const close = useCallback(() => {
    closing.current = true;
    stopPreview();
    Animated.parallel([
      Animated.timing(translateY, {toValue: TRAVEL, duration: 220, useNativeDriver: true}),
      Animated.timing(backdrop, {toValue: 0, duration: 220, useNativeDriver: true}),
    ]).start(() => onDismiss());
  }, [onDismiss, translateY, backdrop, stopPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  // --- Swipe-down-to-close -------------------------------------------------
  // gesture-handler coordinates with the ScrollView at the native level; a JS
  // PanResponder loses that race on Android (the ScrollView intercepts first,
  // showing the overscroll stretch instead of dragging the sheet).
  const startPoint = useRef({x: 0, y: 0});
  const dragBase = useRef(0);
  const dragActive = useRef(false);
  // The body scroll is frozen during an active drag so pulling back up moves
  // only the sheet — not the content underneath it at the same time.
  const [bodyScrollLocked, setBodyScrollLocked] = useState(false);
  // The backdrop dims with the drag natively — no per-frame JS updates.
  const backdropOpacity = useMemo(
    () =>
      Animated.multiply(
        backdrop,
        translateY.interpolate({inputRange: [0, 600], outputRange: [1, 0.3], extrapolate: 'clamp'}),
      ),
    [backdrop, translateY],
  );
  // A released (or interrupted) drag that didn't dismiss settles home.
  const settleBack = useCallback(() => {
    Animated.spring(translateY, {toValue: 0, useNativeDriver: true, bounciness: 2, speed: 18}).start();
  }, [translateY]);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .simultaneousWithExternalGesture(scrollGesture)
        .onTouchesDown(event => {
          const touch = event.allTouches[0];
          startPoint.current = {x: touch.absoluteX, y: touch.absoluteY};
        })
        .onTouchesMove((event, state) => {
          // Once active the sheet just tracks the finger — up and down alike —
          // so a drag can be taken back midway. Judge only before activation.
          if (event.state === State.ACTIVE) return;
          const touch = event.allTouches[0];
          const dx = touch.absoluteX - startPoint.current.x;
          const dy = touch.absoluteY - startPoint.current.y;
          const band = wheelBand.current;
          const onWheel = band != null && startPoint.current.y >= band.top && startPoint.current.y <= band.bottom;
          const scrolledDown = scrollOffset.current > 0;
          const horizontal = Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
          if (onWheel || scrolledDown || dy < -8 || horizontal) {
            state.fail(); // wheel spin, body scroll, or a slider drag — not ours
            return;
          }
          if (dy > 12 && dy > Math.abs(dx) * 1.6) state.activate();
        })
        .onStart(event => {
          dragBase.current = event.translationY;
          dragActive.current = true;
          setBodyScrollLocked(true);
        })
        .onUpdate(event => {
          translateY.setValue(Math.max(0, event.translationY - dragBase.current));
        })
        .onEnd(event => {
          const dragged = event.translationY - dragBase.current;
          const flungDown = event.velocityY > 900;
          const pulledBackUp = event.velocityY < -300;
          if (!pulledBackUp && (dragged > 140 || flungDown)) close();
        })
        .onFinalize(() => {
          // Runs after every touch sequence; only a real drag needs settling.
          if (!dragActive.current) return;
          dragActive.current = false;
          setBodyScrollLocked(false);
          if (!closing.current) settleBack();
        }),
    [close, scrollGesture, settleBack, translateY],
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  };

  const commitManual = () => {
    const parsed = manualValue.trim() === '' ? undefined : Number(manualValue);
    if (manualField === 'hour') setHour(Math.min(24, Math.max(1, parsed ?? hour)));
    if (manualField === 'minute') setMinute(Math.min(59, Math.max(0, parsed ?? minute)));
    setManualField(null);
  };
  const editManual = (field: 'hour' | 'minute') => {
    setManualField(field);
    setManualValue(String(field === 'hour' ? hour : minute));
  };
  const toggleDay = (day: number) =>
    setDays(value => (value.includes(day) ? value.filter(item => item !== day) : [...value, day].sort()));
  const allOn = days.length === 7;
  const toggleAllDays = () => setDays(allOn ? [] : [...ALL_DAYS]);

  const onPreview = (id: Ringtone) => {
    if (previewingId === id) {
      stopPreview();
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    ringtonePreview.play(id);
    setPreviewingId(id);
    previewTimer.current = setTimeout(() => setPreviewingId(null), 6000); // matches native auto-stop
  };

  const submit = () =>
    onSave({
      kind: alarmKind,
      hour: hour === 24 ? 0 : hour,
      minute,
      days,
      count: alarmKind === 'sequence' ? Math.min(12, Math.max(2, Number(count) || 5)) : 1,
      spacingMinutes: alarmKind === 'sequence' ? Math.max(1, Number(spacingMinutes) || 10) : 0,
      ringtone,
      hueEnabled: hueActive,
      lightProgram,
      fadeMinutes,
      startWarmth,
      endWarmth,
      coolShiftMinutes,
      brightness,
    });

  return (
    <NativeModal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close new alarm" />
        </Animated.View>
        <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheet, {transform: [{translateY}]}]}>
          <View>
            <View style={styles.dragArea}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
              <Text style={styles.title}>{initial ? 'Edit alarm' : alarmKind === 'sequence' ? 'Wake-up group' : 'New alarm'}</Text>
              <Tappable frame={styles.closeBtn} style={styles.closeBtnInner} onPress={close} accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={24} color={c.ink} />
              </Tappable>
            </View>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
            <GestureDetector gesture={scrollGesture}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              overScrollMode="never"
              bounces={false}
              scrollEnabled={!bodyScrollLocked}
              contentContainerStyle={[styles.scroll, {paddingBottom: 16 + insets.bottom}]}
              scrollEventThrottle={16}
              onScroll={onScroll}>
              <SegmentedButtons
                value={alarmKind}
                onValueChange={value => setAlarmKind(value as AlarmKind)}
                buttons={[
                  {value: 'alarm', label: 'Single alarm'},
                  {value: 'sequence', label: 'Wake-up group'},
                ]}
                style={styles.segmented}
              />
              <View ref={wheelsRowRef} onLayout={measureWheels} style={styles.wheels}>
                <WheelColumn
                  label="HOUR"
                  values={hourValues}
                  selected={hour}
                  onChange={setHour}
                  manualActive={manualField === 'hour'}
                  manualValue={manualField === 'hour' ? manualValue : ''}
                  onManual={() => editManual('hour')}
                  onManualChange={value => setManualValue(value.replace(/\D/g, '').slice(0, 2))}
                  onManualCommit={commitManual}
                />
                <Text style={styles.colon}>:</Text>
                <WheelColumn
                  label="MINUTE"
                  values={minuteValues}
                  selected={minute}
                  onChange={setMinute}
                  manualActive={manualField === 'minute'}
                  manualValue={manualField === 'minute' ? manualValue : ''}
                  onManual={() => editManual('minute')}
                  onManualChange={value => setManualValue(value.replace(/\D/g, '').slice(0, 2))}
                  onManualCommit={commitManual}
                />
              </View>
              <Divider style={styles.divider} />
              <View style={styles.repeatRow}>
                <Text style={styles.fieldLabelInline}>REPEAT ON</Text>
                <Pressable onPress={toggleAllDays} style={styles.allBtn} accessibilityLabel={allOn ? 'Clear all days' : 'Select every day'}>
                  <MaterialCommunityIcons name={allOn ? 'checkbox-multiple-marked-outline' : 'checkbox-multiple-blank-outline'} size={15} color={c.accent} />
                  <Text style={styles.allBtnText}>{allOn ? 'Clear' : 'Every day'}</Text>
                </Pressable>
              </View>
              <View style={styles.daysRow}>
                {dayLabels.map((label, index) => {
                  const active = days.includes(index + 1);
                  return (
                    <Tappable
                      key={`${label}-${index}`}
                      onPress={() => toggleDay(index + 1)}
                      frame={[styles.day, active && styles.dayActive]}
                      style={styles.dayInner}>
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>{label}</Text>
                    </Tappable>
                  );
                })}
              </View>
              {alarmKind === 'sequence' ? (
                <View style={styles.groupFields}>
                  <TextInput mode="outlined" label="Alarms" value={count} onChangeText={value => setCount(value.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={styles.groupInput} />
                  <TextInput mode="outlined" label="Minutes apart" value={spacingMinutes} onChangeText={value => setSpacingMinutes(value.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" style={styles.groupInput} />
                  <Text style={styles.groupHint}>One clean card represents every alarm in this sequence.</Text>
                </View>
              ) : null}
              <Text style={[styles.fieldLabel, styles.ringtoneLabel]}>RINGTONE</Text>
              <Tappable frame={styles.ringtoneHeader} style={styles.ringtoneHeaderInner} onPress={() => setRingtoneOpen(value => !value)}>
                <View style={styles.ringtoneHeaderCopy}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color={c.accent} />
                  <Text style={styles.ringtoneHeaderText}>{ringtoneLabel(ringtone)}</Text>
                </View>
                <MaterialCommunityIcons name={ringtoneOpen ? 'chevron-up' : 'chevron-down'} size={22} color={c.muted} />
              </Tappable>
              {ringtoneOpen ? (
                <View style={styles.ringtoneMenu}>
                  {ringtoneOptions.map(option => {
                    const active = ringtone === option.id;
                    const playing = previewingId === option.id;
                    return (
                      <View key={option.id} style={[styles.ringtoneRow, active && styles.ringtoneActive]}>
                        <Pressable style={styles.ringtoneChoice} onPress={() => setRingtone(option.id)} android_ripple={{color: c.ripple}}>
                          <MaterialCommunityIcons name={option.icon} size={20} color={active ? c.accent : c.muted} />
                          <Text style={[styles.ringtoneText, active && styles.ringtoneTextActive]}>{option.label}</Text>
                        </Pressable>
                        <Button mode="text" compact textColor={playing ? c.coral : c.accent} onPress={() => onPreview(option.id)}>
                          {playing ? 'Stop' : 'Preview'}
                        </Button>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.hueHeader}>
                <View style={styles.hueHeaderCopy}>
                  <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={hueActive ? c.accent : c.muted} />
                  <View>
                    <Text style={styles.hueTitle}>Wake with light</Text>
                    <Text style={styles.hueSub}>
                      {huePaired ? 'Philips Hue — bridge connected' : 'No bridge paired — connect in Settings › Philips Hue'}
                    </Text>
                  </View>
                </View>
                <Switch value={hueActive} onValueChange={setHueEnabled} color={c.accent} disabled={!huePaired} />
              </View>
              {hueActive ? (
                <View style={styles.lightBody}>
                  <View style={styles.programRow}>
                    {lightProgramOptions.map(option => {
                      const active = lightProgram === option.id;
                      return (
                        <Tappable
                          key={option.id}
                          onPress={() => setLightProgram(option.id)}
                          frame={[styles.program, active && styles.programActive]}
                          style={styles.programInner}>
                          <MaterialCommunityIcons name={option.icon} size={20} color={active ? c.accent : c.muted} />
                          <Text style={[styles.programLabel, active && styles.programLabelActive]}>{option.label}</Text>
                        </Tappable>
                      );
                    })}
                  </View>

                  {lightProgram === 'sunrise' ? (
                    <View style={styles.sliders}>
                      <Slider label="FADE LENGTH" value={fadeMinutes} min={5} max={60} step={5} onChange={setFadeMinutes} format={v => `${v} min`} />
                      <Text style={styles.sliderNote}>Lights start {fadeMinutes} min before the alarm and reach full brightness as it rings.</Text>
                      <Slider label="START WARMTH" value={startWarmth} min={0} max={100} step={2} onChange={setStartWarmth} format={warmthLabel} trackColors={['#BFD4FF', '#FF9E4A']} />
                      <Slider label="BRIGHTNESS" value={brightness} min={10} max={100} step={5} onChange={setBrightness} format={v => `${v}%`} />
                      <Slider label="COOL SHIFT AT WAKE" value={coolShiftMinutes} min={0} max={15} step={1} onChange={setCoolShiftMinutes} format={v => (v === 0 ? 'Off' : `${v} min`)} />
                      {coolShiftMinutes > 0 ? (
                        <Slider label="COOL TARGET" value={endWarmth} min={0} max={100} step={2} onChange={setEndWarmth} format={warmthLabel} trackColors={['#BFD4FF', '#FF9E4A']} />
                      ) : null}
                    </View>
                  ) : null}

                  {lightProgram === 'instant' ? (
                    <View style={styles.sliders}>
                      <Slider label="BRIGHTNESS" value={brightness} min={10} max={100} step={5} onChange={setBrightness} format={v => `${v}%`} />
                      <Slider label="WARMTH" value={startWarmth} min={0} max={100} step={2} onChange={setStartWarmth} format={warmthLabel} trackColors={['#BFD4FF', '#FF9E4A']} />
                      <Text style={styles.sliderNote}>Lights snap on at the alarm time.</Text>
                    </View>
                  ) : null}

                  {lightProgram === 'party' ? (
                    <View style={styles.sliders}>
                      <Slider label="BRIGHTNESS" value={brightness} min={30} max={100} step={5} onChange={setBrightness} format={v => `${v}%`} />
                      <Text style={styles.sliderNote}>Lights strobe random colours while the alarm rings, then return to how they were. Keeps the app running during the alarm.</Text>
                    </View>
                  ) : null}

                </View>
              ) : null}

              <View style={styles.spacer} />
              <Button mode="contained" onPress={submit} style={styles.createBtn} contentStyle={styles.createBtnContent}>
                {initial ? 'Save changes' : alarmKind === 'sequence' ? 'Create group' : 'Add alarm'}
              </Button>
            </ScrollView>
            </GestureDetector>
          </KeyboardAvoidingView>
        </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </NativeModal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {flex: 1, justifyContent: 'flex-end'},
    backdrop: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay},
    // Fixed height: expanding sections (light options, ringtone list) scroll
    // inside instead of resizing the whole modal on every toggle.
    sheet: {height: '92%', backgroundColor: c.canvas, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22},
    // flexShrink lets the scroll area shrink to the sheet's height instead
    // of overflowing the screen (which cut off the save button on tall forms).
    body: {flexShrink: 1},
    // flexGrow + the spacer pin the save button to the sheet's bottom edge
    // whenever the content is shorter than the sheet.
    scroll: {flexGrow: 1},
    spacer: {flex: 1},
    dragArea: {height: 40, alignItems: 'center', justifyContent: 'center'},
    handle: {width: 42, height: 5, borderRadius: 3, backgroundColor: c.line},
    header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14},
    title: {fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: c.ink},
    closeBtn: {width: 44, height: 44, borderRadius: 15, backgroundColor: c.surface},
    closeBtnInner: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    segmented: {marginBottom: 16},
    fieldLabel: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: c.muted, marginBottom: 10},
    fieldLabelInline: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: c.muted},
    wheels: {flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 10, marginTop: 2},
    colon: {fontSize: 30, fontWeight: '300', color: c.disabled, height: WHEEL_HEIGHT, lineHeight: WHEEL_HEIGHT, textAlign: 'center', marginHorizontal: 2},
    divider: {marginVertical: 16, backgroundColor: c.line},
    repeatRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
    allBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.accentSoft},
    allBtnText: {fontSize: 12, fontWeight: '700', color: c.accent},
    daysRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16},
    day: {width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface},
    dayInner: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    dayActive: {backgroundColor: c.accent, borderColor: c.accent},
    dayText: {fontSize: 13, fontWeight: '700', color: c.muted},
    dayTextActive: {color: c.onAccent},
    groupFields: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
    groupInput: {flex: 1, minWidth: 130, backgroundColor: c.surface},
    groupHint: {width: '100%', fontSize: 13, color: c.muted},
    ringtoneLabel: {marginTop: 2},
    ringtoneHeader: {borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, marginBottom: 10},
    ringtoneHeaderInner: {minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16},
    ringtoneHeaderCopy: {flexDirection: 'row', alignItems: 'center', gap: 10},
    ringtoneHeaderText: {fontSize: 15, color: c.ink, fontWeight: '600'},
    ringtoneMenu: {gap: 7, marginBottom: 20},
    // overflow clips the choice Pressable's ripple to the row's rounded corners.
    ringtoneRow: {minHeight: 52, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 6},
    ringtoneChoice: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9},
    ringtoneActive: {borderColor: c.accent, backgroundColor: c.accentSoft},
    ringtoneText: {fontSize: 14, color: c.muted},
    ringtoneTextActive: {color: c.accent, fontWeight: '700'},
    hueHeader: {minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10},
    hueHeaderCopy: {flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 10},
    hueTitle: {fontSize: 15, fontWeight: '600', color: c.ink},
    hueSub: {fontSize: 12, color: c.muted, marginTop: 2},
    lightBody: {marginBottom: 20},
    programRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
    program: {flex: 1, height: 62, borderRadius: 15, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface},
    programInner: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4},
    programActive: {borderColor: c.accent, backgroundColor: c.accentSoft},
    programLabel: {fontSize: 12, fontWeight: '600', color: c.muted},
    programLabelActive: {color: c.accent},
    sliders: {gap: 14},
    sliderNote: {fontSize: 12, lineHeight: 17, color: c.muted, marginTop: -6},
    createBtn: {borderRadius: 16, marginTop: 4},
    createBtnContent: {height: 54},
  });
