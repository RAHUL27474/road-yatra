import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError, errorMessage, getConfig } from '../api';
import { useAuth } from '../auth';
import { AuthShell, OtpInput } from '../AuthShell';
import { colors, radius, spacing, type } from '../theme';
import { Button, Input, LinkButton, Loading, Notice } from '../ui';

const RESEND_SECONDS = 30;

const done = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/');
};

export default function Login() {
  // null while we find out from /api/config whether OTP login is switched on.
  const [mode, setMode] = useState<'otp' | 'password' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then((c) => setMode(c.otpLogin ? 'otp' : 'password'))
      .catch(() => setMode('password'));
  }, []);

  if (!mode) return <Loading />;

  const footer = (
    <Pressable onPress={() => router.replace('/register')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }}>
      <Text style={type('sm', 'regular', colors.textMuted)}>
        Prefer a password? <Text style={type('sm', 'bold', colors.brand)}>Create an account</Text>
      </Text>
    </Pressable>
  );

  return mode === 'otp' ? (
    <OtpLogin
      footer={footer}
      onUsePassword={(why) => {
        setNotice(why ?? null);
        setMode('password');
      }}
    />
  ) : (
    <PasswordLogin footer={footer} notice={notice} onUseOtp={notice ? undefined : () => setMode('otp')} />
  );
}

function OtpLogin({ onUsePassword, footer }: { onUsePassword: (why?: string) => void; footer: ReactNode }) {
  const { requestOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [askName, setAskName] = useState(false);
  const [name, setName] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Resend countdown.
  const wait = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));
  useEffect(() => {
    if (!sentTo || wait <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sentTo, wait]);

  const send = async () => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Please enter a valid 10-digit mobile number.');
    setError(null);
    setBusy(true);
    try {
      const r = await requestOtp(digits);
      setSentTo(digits);
      setOtp('');
      setAskName(r.isNewUser);
      setDevOtp(r.devOtp ?? null);
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) onUsePassword('Login by OTP is not available right now. Please use your password.');
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sentTo) return;
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit OTP.');
    if (askName && name.trim().length < 2) return setError('Please enter your name.');
    setError(null);
    setBusy(true);
    try {
      const r = await verifyOtp(sentTo, otp, askName ? name.trim() : undefined);
      if (r.needsName) {
        setAskName(true);
        setError('Looks like you are new here. Please enter your name to continue.');
      } else done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={sentTo ? 'Enter OTP' : 'Log in with mobile number'}
      subtitle={sentTo ? `We sent a 6-digit OTP to +91 ${sentTo}.` : "We'll send you a one-time password (OTP) on WhatsApp."}
      footer={footer}
    >
      {!sentTo ? (
        <>
          <Input
            label="Mobile number"
            icon="call-outline"
            prefix="+91"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={13}
            autoComplete="tel"
            placeholder="10-digit mobile number"
            onSubmitEditing={send}
          />
          <Notice style={{ marginBottom: spacing.md }}>{error}</Notice>
          <Button title="Send OTP" icon="chatbubble-ellipses-outline" onPress={send} loading={busy} />
        </>
      ) : (
        <>
          <OtpInput value={otp} onChange={setOtp} onSubmit={askName ? undefined : verify} />
          {devOtp ? (
            <Pressable onPress={() => setOtp(devOtp)} style={st.devHint} accessibilityLabel="Fill test OTP">
              <Ionicons name="flask-outline" size={16} color={colors.warning} />
              <Text style={[type('xs', 'semibold', colors.warning), { flex: 1 }]}>
                Test mode: your OTP is <Text style={type('xs', 'extrabold', colors.text)}>{devOtp}</Text>
              </Text>
              <Text style={type('xs', 'bold', colors.brand)}>Fill</Text>
            </Pressable>
          ) : null}
          {askName ? (
            <Input label="Your name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" onSubmitEditing={verify} />
          ) : null}
          <Notice style={{ marginBottom: spacing.md }}>{error}</Notice>
          <Button title={askName ? 'Create account & log in' : 'Verify & log in'} onPress={verify} loading={busy} />
          <View style={st.links}>
            <LinkButton
              title="Change number"
              onPress={() => {
                setSentTo(null);
                setError(null);
              }}
            />
            {wait > 0 ? (
              <Text style={type('sm', 'medium', colors.textMuted)}>Resend OTP in 0:{String(wait).padStart(2, '0')}</Text>
            ) : (
              <LinkButton title={busy ? 'Sending…' : 'Resend OTP'} onPress={busy ? () => {} : send} />
            )}
          </View>
        </>
      )}
      <View style={st.orRow}>
        <View style={st.orLine} />
        <Text style={type('xs', 'medium', colors.textSubtle)}>OR</Text>
        <View style={st.orLine} />
      </View>
      <Button title="Use password instead" variant="outline" size="md" icon="lock-closed-outline" onPress={() => onUsePassword()} />
    </AuthShell>
  );
}

function PasswordLogin({ notice, onUseOtp, footer }: { notice: string | null; onUseOtp?: () => void; footer: ReactNode }) {
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!id.trim() || !password) return setError('Enter your mobile number or email and password.');
    setError(null);
    setBusy(true);
    try {
      await login(id, password);
      done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to book and manage your trips." footer={footer}>
      <Notice tone="warning" style={{ marginBottom: spacing.lg }}>
        {notice}
      </Notice>
      <Input
        label="Mobile number or email"
        icon="person-outline"
        value={id}
        onChangeText={setId}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="username"
      />
      <View>
        <Input
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoComplete="password"
          onSubmitEditing={submit}
          style={{ paddingRight: 44 }}
        />
        <Pressable onPress={() => setShow((v) => !v)} hitSlop={6} style={st.eye} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Notice style={{ marginBottom: spacing.md }}>{error}</Notice>
      <Button title="Log in" onPress={submit} loading={busy} />
      {onUseOtp ? (
        <>
          <View style={st.orRow}>
            <View style={st.orLine} />
            <Text style={type('xs', 'medium', colors.textSubtle)}>OR</Text>
            <View style={st.orLine} />
          </View>
          <Button title="Log in with OTP instead" variant="outline" size="md" icon="chatbubble-ellipses-outline" onPress={onUseOtp} />
        </>
      ) : null}
    </AuthShell>
  );
}

const st = StyleSheet.create({
  devHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
  },
  links: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  eye: { position: 'absolute', right: 4, top: 22, width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
