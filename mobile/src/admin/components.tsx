// Building blocks for the office (admin) screens, on top of the shared UI kit in ../ui.
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleProp, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { openAndroidPicker } from '../DateTimeField';
import { fmtDateShort, RENTAL_TYPE } from '../format';
import { seatRows } from '../seats';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../theme';
import { Button, EmptyState, hapticSelect, Header, HeaderButton, IonName, Input, Loading, MciName, Screen, Tone, TONES } from '../ui';
import { ActionResult, adminAction, isoToYmd } from './api';

// ---------------------------------------------------------------- guard & layout

/** Office screen: brand header + admin-only guard. Non-admins see a friendly "no access" page. */
export function AdminScreen({
  title,
  subtitle,
  right,
  children,
  back = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  back?: boolean;
}) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (user?.role !== 'ADMIN')
    return (
      <Screen bottom>
        <Header title="Office" />
        <EmptyState
          icon="lock-closed-outline"
          title="Office access only"
          text="Log in with an admin account to manage bookings, trips and the fleet."
          action={<Button title={user ? 'Go back' : 'Log in'} onPress={() => (user ? router.back() : router.push('/login'))} />}
        />
      </Screen>
    );
  return (
    <Screen bottom>
      <Header title={title} subtitle={subtitle} right={right} back={back} />
      {children}
    </Screen>
  );
}

/** Icon button for the header's right slot (the label is read by screen readers). */
export function HeaderAction({ icon, label, onPress }: { icon: IonName; label: string; onPress: () => void }) {
  return <HeaderButton icon={icon} onPress={onPress} accessibilityLabel={label} />;
}

/** Group heading above a card ("TODAY'S TRIPS"). */
export function GroupLabel({ children, right, style }: { children: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[st.groupRow, style]}>
      <Text style={st.group}>{children.toUpperCase()}</Text>
      {right}
    </View>
  );
}

