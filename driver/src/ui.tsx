// Shared UI kit built on the design tokens in ./theme.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ComponentProps, ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from './api';
import type { DutyStatus } from './api';
import { inr } from './format';
import { BUTTON_HEIGHT, BUTTON_HEIGHT_SM, colors, fonts, gradient, radius, shadow, space, Tone, tones, type, TypeVariant } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export { Ionicons, MaterialCommunityIcons };

// ---------------------------------------------------------------- helpers

export const haptic = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

export const showError = (e: unknown, title = 'Error') => {
  haptic.error();
  Alert.alert(title, errorMessage(e));
};

/** Asks before doing something that can't be undone. */
export const confirm = (title: string, message: string, ok: string, onOk: () => void, destructive = false) =>
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: ok, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);

export const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(showError);

export const navigateTo = (address: string) =>
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`).catch(showError);

/** Google Maps directions to a pickup point: exact coordinates when the office saved them, else its name and city. */
export const navigateToStop = (s: { name: string; city: string; address?: string; lat: number | null; lng: number | null }) =>
  s.lat != null && s.lng != null
    ? Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`).catch(showError)
    : navigateTo([s.name, s.address, s.city].filter(Boolean).join(', '));

/** Opens a WhatsApp chat with an Indian mobile number (falls back to wa.me if the app check fails). */
export const whatsApp = (phone: string, text = '') => {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.length === 10 ? `91${digits}` : digits;
  const q = text ? `&text=${encodeURIComponent(text)}` : '';
  Linking.openURL(`whatsapp://send?phone=${intl}${q}`).catch(() =>
    Linking.openURL(`https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`).catch(showError),
  );
};

export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export const initials = (name: string | null | undefined) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

// ---------------------------------------------------------------- text

type TProps = TextProps & { v?: TypeVariant; color?: string; center?: boolean; style?: StyleProp<TextStyle> };
/** Text in the app typeface. `v` picks a type style from the theme. */
export function T({ v = 'body', color = colors.text, center, style, ...rest }: TProps) {
  return <Text {...rest} style={[type[v], { color }, center && { textAlign: 'center' }, style]} />;
}

// ---------------------------------------------------------------- layout

/** Full-height screen with the app background. Put a Header, a ScrollView and an optional BottomBar inside. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
}

/** Brand-gradient header that sits under the (light) status bar. */
export function Header({
  title,
  subtitle,
  back,
  onBack,
  right,
  children,
  overlap = 0,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  /** Custom back action (default: go back in the stack). */
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  /** Extra bottom padding so a card below can overlap the gradient (pair with a negative marginTop). */
  overlap?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradient.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: insets.top + space.md, paddingBottom: space.xl + overlap, paddingHorizontal: space.lg }}
    >
      {back || title || right ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {back ? (
            <Pressable
              onPress={onBack ?? goBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [hs.back, pressed && { backgroundColor: 'rgba(255,255,255,0.28)' }]}
            >
              <Ionicons name="arrow-back" size={24} color={colors.onBrand} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            {title ? (
              <T v="title" color={colors.onBrand} numberOfLines={1}>
                {title}
              </T>
            ) : null}
            {subtitle ? (
              <T v="label" color={colors.onBrandMuted} numberOfLines={1} style={{ marginTop: 2 }}>
                {subtitle}
              </T>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}
const hs = StyleSheet.create({
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});

export const Card = ({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) => (
  <View style={[ui.card, padded && { padding: space.lg }, style]}>{children}</View>
);

/** Uppercase section title with an optional count / right slot. */
export function SectionTitle({ title, right, style }: { title: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.md }, style]}>
      <T v="overline" color={colors.textMuted}>
        {title}
      </T>
      {right}
    </View>
  );
}

/** Sticky bottom action area (one main action per screen). */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[ui.bottomBar, { paddingBottom: Math.max(insets.bottom, space.md) + space.xs }]}>{children}</View>;
}

export const Divider = ({ style }: { style?: StyleProp<ViewStyle> }) => <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;

// ---------------------------------------------------------------- buttons

