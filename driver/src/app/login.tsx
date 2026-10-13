import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { BRAND, Devotional, Emblem } from '../brand';
import { colors, fonts, gradient, radius, shadow, space } from '../theme';
import { Button, Card, Field, haptic, Ionicons, MaterialCommunityIcons, Notice, OtpInput, showError, T, TextLink } from '../ui';

type Mode = 'phone' | 'otp' | 'name' | 'password';
/** login: existing drivers. apply: new drivers verifying their number to start an application. */
type Intent = 'login' | 'apply';

export default function Login() {
  const { requestOtp, verifyOtp, loginPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('phone');
  const [intent, setIntent] = useState<Intent>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showError(e, 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = () =>
    run(async () => {
      const p = phone.replace(/\D/g, '').slice(-10);
      if (p.length !== 10) throw new Error('Enter your 10-digit mobile number.');
      try {
        const r = await requestOtp(p);
        setDevOtp(r.devOtp ?? null);
        setOtp('');
        setMode('otp');
      } catch (e) {
        // OTP login not set up on the server: switch to password silently.
        if (e instanceof ApiError && e.status === 503) {
          setNote(e.message);
          setMode('password');
        } else throw e;
      }
    });

  const submitOtp = (code = otp) =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit OTP.');
      const r = await verifyOtp(phone.replace(/\D/g, '').slice(-10), code);
      // A new number: the OTP is still valid, so ask for the name and resubmit it.
      if (r.needsName) {
        setMode('name');
        return;
      }
      haptic.success();
    });

  const submitName = () =>
    run(async () => {
      if (name.trim().length < 2) throw new Error('Enter your full name.');
      try {
        const r = await verifyOtp(phone.replace(/\D/g, '').slice(-10), otp, name);
        if (r.needsName) throw new Error('Enter your full name.');
      } catch (e) {
        // The OTP is only checked now (with the name): a wrong or expired code goes back to the OTP step.
        if (e instanceof ApiError && /otp/i.test(e.message)) {
          setOtp('');
          setMode(/expired|request a new/i.test(e.message) ? 'phone' : 'otp');
        }
        throw e;
      }
      haptic.success();
    });

  const switchIntent = (next: Intent) => {
    haptic.tap();
    setIntent(next);
    setNote(null);
    setOtp('');
    setMode('phone');
  };

  const submitPassword = () =>
    run(async () => {
      if (!phone.trim() || !password) throw new Error('Enter your mobile number and password.');
      await loginPassword(phone, password);
      haptic.success();
    });

  const heroHeight = Math.min(340, Dimensions.get('window').height * 0.42);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { height: heroHeight + insets.top }]}>
        <View style={st.ring1} />
        <View style={st.ring2} />
      </LinearGradient>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', marginBottom: space.xxl }}>
            <Devotional size={14} style={{ marginBottom: space.sm }} />
            <View style={st.logo}>
              <Emblem size={84} />
              <View style={st.steering}>
                <MaterialCommunityIcons name="steering" size={18} color={colors.brand} />
              </View>
            </View>
            <T v="display" color={colors.onBrand} center numberOfLines={1} adjustsFontSizeToFit>
              {BRAND.wordmark}
            </T>
            <T v="overline" color={colors.gold} center style={{ letterSpacing: 2, marginTop: 2 }}>
              {`${BRAND.wordmarkSub} · Driver`}
            </T>
            <View style={st.routeChip}>
              <Ionicons name="location" size={14} color={colors.onBrand} />
              <T v="bodyStrong" color={colors.onBrand}>
                Delhi · Haridwar · Hill stations
              </T>
            </View>
          </View>

          <Card style={[{ padding: space.xl }, shadow.raised]}>
            {intent === 'apply' && mode !== 'name' ? (
              <View style={st.applyChip}>
                <MaterialCommunityIcons name="card-account-details-outline" size={16} color={colors.accent} />
                <T v="caption" color="#C2410C" style={{ fontFamily: fonts.bold }}>
                  New driver application
                </T>
              </View>
            ) : null}
            <T v="title">{mode === 'otp' ? 'Enter OTP' : mode === 'name' ? `Welcome to ${BRAND.short}` : intent === 'apply' ? 'Apply to drive' : 'Log in'}</T>
            <T v="body" color={colors.textMuted} style={{ marginTop: 4, marginBottom: space.xl }}>
              {mode === 'otp'
                ? `We sent a 6-digit code to +91 ${phone.replace(/\D/g, '').slice(-10)}`
                : mode === 'name'
                  ? `+91 ${phone.replace(/\D/g, '').slice(-10)} is verified. Tell us your name to create your account.`
                  : mode === 'password'
                    ? 'Use your mobile number and password'
                    : intent === 'apply'
                      ? 'Verify your mobile number to start. The application takes about 5 minutes.'
                      : 'Use your registered mobile number'}
            </T>

            {note ? <Notice tone="warning" text={note} style={{ marginBottom: space.lg }} /> : null}

            {mode === 'phone' || mode === 'password' ? (
              <Field
                label="Mobile number"
                prefix="+91"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={13}
                placeholder="98765 43210"
                onSubmitEditing={mode === 'phone' ? sendOtp : undefined}
                style={{ fontSize: 22, fontFamily: fonts.bold, letterSpacing: 1 }}
              />
            ) : null}

            {mode === 'phone' && <Button title="Send OTP" icon="arrow-forward" onPress={sendOtp} loading={busy} />}

            {mode === 'otp' && (
              <>
                {devOtp ? (
                  <Pressable
                    onPress={() => {
                      setOtp(devOtp);
                      haptic.tap();
                    }}
                    style={({ pressed }) => [st.devHint, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Fill test OTP"
                  >
                    <Ionicons name="flask-outline" size={20} color="#92400E" />
                    <View style={{ flex: 1 }}>
                      <T v="caption" color="#92400E">
                        Test mode OTP
                      </T>
                      <T style={{ fontFamily: fonts.mono, fontWeight: '700', fontSize: 20, letterSpacing: 4, color: '#78350F' }}>{devOtp}</T>
                    </View>
                    <T v="label" color="#92400E" style={{ fontFamily: fonts.bold }}>
                      Tap to fill
                    </T>
                  </Pressable>
                ) : null}
                <OtpInput value={otp} onChange={setOtp} length={6} autoFocus onComplete={(v) => submitOtp(v)} />
                <Button title={intent === 'apply' ? 'Verify number' : 'Verify & log in'} icon="checkmark-circle" onPress={() => submitOtp()} loading={busy} style={{ marginTop: space.xl }} />
                <TextLink
                  title="Change number / resend OTP"
                  icon="refresh"
                  onPress={() => {
                    setMode('phone');
                  }}
                />
              </>
            )}

            {mode === 'name' && (
              <>
                <Field
                  label="Full name (as on your driving licence)"
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  autoFocus
                  maxLength={80}
                  placeholder="e.g. Ramesh Kumar"
                  returnKeyType="done"
                  onSubmitEditing={submitName}
                />
                <Button title="Continue" icon="arrow-forward" onPress={submitName} loading={busy} />
                <TextLink title="Use a different number" icon="refresh" onPress={() => setMode('phone')} />
              </>
            )}

            {mode === 'password' && (
              <>
                <Field
                  label="Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  autoComplete="password"
                  onSubmitEditing={submitPassword}
                  right={
                    <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={12} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                      <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
                    </Pressable>
                  }
                />
                <Button title="Log in" icon="log-in-outline" onPress={submitPassword} loading={busy} />
              </>
            )}

            {intent === 'login' && mode !== 'name' ? (
              <>
                <View style={st.or}>
                  <View style={st.orLine} />
                  <T v="caption" color={colors.textMuted}>
                    or
                  </T>
                  <View style={st.orLine} />
                </View>
                <TextLink
                  title={mode === 'password' ? 'Use OTP instead' : 'Use password'}
                  icon={mode === 'password' ? 'chatbubble-ellipses-outline' : 'key-outline'}
                  onPress={() => {
                    setNote(null);
                    setMode(mode === 'password' ? 'phone' : 'password');
                  }}
                />
              </>
            ) : null}
          </Card>

          {mode === 'name' ? null : intent === 'login' ? (
            <Pressable
              onPress={() => switchIntent('apply')}
              accessibilityRole="button"
              accessibilityLabel={`New driver? Apply to drive with ${BRAND.short}`}
              style={({ pressed }) => [st.applyCard, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
            >
              <View style={st.applyIcon}>
                <MaterialCommunityIcons name="card-account-details-star-outline" size={26} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">New driver?</T>
                <T v="label" color={colors.textMuted} style={{ fontFamily: fonts.medium, marginTop: 2 }}>
                  Apply to drive with {BRAND.short}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.accent} />
            </Pressable>
          ) : (
            <View style={{ marginTop: space.md }}>
              <TextLink title={`Already a ${BRAND.short} driver? Log in`} icon="log-in-outline" onPress={() => switchIntent('login')} />
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.lg }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
            <T v="caption" color={colors.textMuted}>
              Your number is verified by OTP and never shared
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  ring1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 40, borderColor: 'rgba(255,255,255,0.06)', top: -80, right: -90 },
  ring2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -60, left: -50 },
  logo: { width: 84, height: 84, borderRadius: 42, marginBottom: space.md, ...shadow.raised },
  steering: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  devHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderStyle: 'dashed',
    borderRadius: radius.input + 2,
    padding: space.md,
    marginBottom: space.lg,
  },
  applyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentLight,
    marginBottom: space.sm,
  },
  applyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: '#FFCC80',
    ...shadow.card,
  },
  applyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
});
