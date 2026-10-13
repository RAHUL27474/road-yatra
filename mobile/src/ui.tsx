// Shared UI kit, built on the tokens in ./theme.
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BookingStatus, TripStatus, VehicleType } from './api';
import { inr } from './format';
import { Illustration, IllustrationKind } from './illustrations';
import { colors, fonts, radius, shadow, shadowSoft, spacing, tabular, type } from './theme';

export type IonName = ComponentProps<typeof Ionicons>['name'];
export type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// ---------------------------------------------------------------- haptics

/** Light tap feedback for primary actions. Never throws (some devices have no vibrator). */
export const hapticTap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
/** Selection tick for toggles such as seats and chips. */
export const hapticSelect = () => {
  Haptics.selectionAsync().catch(() => {});
};

// ---------------------------------------------------------------- icons

/** Vehicle type → MaterialCommunityIcons glyph. */
export const VEHICLE_ICON: Record<VehicleType, MciName> = {
  SEDAN: 'car',
  ERTIGA: 'car-estate',
  SUV: 'car-estate',
  INNOVA_CRYSTA: 'van-passenger',
  TEMPO_TRAVELLER: 'van-passenger',
  BUS: 'bus',
  OTHER: 'car',
};
export const vehicleIcon = (t: VehicleType | string | undefined): MciName => VEHICLE_ICON[t as VehicleType] ?? 'car';

/** Amenity name → icon (unknown amenities get a generic check). */
export function amenityIcon(name: string): MciName {
  const n = name.toLowerCase();
  if (n.includes('ac') && !n.includes('back')) return 'snowflake';
  if (n.includes('charg')) return 'battery-charging';
  if (n.includes('music')) return 'music';
  if (n.includes('luggage') || n.includes('bag')) return 'bag-suitcase';
  if (n.includes('wifi') || n.includes('wi-fi')) return 'wifi';
  if (n.includes('water')) return 'water';
  if (n.includes('recl') || n.includes('seat')) return 'seat-recline-extra';
  return 'check-circle-outline';
}

/** Small icon + label list for vehicle amenities. `compact` shows icons only. */
export function Amenities({ items, compact, style }: { items: string[]; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!items.length) return null;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 10 : 6 }, style]}>
      {items.map((a) =>
        compact ? (
          <View key={a} accessibilityLabel={a} style={ui.amenityDot}>
            <MaterialCommunityIcons name={amenityIcon(a)} size={14} color={colors.textMuted} />
          </View>
        ) : (
          <View key={a} style={ui.amenityPill}>
            <MaterialCommunityIcons name={amenityIcon(a)} size={13} color={colors.brand} />
            <Text style={type('xs', 'medium', colors.text)} numberOfLines={1}>
              {a}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

/** An icon inside a soft tinted circle. */
export function IconCircle({
  name,
  mci,
  size = 40,
  color = colors.brand,
  bg = colors.brandLight,
  style,
}: {
  name?: IonName;
  mci?: MciName;
  size?: number;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const glyph = Math.round(size * 0.5);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      {mci ? <MaterialCommunityIcons name={mci} size={glyph} color={color} /> : <Ionicons name={name ?? 'ellipse'} size={glyph} color={color} />}
    </View>
  );
}

// ---------------------------------------------------------------- layout

/** Screen background. Headers handle the top safe area; pass `bottom` for screens without a tab/bottom bar. */
export function Screen({ children, bottom, style }: { children: ReactNode; bottom?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[{ flex: 1, backgroundColor: colors.background }, bottom && { paddingBottom: insets.bottom }, style]}>{children}</View>;
}

const goBack = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/');
};

/** Gradient brand header with a back button and title. `large` gives the tall Home-style header. */
export function Header({
  title,
  subtitle,
  back = true,
  onBack,
  right,
  large,
  children,
  overlap = 0,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
  /** Extra content inside the gradient, under the title. */
  children?: ReactNode;
  /** Extra bottom padding so a card can overlap the header. */
  overlap?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={colors.brandGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: insets.top + (large ? spacing.lg : spacing.sm), paddingBottom: (large ? spacing.xxl : spacing.md) + overlap }}
    >
      <StatusBar style="light" />
      {title || back || right ? (
        <View style={ui.headerRow}>
          {back ? (
            <Pressable onPress={onBack ?? goBack} hitSlop={8} style={ui.headerBtn} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={colors.white} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, paddingLeft: back ? spacing.xs : spacing.lg }}>
            {title ? (
              <Text style={large ? type('xxl', 'extrabold', colors.white) : type('lg', 'bold', colors.white)} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={[type('xs', 'medium', colors.onBrandMuted), { marginTop: 1 }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right ? <View style={{ paddingRight: spacing.sm }}>{right}</View> : <View style={{ width: spacing.sm }} />}
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}

/** White rounded card with a soft shadow. Tappable when `onPress` is given. */
export function Card({
  children,
  style,
  onPress,
  disabled,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  padded?: boolean;
}) {
  const base = [ui.card, padded && { padding: spacing.lg }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: 'rgba(11,94,215,0.06)' }}
      style={({ pressed }) => [base, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
    >
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, right, style }: { children: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }, style]}>
      <Text style={type('md', 'bold')}>{children}</Text>
      {right}
    </View>
  );
}

export const Divider = ({ dashed, style }: { dashed?: boolean; style?: StyleProp<ViewStyle> }) =>
  dashed ? (
    <View style={[{ height: 1, overflow: 'hidden', marginVertical: spacing.md }, style]}>
      <View style={{ height: 2, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 1 }} />
    </View>
  ) : (
    <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border, marginVertical: spacing.md }, style]} />
  );

// ---------------------------------------------------------------- text bits

/** ₹ amount in Indian grouping. */
export function Money({
  amount,
  size = 'md',
  weight = 'bold',
  color = colors.text,
  style,
}: {
  amount: number;
  size?: Parameters<typeof type>[0];
  weight?: Parameters<typeof type>[1];
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[type(size, weight, color), tabular, style]} numberOfLines={1}>
      {inr(amount)}
    </Text>
  );
}

