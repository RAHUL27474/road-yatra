import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage, getConfig } from '../api';
import { RegisterInput, useAuth } from '../auth';
import { AuthShell, OtpInput } from '../AuthShell';
import { colors, radius, spacing, type } from '../theme';
import { Button, Input, LinkButton, Loading, Notice, SegmentedControl } from '../ui';

type Channel = RegisterInput['channel'];

export default function Register() {
  const { requestRegisterOtp, register } = useAuth();
  // Where the verification OTP can go, from /api/config. null while loading.
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [channel, setChannel] = useState<Channel>('PHONE');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  // Set once the OTP is sent: the details it was sent for, and where it went.
  const [sent, setSent] = useState<{ input: RegisterInput; to: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getConfig()
      .then((c) => {
        const list: Channel[] = [...(c.otpLogin ? (['PHONE'] as const) : []), ...(c.emailOtp ? (['EMAIL'] as const) : [])];
        setChannels(list);
        if (list[0]) setChannel(list[0]);
      })
      // Config unavailable: offer both and let the server say which works.
      .catch(() => setChannels(['PHONE', 'EMAIL']));
  }, []);

  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const mail = email.trim().toLowerCase();
    if (name.trim().length < 2) return setError('Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Please enter a valid 10-digit mobile number.');
    if (channel === 'EMAIL' && !mail) return setError('Please enter your email to get the OTP by email.');
    if (mail && !/^\S+@\S+\.\S+$/.test(mail)) return setError('Please enter a valid email, or leave it empty.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    const input: RegisterInput = { name: name.trim(), phone: digits, password, channel, ...(mail ? { email: mail } : {}) };
    setError(null);
    setBusy(true);
    try {
      const r = await requestRegisterOtp(input);
      setSent({ input, to: r.sentTo });
      setDevOtp(r.devOtp ?? null);
      setOtp('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sent) return;
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit OTP.');
    setError(null);
    setBusy(true);
    try {
      await register({ ...sent.input, otp });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!channels) return <Loading />;

  const footer = (
    <Pressable onPress={() => router.replace('/login')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }}>
      <Text style={type('sm', 'regular', colors.textMuted)}>
        Already have an account? <Text style={type('sm', 'bold', colors.brand)}>Log in</Text>
      </Text>
    </Pressable>
  );

  if (sent) {
    const where = sent.input.channel === 'PHONE' ? `+91 ${sent.to}` : sent.to;
    return (
      <AuthShell title="Verify your account" subtitle={`We sent a 6-digit OTP to ${where}.`} footer={footer}>
        <OtpInput value={otp} onChange={setOtp} onSubmit={verify} />
        {devOtp ? (
          <Pressable onPress={() => setOtp(devOtp)} style={st.devHint} accessibilityLabel="Fill test OTP">
            <Ionicons name="flask-outline" size={16} color={colors.warning} />
            <Text style={[type('xs', 'semibold', colors.warning), { flex: 1 }]}>
              Test mode: your OTP is <Text style={type('xs', 'extrabold', colors.text)}>{devOtp}</Text>
            </Text>
            <Text style={type('xs', 'bold', colors.brand)}>Fill</Text>
          </Pressable>
        ) : null}
        <Notice style={{ marginBottom: spacing.md }}>{error}</Notice>
        <Button title="Verify & create account" onPress={verify} loading={busy} />
        <View style={st.links}>
          <LinkButton
            title="Change details"
            onPress={() => {
              setSent(null);
              setError(null);
            }}
          />
          <LinkButton title={busy ? 'Sending…' : 'Resend OTP'} onPress={busy ? () => {} : sendOtp} />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Book seats and full cabs in a few taps." footer={footer}>
      <Input label="Full name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <Input label="Mobile number" icon="call-outline" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} autoComplete="tel" />
      <Input
        label={channel === 'EMAIL' ? 'Email' : 'Email (optional)'}
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 6 characters" />
      {channels.length > 1 ? (
        <>
          <Text style={[type('sm', 'semibold', colors.textMuted), { marginBottom: spacing.sm }]}>Verify with an OTP sent to your</Text>
          <SegmentedControl
            options={[
              { key: 'PHONE', label: 'Mobile', icon: 'call-outline' },
              { key: 'EMAIL', label: 'Email', icon: 'mail-outline' },
            ]}
            value={channel}
            onChange={setChannel}
            style={{ marginBottom: spacing.lg }}
          />
        </>
      ) : null}
      {channels.length === 0 ? (
        <Notice tone="warning" style={{ marginBottom: spacing.md }}>
          Sign-up verification is not set up yet. Please try again later.
        </Notice>
      ) : null}
      <Notice style={{ marginBottom: spacing.md }}>{error}</Notice>
      <Button title="Send OTP" icon="chatbubble-ellipses-outline" onPress={sendOtp} loading={busy} disabled={channels.length === 0} />
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
});