type Variant = 'primary' | 'success' | 'danger' | 'outline' | 'outlineDanger' | 'ghost' | 'light';
const VARIANT: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.brand, fg: colors.white },
  success: { bg: colors.success, fg: colors.white },
  danger: { bg: colors.danger, fg: colors.white },
  outline: { bg: colors.card, fg: colors.brand, border: colors.brand },
  outlineDanger: { bg: colors.card, fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.brand },
  light: { bg: colors.white, fg: colors.brand },
};

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  small,
  icon,
  mci,
  style,
  haptics = true,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  small?: boolean;
  icon?: IconName;
  /** MaterialCommunityIcons glyph instead of an Ionicon. */
  mci?: MciName;
  style?: StyleProp<ViewStyle>;
  haptics?: boolean;
}) {
  const off = disabled || loading;
  const { bg, fg, border } = VARIANT[variant];
  const size = small ? 20 : 24;
  return (
    <Pressable
      onPress={() => {
        if (haptics) haptic.tap();
        onPress();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        ui.btn,
        { height: small ? BUTTON_HEIGHT_SM : BUTTON_HEIGHT, paddingHorizontal: small ? space.md : space.xl, backgroundColor: bg },
        border && { borderWidth: 2, borderColor: border },
        { opacity: disabled && !loading ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        pressed && !border && variant !== 'ghost' && { opacity: 0.88 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {icon ? <Ionicons name={icon} size={size} color={fg} /> : mci ? <MaterialCommunityIcons name={mci} size={size} color={fg} /> : null}
          <T v={small ? 'label' : 'h2'} color={fg} numberOfLines={1} style={small ? { fontFamily: fonts.bold, fontSize: 15 } : { fontSize: 17 }}>
            {title}
          </T>
        </View>
      )}
    </Pressable>
  );
}

/** Round icon-only button (call, close, navigate). */
export function IconButton({
  icon,
  onPress,
  tone = 'brand',
  size = 48,
  solid,
  label,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  tone?: Tone;
  size?: number;
  solid?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = tones[tone];
  const solidBg = tone === 'neutral' ? colors.textMuted : tone === 'accent' ? colors.accent : colors[tone];
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: solid ? solidBg : t.bg },
        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={solid ? colors.white : t.fg} />
    </Pressable>
  );
}

export function TextLink({ title, onPress, color = colors.brand, icon }: { title: string; onPress: () => void; color?: string; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, pressed && { opacity: 0.6 }]}>
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <T v="bodyStrong" color={color}>
        {title}
      </T>
    </Pressable>
  );
}

// ---------------------------------------------------------------- badges

export function Badge({ label, tone = 'neutral', icon, large, style }: { label: string; tone?: Tone; icon?: IconName; large?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = tones[tone];
  return (
    <View style={[ui.badge, { backgroundColor: t.bg }, large && { paddingHorizontal: space.md, paddingVertical: 6 }, style]}>
      {icon ? <Ionicons name={icon} size={large ? 16 : 14} color={t.fg} /> : null}
      <T v="caption" color={t.fg} numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: large ? 14 : 12.5 }}>
        {label}
      </T>
    </View>
  );
}

const STATUS: Record<DutyStatus, { label: string; tone: Tone; icon: IconName }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'brand', icon: 'time-outline' },
  STARTED: { label: 'On trip', tone: 'success', icon: 'navigate' },
  COMPLETED: { label: 'Completed', tone: 'neutral', icon: 'checkmark-circle' },
};
export const StatusPill = ({ status, large }: { status: DutyStatus; large?: boolean }) => (
  <Badge label={STATUS[status].label} tone={STATUS[status].tone} icon={STATUS[status].icon} large={large} />
);

/** Number plate styled like an Indian registration plate. */
export function Plate({ reg, small }: { reg: string; small?: boolean }) {
  return (
    <View style={[ui.plate, small && { paddingHorizontal: 6, paddingVertical: 1 }]}>
      <T numberOfLines={1} style={{ fontFamily: fonts.mono, fontWeight: '700', fontSize: small ? 12.5 : 15, letterSpacing: 0.5, color: colors.black }}>
        {reg.toUpperCase()}
      </T>
    </View>
  );
}

/** Formatted rupee amount (Indian grouping). */
export function Money({ amount, size = 22, color = colors.text, style }: { amount: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[{ fontFamily: fonts.extrabold, fontSize: size, lineHeight: Math.round(size * 1.25), color, fontVariant: ['tabular-nums'] }, style]}>
      {inr(amount)}
    </T>
  );
}

export function Avatar({ name, uri, size = 56, light }: { name: string | null | undefined; uri?: string | null; size?: number; light?: boolean }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) return <Image source={{ uri }} style={[box, { backgroundColor: colors.border }]} onError={() => setFailed(true)} />;
  return (
    <View style={[box, { alignItems: 'center', justifyContent: 'center', backgroundColor: light ? 'rgba(255,255,255,0.2)' : colors.brandLight }, light && { borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }]}>
      <T style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: light ? colors.white : colors.brand }}>{initials(name)}</T>
    </View>
  );
}

/** Pulsing "live" dot. */
export function PulseDot({ color = colors.success, size = 10 }: { color?: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 2,
          height: size * 2,
          borderRadius: size,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// ---------------------------------------------------------------- rows & states

export function ListRow({
  icon,
  iconTone = 'brand',
  title,
  subtitle,
  right,
  onPress,
  chevron,
}: {
  icon?: IconName;
  iconTone?: Tone;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm }}>
      {icon ? (
        <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tones[iconTone].bg }}>
          <Ionicons name={icon} size={22} color={tones[iconTone].fg} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T v="label" color={colors.textMuted} numberOfLines={2} style={{ fontFamily: fonts.medium, marginTop: 2 }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => pressed && { opacity: 0.65 }}
    >
      {body}
    </Pressable>
  );
}