/** Label on the left, value on the right. */
export function Row({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <View style={ui.row}>
      <Text style={[type('sm', bold ? 'bold' : 'regular', bold ? colors.text : colors.textMuted), { flexShrink: 0 }]}>{label}</Text>
      <Text
        style={[type(bold ? 'md' : 'sm', bold ? 'extrabold' : 'medium', valueColor ?? colors.text), tabular, { flex: 1, textAlign: 'right', marginLeft: spacing.md }]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Inline alert. Renders nothing without text. */
export function Notice({
  children,
  tone = 'danger',
  icon,
  style,
}: {
  children?: string | null;
  tone?: 'danger' | 'warning' | 'success' | 'info';
  icon?: IonName;
  style?: StyleProp<ViewStyle>;
}) {
  if (!children) return null;
  const t = TONES[tone === 'info' ? 'brand' : tone];
  const glyph: IonName =
    icon ?? (tone === 'danger' ? 'alert-circle' : tone === 'warning' ? 'warning-outline' : tone === 'success' ? 'checkmark-circle' : 'information-circle-outline');
  return (
    <View style={[ui.notice, { backgroundColor: t.bg }, style]}>
      <Ionicons name={glyph} size={18} color={t.fg} style={{ marginTop: 1 }} />
      <Text style={[type('sm', 'medium', t.fg), { flex: 1 }]}>{children}</Text>
    </View>
  );
}

/** Kept for existing call sites: a red inline error. */
export const ErrorText = ({ children }: { children?: string | null }) => <Notice style={{ marginVertical: spacing.sm }}>{children}</Notice>;

/** Inline red error banner with a Retry action. Renders nothing without a message. */
export function ErrorBanner({ message, onRetry, style }: { message?: string | null; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  if (!message) return null;
  return (
    <View style={[ui.errBanner, style]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={20} color={colors.danger} />
      <Text style={[type('sm', 'medium', colors.danger), { flex: 1 }]} numberOfLines={3}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={() => {
            hapticTap();
            onRetry();
          }}
          hitSlop={8}
          style={({ pressed }) => [ui.errRetry, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={type('xs', 'bold', colors.white)}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Booking progress: Seats -> Details -> Pay. `current` is the 0-based active step. */
export function StepIndicator({ steps, current, style }: { steps: string[]; current: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[ui.steps, style]} accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <View key={label} style={[{ flexDirection: 'row', alignItems: 'center' }, i < steps.length - 1 ? { flex: 1, minWidth: 0 } : { flexShrink: 0 }]}>
            <View
              style={[
                ui.stepDot,
                done && { backgroundColor: colors.success, borderColor: colors.success },
                on && { backgroundColor: colors.brand, borderColor: colors.brand },
              ]}
            >
              {done ? (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              ) : (
                <Text style={[type('xs', 'bold', on ? colors.white : colors.textMuted), { lineHeight: 15 }]}>{i + 1}</Text>
              )}
            </View>
            <Text
              style={[type('xs', on ? 'bold' : 'semibold', on ? colors.text : done ? colors.success : colors.textMuted), { marginLeft: 6, flexShrink: 0 }]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {i < steps.length - 1 ? <View style={[ui.stepLine, done && { backgroundColor: colors.success }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- buttons

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline';

/** 52 px button. primary = accent gradient CTA, secondary = brand blue. Light haptic on press. */
export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
  size = 'lg',
  fullWidth = true,
  haptic = true,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  icon?: IonName;
  size?: 'lg' | 'md';
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  const height = size === 'lg' ? 52 : 44;
  const fg =
    variant === 'primary' || variant === 'secondary' || variant === 'danger'
      ? colors.white
      : variant === 'dangerOutline'
        ? colors.danger
        : colors.brand;
  const bg = variant === 'secondary' ? colors.brand : variant === 'danger' ? colors.danger : 'transparent';
  const border =
    variant === 'outline' ? { borderWidth: 1.5, borderColor: colors.brand } : variant === 'dangerOutline' ? { borderWidth: 1.5, borderColor: colors.danger } : null;
  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={fg} /> : null}
      <Text style={type(size === 'lg' ? 'md' : 'sm', 'bold', fg)} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
  return (
    <Pressable
      onPress={() => {
        if (haptic) hapticTap();
        onPress();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        { height, borderRadius: size === 'lg' ? 12 : 10, overflow: 'hidden', alignSelf: fullWidth ? 'stretch' : 'auto' },
        { opacity: off ? 0.5 : pressed ? 0.88 : 1 },
        variant === 'primary' && !off && shadowSoft,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={colors.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ui.btnInner}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[ui.btnInner, { backgroundColor: bg, borderRadius: size === 'lg' ? 12 : 10 }, border]}>{content}</View>
      )}
    </Pressable>
  );
}

/** Text link, at least 44 px tall. */
export function LinkButton({ title, onPress, color = colors.brand, style }: { title: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, style]}>
      <Text style={type('sm', 'semibold', color)}>{title}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- inputs

/** Text field with label, optional left icon and error text. */
export function Input({
  label,
  icon,
  error,
  prefix,
  containerStyle,
  style,
  ...props
}: TextInputProps & { label?: string; icon?: IonName; error?: string | null; prefix?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: spacing.lg }, containerStyle]}>
      {label ? <Text style={[type('xs', 'semibold', colors.textMuted), { marginBottom: 6 }]}>{label}</Text> : null}
      <View style={[ui.inputRing, focused && { borderColor: error ? 'rgba(220,38,38,0.16)' : 'rgba(11,94,215,0.16)' }]}>
      <View
        style={[
          ui.inputBox,
          props.multiline && { alignItems: 'flex-start', paddingVertical: spacing.sm },
          focused && { borderColor: colors.brand, backgroundColor: colors.white },
          !!error && { borderColor: colors.danger },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? colors.brand : colors.textMuted} style={props.multiline ? { marginTop: 10 } : undefined} />
        ) : null}
        {prefix ? <Text style={type('md', 'semibold', colors.text)}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[ui.input, style]}
        />
      </View>
      </View>
      {error ? <Text style={[type('xs', 'medium', colors.danger), { marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

/** Backwards-compatible alias. */
export const Field = Input;

/** A tappable form row (icon, small label, big value) that opens a picker. */
export function SelectRow({
  label,
  value,
  placeholder = 'Select',
  icon = 'location-outline',
  iconColor = colors.brand,
  onPress,
  style,
}: {
  label: string;
  value: string;
  placeholder?: string;
  icon?: IonName;
  iconColor?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value || placeholder}`}
      style={({ pressed }) => [ui.selectRow, pressed && { backgroundColor: colors.background }, style]}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={type('xs', 'medium', colors.textMuted)}>{label}</Text>
        <Text style={type('md', 'bold', value ? colors.text : colors.textSubtle)} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

export type SheetOption = { key: string; label: string; sub?: string };

/**
 * Bottom-sheet list picker. The Modal is only mounted while `visible` is true, so nothing native
 * exists for a closed picker (no stale or pre-opened sheet on launch).
 */
export function OptionSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  icon = 'location-outline',
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  value?: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  icon?: IonName;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={[ui.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={ui.sheetHandle} />
          <View style={ui.sheetHead}>
            <Text style={type('lg', 'bold')}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={ui.headerBtnDark} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.key}
            style={{ maxHeight: 460 }}
            ListEmptyComponent={<Text style={[type('sm', 'regular', colors.textMuted), { padding: spacing.xl }]}>Nothing to choose from.</Text>}
            renderItem={({ item }) => {
              const on = item.key === value;
              return (
                <Pressable
                  style={({ pressed }) => [ui.option, pressed && { backgroundColor: colors.background }]}
                  onPress={() => {
                    hapticSelect();
                    onSelect(item.key);
                    onClose();
                  }}
                >
                  <IconCircle name={icon} size={36} color={on ? colors.white : colors.brand} bg={on ? colors.brand : colors.brandLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={type('md', on ? 'bold' : 'medium')} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.sub ? (
                      <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
                        {item.sub}
                      </Text>
                    ) : null}
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- chips & segments

export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IonName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [ui.chip, selected && ui.chipOn, pressed && { opacity: 0.8 }, style]}
    >
      {icon ? <Ionicons name={icon} size={15} color={selected ? colors.brand : colors.textMuted} /> : null}
      <Text style={type('sm', 'semibold', selected ? colors.brand : colors.text)} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: K; label: string; icon?: IonName; mci?: MciName }[];
  value: K;
  onChange: (k: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[ui.segment, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              if (!on) hapticSelect();
              onChange(o.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[ui.segBtn, on && ui.segOn]}
          >
            {o.mci ? <MaterialCommunityIcons name={o.mci} size={18} color={on ? colors.brand : colors.textMuted} /> : null}
            {o.icon ? <Ionicons name={o.icon} size={17} color={on ? colors.brand : colors.textMuted} /> : null}
            <Text style={type('sm', on ? 'bold' : 'semibold', on ? colors.brand : colors.textMuted)} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- badges

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
export const TONES: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand, bg: colors.brandLight },
  success: { fg: colors.success, bg: colors.successLight },
  warning: { fg: colors.warning, bg: colors.warningLight },
  danger: { fg: colors.danger, bg: colors.dangerLight },
  neutral: { fg: colors.textMuted, bg: colors.background },
};

export function Badge({ label, tone = 'brand', icon, style }: { label: string; tone?: Tone; icon?: IonName; style?: StyleProp<ViewStyle> }) {
  const t = TONES[tone];
  return (
    <View style={[ui.badge, { backgroundColor: t.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} /> : null}
      <Text style={[type('xs', 'bold', t.fg), { lineHeight: 16 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** True while the journey is under way (driver started the trip / rental). */
export const isOnTrip = (b: { status: BookingStatus; tripStatus?: TripStatus }) => b.status === 'CONFIRMED' && b.tripStatus === 'STARTED';

/** Booking status → label, tone and icon (shared by the badge and the ticket banner). */
export function statusInfo(status: BookingStatus, tripStatus?: TripStatus): { label: string; tone: Tone; icon: IonName } {
  if (isOnTrip({ status, tripStatus })) return { label: 'On trip', tone: 'brand', icon: 'navigate-circle-outline' };
  switch (status) {
    case 'PENDING':
      return { label: 'Payment pending', tone: 'warning', icon: 'time-outline' };
    case 'CONFIRMED':
      return { label: 'Confirmed', tone: 'success', icon: 'checkmark-circle' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'danger', icon: 'close-circle-outline' };
    case 'EXPIRED':
      return { label: 'Expired', tone: 'neutral', icon: 'time-outline' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'neutral', icon: 'flag-outline' };
  }
}

export const StatusBadge = ({ status, tripStatus }: { status: BookingStatus; tripStatus?: TripStatus }) => {
  const i = statusInfo(status, tripStatus);
  return <Badge label={i.label} tone={i.tone} icon={i.icon} />;
};

// ---------------------------------------------------------------- rows & states

export function ListRow({
  icon,
  mci,
  title,
  subtitle,
  onPress,
  right,
  chevron = true,
  tone = 'brand',
  last,
}: {
  icon?: IonName;
  mci?: MciName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  chevron?: boolean;
  tone?: Tone;
  last?: boolean;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [ui.listRow, !last && ui.listRowBorder, pressed && { backgroundColor: colors.background }]}
    >
      {icon || mci ? <IconCircle name={icon} mci={mci} size={38} color={t.fg} bg={t.bg} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={type('md', 'semibold')} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron && onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /> : null}
    </Pressable>
  );
}

export function EmptyState({
  icon = 'bus-outline',
  mci,
  art,
  title,
  text,
  action,
  style,
}: {
  icon?: IonName;
  mci?: MciName;
  /** A spot illustration; replaces the icon. */
  art?: IllustrationKind;
  title: string;
  text?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxxl }, style]}>
      {art ? <Illustration kind={art} size={168} /> : <IconCircle name={icon} mci={mci} size={88} />}
      <Text style={[type('lg', 'bold'), { textAlign: 'center', marginTop: spacing.lg }]}>{title}</Text>
      {text ? <Text style={[type('sm', 'regular', colors.textMuted), { textAlign: 'center', marginTop: 6, maxWidth: 300 }]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/** Backwards-compatible wrapper around EmptyState. */
export const Empty = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <EmptyState title={title} text={subtitle} action={action} />
);

export const Loading = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.brand} />
  </View>
);

/** Grey block that gently pulses while content loads. */
export function Skeleton({ width = '100%', height = 14, r = 6, style }: { width?: number | `${number}%`; height?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.border, opacity: pulse }, style]} />;
}

/** A card-shaped skeleton used for loading lists. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={[ui.card, { padding: spacing.lg, marginBottom: spacing.md, gap: spacing.md }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width="40%" height={20} />
        <Skeleton width="22%" height={20} />
      </View>
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton key={i} width={i % 2 ? '55%' : '80%'} />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 4, lines = 3, style }: { count?: number; lines?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ padding: spacing.lg }, style]}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- bottom bar

/** Sticky bottom CTA area: total on the left, the action on the right. Safe-area aware. */
export function BottomBar({
  caption,
  amount,
  note,
  left,
  children,
}: {
  caption?: string;
  amount?: number;
  note?: string;
  left?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ui.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) + (Platform.OS === 'ios' ? 0 : spacing.xs) }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {left ?? (
          <>
            {caption ? (
              <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
            {amount !== undefined ? <Money amount={amount} size="xl" weight="extrabold" /> : null}
            {note ? (
              <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                {note}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View style={{ flexShrink: 0, minWidth: 150 }}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------- styles

export const ui = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, ...shadow },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: spacing.xs },
  headerBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerBtnDark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  btnInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6 },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 10 },
  inputRing: { borderWidth: 3, borderColor: 'transparent', borderRadius: radius.input + 3, margin: -3 },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 52,
  },
  errRetry: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 32 },
  steps: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.card },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: { flex: 1, minWidth: 12, height: 2, borderRadius: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  inputBox: {
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
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, paddingVertical: 10, minHeight: 46 },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 10 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: spacing.sm },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  segment: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  segOn: { backgroundColor: colors.card, ...shadowSoft },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  listRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.border },
  amenityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  amenityDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  bottomBar: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...Platform.select<ViewStyle>({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: -4 } },
      default: { elevation: 12 },
    }),
  },
});
