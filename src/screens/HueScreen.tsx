import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Modal as NativeModal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Button, Divider, Switch, Text, TextInput} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {useHue} from '../state/useHue';

export function HueScreen({onClose}: {onClose: () => void}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const hue = useHue();
  const [manualIp, setManualIp] = useState('');

  const pairing = hue.status.kind === 'pairing';
  const discovering = hue.status.kind === 'discovering';
  const error = hue.status.kind === 'error' ? hue.status.message : null;

  return (
    <NativeModal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={onClose} android_ripple={{color: c.ripple}} accessibilityLabel="Back">
            <MaterialCommunityIcons name="chevron-left" size={26} color={c.ink} />
          </Pressable>
          <Text style={styles.title}>Philips Hue</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={30} color={c.onAccent} />
            </View>
            <Text style={styles.heroTitle}>Wake with light</Text>
            <Text style={styles.heroCopy}>Connect your Hue bridge on this Wi-Fi. Turning lights on at alarm time arrives in a later update — for now you can pair, pick lights and test them.</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={c.coral} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {hue.creds ? (
            <>
              <View style={styles.connectedRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={c.accent} />
                <Text style={styles.connectedText}>Connected to bridge at {hue.creds.ip}</Text>
              </View>

              <View style={styles.actions}>
                <Button mode="contained" onPress={hue.testLights} style={styles.flexBtn} icon="flash" disabled={!hue.lights.length}>
                  Test lights
                </Button>
                <Button mode="outlined" onPress={() => hue.refreshLights()} style={styles.flexBtn} icon="refresh">
                  Refresh
                </Button>
              </View>

              <Text style={styles.sectionLabel}>YOUR LIGHTS</Text>
              {hue.lights.length ? (
                <View style={styles.card}>
                  {hue.lights.map((light, index) => (
                    <View key={light.id}>
                      {index > 0 ? <Divider /> : null}
                      <View style={styles.lightRow}>
                        <View style={styles.lightCopy}>
                          <Text style={styles.lightName}>{light.name}</Text>
                          <Text style={styles.lightMeta}>{light.reachable ? (light.on ? 'On' : 'Off') : 'Unreachable'}</Text>
                        </View>
                        <Switch value={light.on} onValueChange={() => hue.toggleLight(light)} color={c.accent} disabled={!light.reachable} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>No lights reported by the bridge yet.</Text>
              )}

              <Button mode="text" textColor={c.coral} onPress={hue.disconnect} style={styles.disconnect}>
                Disconnect bridge
              </Button>
            </>
          ) : (
            <>
              <Button mode="contained" onPress={hue.discover} loading={discovering} disabled={discovering || pairing} style={styles.findBtn} icon="access-point">
                {discovering ? 'Searching…' : 'Find bridge automatically'}
              </Button>

              {hue.bridges.length ? (
                <>
                  <Text style={styles.sectionLabel}>FOUND BRIDGES</Text>
                  <View style={styles.card}>
                    {hue.bridges.map((bridge, index) => (
                      <View key={bridge.id}>
                        {index > 0 ? <Divider /> : null}
                        <Pressable style={styles.bridgeRow} onPress={() => hue.connect(bridge.ip)} android_ripple={{color: c.ripple}} disabled={pairing}>
                          <View style={styles.lightCopy}>
                            <Text style={styles.lightName}>Hue bridge</Text>
                            <Text style={styles.lightMeta}>{bridge.ip}</Text>
                          </View>
                          <MaterialCommunityIcons name="chevron-right" size={22} color={c.muted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionLabel}>OR ENTER BRIDGE IP</Text>
              <View style={styles.manualRow}>
                <TextInput
                  mode="outlined"
                  label="Bridge IP address"
                  value={manualIp}
                  onChangeText={setManualIp}
                  placeholder="192.168.1.x"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  style={styles.manualInput}
                  disabled={pairing}
                />
              </View>
              <Button mode="outlined" onPress={() => hue.connect(manualIp.trim())} disabled={pairing || manualIp.trim().length < 7} style={styles.connectBtn}>
                Connect
              </Button>

              {pairing ? (
                <View style={styles.pairingBox}>
                  <ActivityIndicator color={c.accent} />
                  <Text style={styles.pairingText}>{hue.status.kind === 'pairing' ? hue.status.message : ''}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </NativeModal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.canvas},
    header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10},
    iconBtn: {width: 44, height: 44, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'},
    title: {fontSize: 18, fontWeight: '700', color: c.ink},
    scroll: {paddingHorizontal: 22, paddingBottom: 40},
    hero: {alignItems: 'center', paddingTop: 8, paddingBottom: 22},
    heroIcon: {width: 64, height: 64, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14},
    heroTitle: {fontSize: 22, fontWeight: '700', color: c.ink},
    heroCopy: {fontSize: 14, lineHeight: 21, textAlign: 'center', color: c.muted, marginTop: 8},
    errorBox: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.coralSoft, padding: 12, borderRadius: 14, marginBottom: 16},
    errorText: {flex: 1, fontSize: 13, color: c.coral, fontWeight: '600'},
    connectedRow: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.accentSoft, padding: 14, borderRadius: 16, marginBottom: 18},
    connectedText: {fontSize: 14, fontWeight: '600', color: c.accent, flex: 1},
    actions: {flexDirection: 'row', gap: 10, marginBottom: 24},
    flexBtn: {flex: 1, borderRadius: 14},
    sectionLabel: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: c.muted, marginBottom: 10, marginTop: 4},
    card: {backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, marginBottom: 18},
    lightRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16},
    lightCopy: {flex: 1, paddingRight: 12},
    lightName: {fontSize: 15, fontWeight: '600', color: c.ink},
    lightMeta: {fontSize: 13, color: c.muted, marginTop: 2},
    bridgeRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16},
    muted: {fontSize: 14, color: c.muted, marginBottom: 18},
    disconnect: {marginTop: 6},
    findBtn: {borderRadius: 14, marginBottom: 8},
    manualRow: {marginBottom: 10},
    manualInput: {backgroundColor: c.surface},
    connectBtn: {borderRadius: 14},
    pairingBox: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: c.accentPale},
    pairingText: {flex: 1, fontSize: 14, color: c.ink, fontWeight: '600'},
  });
