import React, {useMemo, useState} from 'react';
import {Linking, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Button, Text} from 'react-native-paper';
import {Colors} from '../design/theme';
import {useColors} from '../design/ThemeProvider';
import {appUpdater, appVersion} from '../native/alarmScheduler';
import {AvailableUpdate} from '../state/useUpdateCheck';

/**
 * Full-screen blocking gate shown when a newer release exists — alarms keep
 * ringing natively regardless, but the UI insists on the update.
 */
export function UpdateGate({update}: {update: AvailableUpdate}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [downloading, setDownloading] = useState(false);

  const install = async () => {
    setDownloading(true);
    try {
      await appUpdater.downloadAndInstall(update.apkUrl);
    } catch {
      // DownloadManager unavailable (rare) — fall back to the browser.
      Linking.openURL(update.apkUrl);
      setDownloading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <MaterialCommunityIcons name="arrow-up-circle-outline" size={34} color={c.onAccent} />
      </View>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.copy}>
        Version {update.version} is out — you're on {appVersion}. Updating keeps alarms reliable across app changes.
      </Text>
      <Button mode="contained" onPress={install} loading={downloading} disabled={downloading} style={styles.btn} contentStyle={styles.btnContent}>
        {downloading ? 'Downloading…' : 'Download & install'}
      </Button>
      {downloading ? <Text style={styles.hint}>The installer opens automatically when the download finishes.</Text> : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36},
    icon: {width: 68, height: 68, borderRadius: 23, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20},
    title: {fontSize: 24, fontWeight: '700', color: c.ink},
    copy: {fontSize: 15, lineHeight: 22, color: c.muted, textAlign: 'center', marginTop: 10},
    btn: {marginTop: 26, borderRadius: 16, alignSelf: 'stretch'},
    btnContent: {height: 52},
    hint: {fontSize: 13, color: c.muted, marginTop: 14, textAlign: 'center'},
  });