/** White card that holds a form section. */
export function Panel({ children, style, flush }: { children: ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  return <View style={[st.panel, flush ? { padding: 0, overflow: 'hidden' } : null, style]}>{children}</View>;
}

// ---------------------------------------------------------------- numbers & status

/** Dashboard KPI tile. */
export function Kpi({
  label,
  value,
  sub,
  icon,
  tone = 'brand',
  style,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: MciName;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  return (
    <View style={[st.kpi, style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.xs,
        }}
      >
        <Text style={[type('xs', 'semibold', colors.textMuted), { flex: 1, minHeight: 32 }]} numberOfLines={2}>
          {label}
        </Text>
        <View style={[st.kpiIcon, { backgroundColor: t.bg }]}>
          <MaterialCommunityIcons name={icon} size={16} color={t.fg} />
        </View>
      </View>
      <Text style={[type('xl', 'extrabold'), tabular, { marginTop: spacing.xs }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Small coloured status pill with free text (trip / payment / message status). */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[st.pill, { backgroundColor: t.bg }]}>
      <Text style={[type('xs', 'bold', t.fg), { lineHeight: 15 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const tripTone = (s: string): Tone => (s === 'STARTED' ? 'brand' : s === 'COMPLETED' ? 'success' : s === 'CANCELLED' ? 'danger' : 'warning');
export const payTone = (s: string): Tone =>
  s === 'PAID' ? 'success' : s === 'PARTIAL' ? 'warning' : s === 'REFUND_PENDING' ? 'danger' : s === 'REFUNDED' ? 'neutral' : 'warning';
export const nice = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/** "Khatima → Delhi" for seats, "One way · Khatima → Delhi" for full cabs. */
export function bookingTitle(b: {
  trip: { fromCity: string; toCity: string } | null;
  rentalType: string | null;
  pickupCity: string | null;
  dropCity: string | null;
}) {
  if (b.trip) return `${b.trip.fromCity} → ${b.trip.toCity}`;
  return `${RENTAL_TYPE[b.rentalType ?? ''] ?? 'Full cab'} · ${b.pickupCity ?? ''}${b.dropCity ? ' → ' + b.dropCity : ''}`;
}

/** "accepted" / "not accepted yet" / "rejected" line for a driver on a duty. */
export function DriverLine({
  driver,
  response,
  note,
  scheduled = true,
}: {
  driver: { name: string } | null;
  response: string | null;
  note?: string | null;
  scheduled?: boolean;
}) {
  if (!driver)
    return (
      <Text style={type('xs', 'bold', colors.danger)} numberOfLines={2}>
        No driver{note ? ` · ${note}` : ''}
      </Text>
    );
  return (
    <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
      {driver.name}
      {response === 'ACCEPTED' ? <Text style={{ color: colors.success }}> · accepted</Text> : null}
      {response === 'REJECTED' ? <Text style={{ color: colors.danger }}> · rejected</Text> : null}
      {!response && scheduled ? <Text style={{ color: colors.warning }}> · not accepted yet</Text> : null}
    </Text>
  );
}

// ---------------------------------------------------------------- contact

export const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});
export const whatsappPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return Linking.openURL(`https://wa.me/${digits.length === 10 ? '91' + digits : digits}`).catch(() => {});
};

/** Round call / WhatsApp buttons for a passenger or driver. */
export function ContactButtons({ phone }: { phone: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Pressable
        onPress={() => callPhone(phone)}
        hitSlop={4}
        accessibilityLabel={`Call ${phone}`}
        style={({ pressed }) => [st.round, { backgroundColor: colors.successLight }, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="call" size={16} color={colors.success} />
      </Pressable>
      <Pressable
        onPress={() => whatsappPhone(phone)}
        hitSlop={4}
        accessibilityLabel={`WhatsApp ${phone}`}
        style={({ pressed }) => [st.round, { backgroundColor: '#E7F8EE' }, pressed && { opacity: 0.7 }]}
      >
        <MaterialCommunityIcons name="whatsapp" size={18} color="#1FAF54" />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- actions

/**
 * Runs an office action with an optional confirm dialog first. Errors are shown in an alert;
 * resolves to the server reply, or null if cancelled / refused.
 */
export function runAction(
  name: string,
  body: Record<string, unknown>,
  opts: {
    confirm?: {
      title: string;
      message?: string;
      ok?: string;
      destructive?: boolean;
    };
  } = {},
): Promise<ActionResult | null> {
  const go = async () => {
    try {
      return await adminAction(name, body);
    } catch (e) {
      Alert.alert('Not done', errorMessage(e));
      return null;
    }
  };
  if (!opts.confirm) return go();
  const c = opts.confirm;
  return new Promise((resolve) =>
    Alert.alert(c.title, c.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      {
        text: c.ok ?? 'Yes',
        style: c.destructive ? 'destructive' : 'default',
        onPress: () => go().then(resolve),
      },
    ]),
  );
}

// ---------------------------------------------------------------- form controls

/** Label + switch row (checkbox fields of the office forms). */
export function ToggleRow({
  label,
  sub,
  value,
  onChange,
  last,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[st.toggle, !last && st.toggleBorder]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type('sm', 'semibold')}>{label}</Text>
        {sub ? <Text style={type('xs', 'regular', colors.textMuted)}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          hapticSelect();
          onChange(v);
        }}
        trackColor={{ true: colors.brand, false: colors.border }}
        thumbColor={colors.white}
      />
    </Pressable>
  );
}

/** Two inputs side by side. */
export const TwoCol = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;

/** Numeric text field that keeps the raw text while typing. */
export function NumField({
  label,
  value,
  onChange,
  decimal,
  prefix,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  prefix?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Input
      label={label}
      value={value}
      prefix={prefix}
      onChangeText={(t) => onChange(t.replace(decimal ? /[^\d.-]/g : /[^\d]/g, ''))}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      containerStyle={[{ flex: 1 }, style]}
    />
  );
}

/**
 * Optional calendar date stored as "YYYY-MM-DD" (or ""). Android opens the native date dialog;
 * other platforms type the date.
 */
export function DateField({
  label,
  value,
  onChange,
  allowClear = true,
}: {
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  allowClear?: boolean;
}) {
  if (Platform.OS !== 'android')
    return (
      <Input
        label={`${label} (YYYY-MM-DD)`}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        containerStyle={{ flex: 1 }}
      />
    );
  const date = value ? new Date(`${value}T12:00:00+05:30`) : new Date();
  return (
    <View style={{ flex: 1, marginBottom: spacing.lg }}>
      <Text style={[type('xs', 'semibold', colors.textMuted), { marginBottom: 6 }]}>{label}</Text>
      <Pressable
        onPress={() =>
          openAndroidPicker({
            value: date,
            mode: 'date',
            onChange: (d) => onChange(isoToYmd(d.toISOString())),
          })
        }
        style={({ pressed }) => [st.dateBox, pressed && { borderColor: colors.brand }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not set'}`}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.brand} />
        <Text style={[type('md', 'semibold', value ? colors.text : colors.textSubtle), { flex: 1 }]} numberOfLines={1}>
          {value ? fmtDateShort(date) : 'Not set'}
        </Text>
        {value && allowClear ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Text prompt in a small modal (Alert.prompt is iOS-only). */
export function PromptModal({
  visible,
  title,
  message,
  label,
  initial = '',
  placeholder,
  keyboardType = 'default',
  multiline,
  okLabel = 'Save',
  destructive,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
  okLabel?: string;
  destructive?: boolean;
  onSubmit: (text: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const [seen, setSeen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Reset the text each time the prompt opens.
  if (visible !== seen) {
    setSeen(visible);
    if (visible) setText(initial);
  }
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.modalBg}>
        <View style={st.modal}>
          <Text style={type('lg', 'bold')}>{title}</Text>
          {message ? <Text style={[type('sm', 'regular', colors.textMuted), { marginTop: 4 }]}>{message}</Text> : null}
          <Input
            label={label}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            keyboardType={keyboardType}
            multiline={multiline}
            autoFocus
            containerStyle={{ marginTop: spacing.md }}
            style={multiline ? { minHeight: 90, textAlignVertical: 'top' } : undefined}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="outline" size="md" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={okLabel}
              variant={destructive ? 'danger' : 'secondary'}
              size="md"
              loading={busy}
              style={{ flex: 1 }}
              onPress={async () => {
                setBusy(true);
                try {
                  await onSubmit(text.trim());
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------- seat map

export type SeatCell = {
  seatNo: number;
  state: 'FREE' | 'BOOKED' | 'BLOCKED';
  female?: boolean;
  blockReason?: string | null;
};

/**
 * Seat map in the vehicle's real layout. Seat 1 sits next to the driver.
 * `selected` seats are highlighted; tapping calls onPress with the seat.
 */
export function SeatMap({
  seats,
  seatsPerRow,
  seatLayout,
  selected = [],
  onPress,
}: {
  seats: SeatCell[];
  seatsPerRow: number;
  seatLayout?: string | null;
  selected?: number[];
  onPress?: (seat: SeatCell) => void;
}) {
  const bySeat = new Map(seats.map((s) => [s.seatNo, s]));
  const rows = seatRows(seats.length, seatsPerRow, seatLayout);
  return (
    <View style={st.bus}>
      <View style={st.busFront}>
        <MaterialCommunityIcons name="steering" size={22} color={colors.textMuted} />
        <Text style={type('xs', 'semibold', colors.textMuted)}>Front</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={st.seatRow}>
          {row.map((n) => {
            const s = bySeat.get(n) ?? { seatNo: n, state: 'FREE' as const };
            const on = selected.includes(n);
            const bg = on ? colors.brand : s.state === 'BOOKED' ? colors.seatTaken : s.state === 'BLOCKED' ? colors.warningLight : colors.card;
            const border = on ? colors.brand : s.state === 'BLOCKED' ? colors.warning : s.state === 'BOOKED' ? colors.seatTaken : colors.border;
            const fg = on ? colors.white : s.state === 'BOOKED' ? colors.textMuted : s.state === 'BLOCKED' ? colors.warning : colors.text;
            return (
              <Pressable
                key={n}
                disabled={!onPress}
                onPress={() => {
                  hapticSelect();
                  onPress?.(s);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Seat ${n}, ${s.state.toLowerCase()}${s.female ? ', woman' : ''}${on ? ', selected' : ''}`}
                style={({ pressed }) => [st.seat, { backgroundColor: bg, borderColor: border }, pressed && { opacity: 0.75 }]}
              >
                <MaterialCommunityIcons name={s.female ? 'human-female' : 'seat-passenger'} size={16} color={s.female && !on ? '#DB2777' : fg} />
                <Text style={[type('xs', 'bold', fg), tabular]}>{n}</Text>
                {s.state === 'BLOCKED' && s.blockReason ? (
                  <Text style={[type('xs', 'medium', colors.warning), { fontSize: 9, lineHeight: 11 }]} numberOfLines={1}>
                    {s.blockReason}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={st.legend}>
        <LegendDot color={colors.card} border={colors.border} label="Free" />
        <LegendDot color={colors.seatTaken} label="Booked" />
        <LegendDot color={colors.warningLight} border={colors.warning} label="Blocked" />
        <LegendDot color={colors.brand} label="Selected" />
      </View>
    </View>
  );
}

function LegendDot({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: border ?? color,
        }}
      />
      <Text style={type('xs', 'medium', colors.textMuted)}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- styles

const st = StyleSheet.create({
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  group: { ...type('xs', 'bold', colors.textMuted), letterSpacing: 0.6 },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadowSoft,
  },
  kpi: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    ...shadowSoft,
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  toggleBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F8FAFC',
  },
  modalBg: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: spacing.xl,
  },
  bus: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  busFront: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  seatRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  seat: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
});
