import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, errorMessage, getConfig } from '../api';
import { useAuth } from '../auth';
import { BRAND, Devotional, LogoMark } from '../brand';
import { colors, fonts, radius, shadow, space } from '../theme';
import { Button, callPhone, Field, haptic, Ionicons, Loading, Notice, OtpInput, T, TextLink } from '../ui';

/** login: existing drivers. join: new drivers creating an account, then applying. */
type Tab = 'login' | 'join';
/** form: number/details, code: enter the OTP, name: new account's name after a verified OTP. */
type Step = 'form' | 'code' | 'name';
type Channel = 'PHONE' | 'EMAIL';

const digitsOf = (s: string) => s.replace(/\D/g, '').slice(-10);
const validPhone = (p: string) => /^[6-9]\d{9}$/.test(p);

export default function Login() {
  const { requestOtp, verifyOtp, loginPassword, registerPassword } = useAuth();
  const insets = useSafeAreaInsets();

  // What the server can send, from /api/config. null while loading.
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [supportPhone, setSupportPhone] = useState<string>(BRAND.phone);
  useEffect(() => {
    getConfig()
      .then((c) => {
        setChannels([...(c.otpLogin ? (['PHONE'] as const) : []), ...(c.emailOtp ? (['EMAIL'] as const) : [])]);
        if (c.supportPhone) setSupportPhone(c.supportPhone);
      })
      .catch(() => setChannels([]));
  }, []);

  const [tab, setTab] = useState<Tab>('login');
  const [step, setStep] = useState<Step>('form');
  const [usePassword, setUsePassword] = useState(false);
  const [channel, setChannel] = useState<Channel>('PHONE');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!channels) return <Loading />;

  const phoneOtp = channels.includes('PHONE');
  // Log in: OTP when SMS works, else password. Join: OTP verification when any channel works, else a password account.
  const loginByPassword = usePassword || !phoneOtp;
  const joinByPassword = channels.length === 0;
  const joinChannel: Channel = channels.includes(channel) ? channel : channels[0] ?? 'PHONE';
  const otpEmail = tab === 'join' && joinChannel === 'EMAIL' ? email.trim().toLowerCase() : undefined;
  const p = digitsOf(phone);
  const sentTo = otpEmail ?? `+91 ${p}`;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      haptic.error();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    haptic.tap();
    setTab(next);
    setStep('form');
    setOtp('');
    setError(null);
  };

  const sendOtp = () =>
    run(async () => {
      if (!validPhone(p)) throw new Error('Enter your 10-digit mobile number.');
      if (otpEmail !== undefined && !/^\S+@\S+\.\S+$/.test(otpEmail)) throw new Error('Enter a valid email address.');
      try {
        const r = await requestOtp(p, otpEmail);
        setDevOtp(r.devOtp ?? null);
        setOtp('');
        setStep('code');
      } catch (e) {
        // The server stopped sending OTPs since the config was loaded: fall back to passwords.
        if (e instanceof ApiError && e.status === 503) {
          setChannels((c) => (c ?? []).filter((x) => x !== (otpEmail ? 'EMAIL' : 'PHONE')));
          if (tab === 'login') setUsePassword(true);
        }
        throw e;
      }
    });

  const submitOtp = (code = otp) =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code.');
      const r = await verifyOtp(p, code, undefined, otpEmail);
      // A new account: the code is still unused, so ask for the name and send both.
      if (r.needsName) setStep('name');
      else haptic.success();
    });

  const submitName = () =>
    run(async () => {
      if (name.trim().length < 2) throw new Error('Enter your full name as on your driving licence.');
      try {
        await verifyOtp(p, otp, name, otpEmail);
      } catch (e) {
        // A wrong or expired code goes back a step so a new one can be entered or requested.
        if (e instanceof ApiError && /otp/i.test(e.message)) {
          setOtp('');
          setStep(/expired|request a new/i.test(e.message) ? 'form' : 'code');
        }
        throw e;
      }
      haptic.success();
    });

  const submitPasswordLogin = () =>
    run(async () => {
      if (!phone.trim() || !password) throw new Error('Enter your mobile number and password.');
      await loginPassword(phone, password);
      haptic.success();
    });

  const submitPasswordJoin = () =>
    run(async () => {
      if (name.trim().length < 2) throw new Error('Enter your full name as on your driving licence.');
      if (!validPhone(p)) throw new Error('Enter your 10-digit mobile number.');
      if (password.length < 6) throw new Error('Choose a password of at least 6 characters.');
      await registerPassword({ name: name.trim(), phone: p, password });
      haptic.success();
    });

  // ---- copy for the current step
  const heading =
    step === 'code' ? 'Enter verification code' : step === 'name' ? 'One last step' : tab === 'login' ? 'Welcome back' : 'Drive with us';
  const subheading =
    step === 'code'
      ? `We sent a 6-digit code to ${sentTo}.`
      : step === 'name'
        ? `${sentTo} is verified. Add your name to create your account.`
        : tab === 'login'
          ? loginByPassword
            ? 'Log in with your registered mobile number and password.'
            : 'Log in with your registered mobile number.'
          : joinByPassword
            ? 'Create your account, then complete a short application. Our office reviews it within a day.'
            : 'Verify your number to start. The application takes about 5 minutes.';

  const phoneField = (onSubmit?: () => void) => (
    <Field
      label="Mobile number"
      prefix="+91"
      value={phone}
      onChangeText={setPhone}
      keyboardType="phone-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      maxLength={13}
      placeholder="98765 43210"
      returnKeyType={onSubmit ? 'go' : 'next'}
      onSubmitEditing={onSubmit}
    />
  );

  const passwordField = (label: string, onSubmit: () => void, isNew = false) => (
    <Field
      label={label}
      icon="lock-closed-outline"
      value={password}
      onChangeText={setPassword}
      secureTextEntry={!showPw}
      autoComplete={isNew ? 'new-password' : 'password'}
      placeholder={isNew ? 'At least 6 characters' : undefined}
      returnKeyType="go"
      onSubmitEditing={onSubmit}
      right={
        <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={12} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
          <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
        </Pressable>
      }
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[st.header, { paddingTop: insets.top + space.lg }]}>
        <Devotional size={12} style={{ marginBottom: space.md, textAlign: 'left' }} />
        <View style={st.brandRow}>
          <LogoMark size={52} />
          <View style={{ flex: 1 }}>
            <T v="title" color={colors.onBrand} numberOfLines={1}>
              {BRAND.wordmark}
            </T>
            <T v="caption" color={colors.onBrandMuted} numberOfLines={1}>
              {BRAND.wordmarkSub} · Driver Partner
            </T>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ marginTop: -space.xxxl }}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[st.card, shadow.raised]}>
            {step === 'form' ? (
              <View style={st.tabs} accessibilityRole="tablist">
                {(
                  [
                    ['login', 'Log in'],
                    ['join', 'Join as driver'],
                  ] as const
                ).map(([k, label]) => {
                  const on = tab === k;
                  return (
                    <Pressable key={k} onPress={() => switchTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[st.tab, on && st.tabOn]}>
                      <T v="label" color={on ? colors.text : colors.textMuted} style={{ fontFamily: on ? fonts.bold : fonts.semibold }}>
                        {label}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setStep(step === 'name' ? 'code' : 'form');
                  setError(null);
                }}
                hitSlop={8}
                style={st.back}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
                <T v="label">Back</T>
              </Pressable>
            )}

            <T v="title">{heading}</T>
            <T v="body" color={colors.textMuted} style={{ marginTop: space.xs, marginBottom: space.xl }}>
              {subheading}
            </T>

            {/* ---- Log in */}
            {tab === 'login' && step === 'form' && loginByPassword ? (
              <>
                {phoneField()}
                {passwordField('Password', submitPasswordLogin)}
              </>
            ) : null}
            {tab === 'login' && step === 'form' && !loginByPassword ? phoneField(sendOtp) : null}

            {/* ---- Join: password account (no OTP on the server yet) */}
            {tab === 'join' && step === 'form' && joinByPassword ? (
              <>
                <Field
                  label="Full name (as on your driving licence)"
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  maxLength={80}
                  placeholder="e.g. Ramesh Kumar"
                  returnKeyType="next"
                />
                {phoneField()}
                {passwordField('Create a password', submitPasswordJoin, true)}
              </>
            ) : null}

            {/* ---- Join: verify by OTP */}
            {tab === 'join' && step === 'form' && !joinByPassword ? (
              <>
                {channels.length > 1 ? (
                  <View style={st.choice} accessibilityRole="radiogroup">
                    {channels.map((c) => {
                      const on = joinChannel === c;
                      return (
                        <Pressable
                          key={c}
                          onPress={() => setChannel(c)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          style={[st.choiceBtn, on && st.choiceOn]}
                        >
                          <Ionicons name={c === 'PHONE' ? 'chatbubble-ellipses-outline' : 'mail-outline'} size={18} color={on ? colors.brand : colors.textMuted} />
                          <T v="label" color={on ? colors.brand : colors.textMuted}>
                            {c === 'PHONE' ? 'Code on WhatsApp' : 'Code by email'}
                          </T>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                {phoneField(joinChannel === 'PHONE' ? sendOtp : undefined)}
                {joinChannel === 'EMAIL' ? (
                  <Field
                    label="Email"
                    icon="mail-outline"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    placeholder="you@example.com"
                    returnKeyType="go"
                    onSubmitEditing={sendOtp}
                  />
                ) : null}
              </>
            ) : null}

            {/* ---- OTP code */}
            {step === 'code' ? (
              <>
                {devOtp ? (
                  <Pressable onPress={() => setOtp(devOtp)} style={st.devHint} accessibilityRole="button" accessibilityLabel="Fill test code">
                    <Ionicons name="flask-outline" size={18} color={colors.warning} />
                    <T v="caption" color={colors.warning} style={{ flex: 1 }}>
                      Test mode code: <T v="caption" style={{ fontFamily: fonts.bold, color: colors.text }}>{devOtp}</T>
                    </T>
                    <T v="caption" color={colors.brand} style={{ fontFamily: fonts.bold }}>
                      Fill
                    </T>
                  </Pressable>
                ) : null}
                <OtpInput value={otp} onChange={setOtp} length={6} autoFocus onComplete={(v) => submitOtp(v)} />
                <View style={{ height: space.lg }} />
              </>
            ) : null}

            {/* ---- Name for a new account */}
            {step === 'name' ? (
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
            ) : null}

            {error ? <Notice text={error} tone="danger" style={{ marginBottom: space.lg }} /> : null}

            {step === 'form' ? (
              tab === 'login' ? (
                loginByPassword ? (
                  <Button title="Log in" onPress={submitPasswordLogin} loading={busy} />
                ) : (
                  <Button title="Send code" onPress={sendOtp} loading={busy} />
                )
              ) : joinByPassword ? (
                <Button title="Create account" onPress={submitPasswordJoin} loading={busy} />
              ) : (
                <Button title="Send code" onPress={sendOtp} loading={busy} />
              )
            ) : step === 'code' ? (
              <>
                <Button title={tab === 'join' ? 'Verify' : 'Verify & log in'} onPress={() => submitOtp()} loading={busy} />
                <TextLink title="Didn't get it? Send again" onPress={() => setStep('form')} />
              </>
            ) : (
              <Button title="Create account" onPress={submitName} loading={busy} />
            )}

            {tab === 'login' && step === 'form' && phoneOtp ? (
              <TextLink
                title={loginByPassword ? 'Log in with a code instead' : 'Log in with password instead'}
                onPress={() => {
                  setUsePassword(!loginByPassword);
                  setError(null);
                }}
              />
            ) : null}
          </View>

          <View style={{ flex: 1 }} />
          <Pressable onPress={() => callPhone(supportPhone)} style={st.help} accessibilityRole="button" accessibilityLabel={`Call the office on ${supportPhone}`}>
            <Ionicons name="call-outline" size={18} color={colors.brand} />
            <T v="label" color={colors.textMuted}>
              Need help? <T v="label" color={colors.brand}>Call the office</T>
            </T>
          </Pressable>
          <T v="caption" color={colors.textMuted} center style={{ marginTop: space.xs }}>
            Your details are only used to verify you as a {BRAND.short} driver.
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  header: { backgroundColor: colors.brandDark, paddingHorizontal: space.xl, paddingBottom: space.xxxl + space.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  card: { backgroundColor: colors.card, borderRadius: radius.card + 2, padding: space.xl },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.input + 4, padding: 4, marginBottom: space.xl },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input + 1 },
  tabOn: { backgroundColor: colors.card, ...shadow.card },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 40, marginBottom: space.md },
  choice: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radius.input + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  choiceOn: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  devHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radius.input + 2,
    padding: space.md,
    marginBottom: space.lg,
  },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 48, marginTop: space.xl },
});
