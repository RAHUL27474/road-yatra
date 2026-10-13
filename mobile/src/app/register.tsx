import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { AuthShell } from '../AuthShell';
import { colors, spacing, type } from '../theme';
import { Button, Input, Notice } from '../ui';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (name.trim().length < 2) return setError('Please enter your name.');
    const mail = email.trim().toLowerCase();
    if (mail && !/^\S+@\S+\.\S+$/.test(mail)) return setError('Please enter a valid email, or leave it empty.');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Please enter a valid 10-digit mobile number.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setError(null);
    setBusy(true);
    try {
      await register({ name: name.trim(), phone: digits, password, ...(mail ? { email: mail } : {}) });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Book seats and full cabs in a few taps."
      footer={
        <Pressable onPress={() => router.replace('/login')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }}>
          <Text style={type('sm', 'regular', colors.textMuted)}>
            Already have an account? <Text style={type('sm', 'bold', colors.brand)}>Log in</Text>
          </Text>
        </Pressable>
      }
    >
      <Input label="Full name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <Input
        label="Email (optional)"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input label="Mobile number" icon="call-outline" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} autoComplete="tel" />
      <Input label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 6 characters" />
      <Notice style={{ marginBottom: spacing.md }}>{error}</Notice>
      <Button title="Create account" onPress={submit} loading={busy} />
    </AuthShell>
  );
}
