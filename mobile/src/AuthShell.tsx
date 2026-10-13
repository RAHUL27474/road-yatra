import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, Devotional, Emblem, RouteMotif } from './brand';
import { colors, fonts, radius, shadow, spacing, type } from './theme';

/** Branded frame for the login / register screens: gradient top with the logo, then a card form. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.sm, paddingBottom: 64, paddingHorizontal: spacing.xl }}
        >
          <View style={st.decor} />
          <Pressable onPress={close} hitSlop={8} style={st.close} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <View style={{ alignItems: 'center', marginTop: spacing.xs }}>
            <Devotional size={13} style={{ marginBottom: spacing.sm }} />
            <View style={st.logo}>
              <Emblem size={76} />
            </View>
            <Text style={[type('xxl', 'extrabold', colors.white), { marginTop: spacing.md, letterSpacing: -0.5, textAlign: 'center' }]} numberOfLines={1} adjustsFontSizeToFit>
              {BRAND.wordmark}
            </Text>
            <Text style={[type('xs', 'bold', colors.gold), { letterSpacing: 2, marginTop: 1 }]}>{BRAND.wordmarkSub.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              <RouteMotif width={40} />
              <Text style={type('sm', 'medium', colors.onBrandMuted)}>{BRAND.tagline}</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -40 }}>
          <View style={st.card}>
            <Text style={type('xl', 'extrabold')}>{title}</Text>
            <Text style={[type('sm', 'regular', colors.textMuted), { marginTop: 4, marginBottom: spacing.xl }]}>{subtitle}</Text>
            {children}
          </View>
          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Six digit boxes backed by one invisible TextInput (keeps SMS autofill and paste working). */
export function OtpInput({ value, onChange, onSubmit, length = 6 }: { value: string; onChange: (v: string) => void; onSubmit?: () => void; length?: number }) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ marginBottom: spacing.lg }} accessibilityLabel="OTP">
      <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
        {Array.from({ length }, (_, i) => {
          const active = i === Math.min(value.length, length - 1);
          const filled = i < value.length;
          return (
            <View key={i} style={[st.otpBox, filled && { borderColor: colors.brand, backgroundColor: colors.white }, active && st.otpActive]}>
              <Text style={type('xl', 'bold')}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        autoFocus
        caretHidden
        onSubmitEditing={onSubmit}
        style={st.otpHidden}
      />
    </Pressable>
  );
}

const st = StyleSheet.create({
  decor: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -80 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
  logo: { borderRadius: 38, ...shadow },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.xl, ...shadow },
  otpBox: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: radius.input + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpActive: { borderColor: colors.brand, borderWidth: 2 },
  otpHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontFamily: fonts.regular },
});
