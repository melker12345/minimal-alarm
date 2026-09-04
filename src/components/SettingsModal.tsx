import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Button, Divider, Modal, Text} from 'react-native-paper';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {appVersion} from '../native/alarmScheduler';

type Props = {
  exactAllowed: boolean;
  fullScreenAllowed: boolean;
  overlayAllowed: boolean;
  onOpenExact: () => void;
  onOpenFullScreen: () => void;
  onOpenOverlay: () => void;
  onOpenHue: () => void;
  onDismiss: () => void;
};

function Row({title, subtitle, trailing, c}: {title: string; subtitle: string; trailing: React.ReactNode; c: Colors}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.copy}>
        <Text style={[rowStyles.title, {color: c.ink}]}>{title}</Text>
        <Text style={[rowStyles.subtitle, {color: c.muted}]}>{subtitle}</Text>
      </View>
      {trailing}
    </View>
  );
}

export function SettingsModal({exactAllowed, fullScreenAllowed, overlayAllowed, onOpenExact, onOpenFullScreen, onOpenOverlay, onOpenHue, onDismiss}: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const allGranted = exactAllowed && fullScreenAllowed && overlayAllowed;

  return (
    <Modal visible onDismiss={onDismiss} contentContainerStyle={styles.modal}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Settings</Text>
          <Text style={styles.subtitle}>Keep your mornings simple</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onDismiss} android_ripple={{color: c.ripple}} accessibilityLabel="Close settings">
          <MaterialCommunityIcons name="close" size={24} color={c.ink} />
        </Pressable>
      </View>

      <View style={[styles.status, allGranted ? styles.statusOk : styles.statusWarn]}>
        <MaterialCommunityIcons
          name={allGranted ? 'shield-check' : 'shield-alert-outline'}
          size={20}
          color={allGranted ? c.accent : c.coral}
        />
        <Text style={[styles.statusText, {color: allGranted ? c.accent : c.coral}]}>
          {allGranted ? 'Alarms are ready to ring reliably' : 'Grant access below so alarms ring on time'}
        </Text>
      </View>

      <Divider />
      <Row
        c={c}
        title="Require unlock to stop"
        subtitle="The alarm can't be dismissed from the lock screen."
        trailing={
          <View style={[styles.badge, {backgroundColor: c.accentSoft}]}>
            <MaterialCommunityIcons name="check" size={14} color={c.accent} />
            <Text style={[styles.badgeText, {color: c.accent}]}>Always on</Text>
          </View>
        }
      />
      {!overlayAllowed ? (
        <>
          <Divider />
          <Row
            c={c}
            title="Open alarm automatically"
            subtitle="“Display over other apps” lets the ringing screen appear over everything without tapping a notification."
            trailing={
              <Button mode="text" compact onPress={onOpenOverlay}>
                Allow
              </Button>
            }
          />
        </>
      ) : null}
      {!exactAllowed ? (
        <>
          <Divider />
          <Row
            c={c}
            title="Exact alarm access"
            subtitle="Allow this so alarms fire at the selected minute."
            trailing={
              <Button mode="text" compact onPress={onOpenExact}>
                Allow
              </Button>
            }
          />
        </>
      ) : null}
      {!fullScreenAllowed ? (
        <>
          <Divider />
          <Row
            c={c}
            title="Full-screen alarm access"
            subtitle="Let the ringing screen open automatically over everything."
            trailing={
              <Button mode="text" compact onPress={onOpenFullScreen}>
                Allow
              </Button>
            }
          />
        </>
      ) : null}
      <Divider />
      <Pressable onPress={onOpenHue} android_ripple={{color: c.ripple}}>
        <Row
          c={c}
          title="Philips Hue"
          subtitle="Connect your bridge and wake with light."
          trailing={<MaterialCommunityIcons name="chevron-right" size={24} color={c.muted} />}
        />
      </Pressable>
      <Text style={styles.version}>Minimal Alarm {appVersion}</Text>
    </Modal>
  );
}

const rowStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 18},
  copy: {flex: 1, paddingRight: 14},
  title: {fontSize: 16, fontWeight: '600'},
  subtitle: {fontSize: 13, lineHeight: 19, marginTop: 4},
});

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    modal: {backgroundColor: c.canvas, margin: 18, padding: 22, borderRadius: 28},
    header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
    heading: {fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: c.ink},
    subtitle: {fontSize: 14, color: c.muted, marginTop: 4},
    closeBtn: {width: 44, height: 44, borderRadius: 15, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
    badge: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 11},
    badgeText: {fontSize: 12, fontWeight: '700'},
    status: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, marginBottom: 4},
    statusOk: {backgroundColor: c.accentSoft},
    statusWarn: {backgroundColor: c.coralSoft},
    statusText: {fontSize: 13, fontWeight: '600', flex: 1},
    version: {fontSize: 12, color: c.disabled, textAlign: 'center', marginTop: 14},
  });
