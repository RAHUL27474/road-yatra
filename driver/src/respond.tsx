// Accept / reject a newly assigned duty. Rejecting needs a reason and hands the duty back to the office.
import { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Duty, post } from './api';
import { useDuties } from './duties';
import { colors, fonts, radius, space } from './theme';
import { Button, Field, haptic, Notice, Sheet, showError, T } from './ui';

const REASONS = ['Vehicle not ready', 'Not feeling well', 'Personal emergency', 'Already on another duty'];

export const needsAnswer = (d: Duty) => d.status === 'SCHEDULED' && !d.response;

/** Banner with Accept / Can't take it. Renders nothing once the driver has answered or the duty has started. */
export function RespondBar({ duty, compact, style }: { duty: Duty; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const { refresh } = useDuties();
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  if (!needsAnswer(duty)) return null;

  const base = `/api/driver/${duty.kind === 'TRIP' ? 'trips' : 'rentals'}/${duty.id}`;
  const send = async (which: 'accept' | 'reject') => {
    setBusy(which);
    try {
      await post(`${base}/${which}`, which === 'reject' ? { reason: reason.trim() } : undefined);
      haptic.success();
      setRejecting(false);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  return (
    <View style={[st.wrap, compact && { marginTop: 0 }, style]}>
      {!compact && <Notice tone="warning" icon="notifications" text="New duty from the office. Please accept it, or tell them you can't take it." />}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: compact ? 0 : space.sm }}>
        <Button small variant="success" icon="checkmark-circle" title="Accept" loading={busy === 'accept'} onPress={() => send('accept')} style={{ flex: 1 }} />
        <Button
          small
          variant="outlineDanger"
          icon="close-circle-outline"
          title="Can't take"
          onPress={() => {
            setReason('');
            setRejecting(true);
          }}
          style={{ flex: 1 }}
        />
      </View>

      <Sheet visible={rejecting} icon="close-circle" title="Can't take this duty?" subtitle="The office will be told at once and will give it to another driver." onClose={() => setRejecting(false)}>
        <View style={st.chips}>
          {REASONS.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} style={[st.chip, reason === r && st.chipOn]} accessibilityRole="button">
              <T v="label" color={reason === r ? colors.white : colors.text} style={{ fontFamily: fonts.semibold }}>
                {r}
              </T>
            </Pressable>
          ))}
        </View>
        <Field label="Reason" icon="chatbox-ellipses-outline" value={reason} onChangeText={setReason} placeholder="Or type the reason" maxLength={200} />
        <Button title="Send to office" icon="send" variant="danger" loading={busy === 'reject'} disabled={reason.trim().length < 3} onPress={() => send('reject')} />
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginTop: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.danger, borderColor: colors.danger },
});
