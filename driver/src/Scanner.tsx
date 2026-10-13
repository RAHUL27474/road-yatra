import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from './theme';
import { Button, haptic, IconName, Ionicons, T } from './ui';

const FRAME = 260;
const CORNER = 36;

function RoundButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [sc.round, active && { backgroundColor: colors.white }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={26} color={active ? colors.text : colors.white} />
    </Pressable>
  );
}

/** Full-screen QR scanner. Calls onScan once with the QR text (e.g. "RY:CODE:1234"). */
export function Scanner({ visible, onClose, onScan }: { visible: boolean; onClose: () => void; onScan: (text: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const done = useRef(false);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      onShow={() => {
        done.current = false;
        setTorch(false);
      }}
    >
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        {!permission ? null : !permission.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
            <View style={sc.permIcon}>
              <Ionicons name="camera-outline" size={44} color={colors.white} />
            </View>
            <T v="title" color={colors.white} center>
              Camera access needed
            </T>
            <T v="body" color="rgba(255,255,255,0.75)" center style={{ marginTop: space.sm, marginBottom: space.xxl }}>
              Allow camera access to scan passenger tickets.
            </T>
            <Button title="Allow camera" icon="camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (done.current || !data) return;
                done.current = true;
                haptic.success();
                onScan(data);
              }}
            />
            {/* Dimmed surround with a clear square window. */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={sc.dim} />
              <View style={{ flexDirection: 'row', height: FRAME }}>
                <View style={sc.dim} />
                <View style={{ width: FRAME, height: FRAME }}>
                  <View style={[sc.corner, { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 20 }]} />
                  <View style={[sc.corner, { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 20 }]} />
                  <View style={[sc.corner, { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 20 }]} />
                  <View style={[sc.corner, { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 20 }]} />
                </View>
                <View style={sc.dim} />
              </View>
              <View style={[sc.dim, { alignItems: 'center', paddingTop: space.xxl, paddingHorizontal: space.xxl }]}>
                <View style={sc.hint}>
                  <Ionicons name="qr-code-outline" size={20} color={colors.white} />
                  <T v="bodyStrong" color={colors.white} style={{ flexShrink: 1 }}>
                    Point at the QR code on the passenger's ticket
                  </T>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={[sc.topBar, { paddingTop: insets.top + space.md }]}>
          <RoundButton icon="close" label="Close scanner" onPress={onClose} />
          <T v="h2" color={colors.white} style={{ fontFamily: fonts.bold }}>
            Scan ticket
          </T>
          {permission?.granted ? (
            <RoundButton icon={torch ? 'flashlight' : 'flashlight-outline'} label={torch ? 'Torch off' : 'Torch on'} active={torch} onPress={() => setTorch((t) => !t)} />
          ) : (
            <View style={{ width: 52 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const sc = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.white },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  round: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(15,23,42,0.75)', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill },
  permIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: space.xl },
});