export function EmptyState({ icon = 'car-outline', title, subtitle, action }: { icon?: IconName; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl * 1.5, paddingHorizontal: space.xxl }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}>
        <Ionicons name={icon} size={42} color={colors.brand} />
      </View>
      <T v="h2" center>
        {title}
      </T>
      {subtitle ? (
        <T v="body" color={colors.textMuted} center style={{ marginTop: space.sm }}>
          {subtitle}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: space.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({ width = '100%', height = 16, r = 6, style }: { width?: ViewStyle['width']; height?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.skeleton, opacity: v }, style]} />;
}

export const Loading = ({ color = colors.brand }: { color?: string }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={color} />
  </View>
);

/** Inline notice (error, hint, warning). */
export function Notice({ text, tone = 'warning', icon, style }: { text: string; tone?: Tone; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const t = tones[tone];
  return (
    <View style={[{ flexDirection: 'row', gap: space.sm, backgroundColor: t.bg, borderRadius: radius.input + 2, padding: space.md, alignItems: 'flex-start' }, style]}>
      <Ionicons name={icon ?? (tone === 'danger' ? 'alert-circle' : tone === 'success' ? 'checkmark-circle' : 'information-circle')} size={20} color={t.fg} style={{ marginTop: 1 }} />
      <T v="label" color={t.fg} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- inputs

export function Field({ label, icon, prefix, right, ...props }: TextInputProps & { label: string; icon?: IconName; prefix?: string; right?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space.lg }}>
      <T v="label" color={colors.textMuted} style={{ marginBottom: space.sm }}>
        {label}
      </T>
      <View style={[ui.inputWrap, focused && { borderColor: colors.brand, backgroundColor: colors.white }, props.editable === false && { backgroundColor: colors.background }]}>
        {icon ? <Ionicons name={icon} size={22} color={focused ? colors.brand : colors.textMuted} /> : null}
        {prefix ? (
          <T v="title" color={colors.textMuted} style={{ fontSize: 20 }}>
            {prefix}
          </T>
        ) : null}
        <TextInput
          placeholderTextColor="#94A3B8"
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[ui.input, props.style]}
        />
        {right}
      </View>
    </View>
  );
}

/** Large one-box-per-digit code input backed by a single hidden TextInput (keeps paste / SMS autofill working). */
export function OtpInput({
  value,
  onChange,
  length = 4,
  autoFocus,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  onComplete?: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const boxSize = length > 4 ? 40 : 64;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: length > 4 ? 6 : space.md, marginVertical: space.sm }}>
      {Array.from({ length }, (_, i) => {
        const ch = value[i];
        const active = focused && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <View
            key={i}
            style={[
              ui.otpBox,
              { width: boxSize, height: boxSize + 12 },
              ch ? { borderColor: colors.text, backgroundColor: colors.white } : null,
              active && { borderColor: colors.brand, backgroundColor: colors.brandLight },
            ]}
          >
            <T style={{ fontFamily: fonts.extrabold, fontSize: length > 4 ? 24 : 30, color: colors.text }}>{ch ?? ''}</T>
          </View>
        );
      })}
      <TextInput
        value={value}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, length);
          onChange(v);
          if (v.length === length) onComplete?.(v);
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`${length}-digit code`}
        style={[StyleSheet.absoluteFill, { opacity: 0.02, color: 'transparent' }]}
      />
    </View>
  );
}

// ---------------------------------------------------------------- sheet

/** Bottom-sheet style modal with a grabber, title and free content (OTP / odometer forms). */
export function Sheet({
  visible,
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: IconName;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Close" />
        <View style={[ui.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.lg }]}>
          <View style={ui.grabber} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg }}>
            {icon ? (
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={24} color={colors.brand} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <T v="title" numberOfLines={1}>
                {title}
              </T>
              {subtitle ? (
                <T v="label" color={colors.textMuted} numberOfLines={2} style={{ fontFamily: fonts.medium, marginTop: 2 }}>
                  {subtitle}
                </T>
              ) : null}
            </View>
            <IconButton icon="close" tone="neutral" size={40} label="Close" onPress={onClose} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------- styles

export const ui = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  btn: { borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  plate: { borderWidth: 1.5, borderColor: colors.black, backgroundColor: colors.white, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    backgroundColor: '#F8FAFC',
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 20, color: colors.text, paddingVertical: space.md },
  otpBox: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.input + 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  bottomBar: {
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.sm,
    ...shadow.bar,
  },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: space.xl, paddingTop: space.sm },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: space.lg },
});
