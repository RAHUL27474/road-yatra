import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../api';
import { useAuth } from '../auth';
import { colors, radius, shadowSoft, spacing, type } from '../theme';
import { Button, ErrorBanner, hapticSelect, Header, Input, Screen } from '../ui';

const LABELS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

/** One-screen feedback: tap the stars, optionally write a line, send. Works logged out too. */
export default function Feedback() {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!rating) return setError('Please tap the stars to rate us.');
    const digits = phone.replace(/\D/g, '').slice(-10);
    setBusy(true);
    setError(null);
    try {
      await api('/api/feedback', { body: { rating, comment: comment.trim(), name: name.trim(), phone: /^[6-9]\d{9}$/.test(digits) ? digits : '', source: 'APP' } });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Feedback" subtitle="Rate us in one tap" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          {sent ? (
            <View style={[st.card, { alignItems: 'center', paddingVertical: spacing.xxl }]}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
              <Text style={[type('lg', 'bold'), { marginTop: spacing.md }]}>Thank you for your feedback!</Text>
              <Text style={[type('sm', 'regular', colors.textMuted), { textAlign: 'center', marginTop: 4 }]}>It goes straight to our office. Jai Shree Shyam 🙏</Text>
              <Button title="Done" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
            </View>
          ) : (
            <>
              <View style={[st.card, { alignItems: 'center' }]}>
                <Text style={type('md', 'bold')}>How was your experience with us?</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => {
                        hapticSelect();
                        setRating(n);
                      }}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
                    >
                      <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={44} color={n <= rating ? '#F59E0B' : colors.textSubtle} />
                    </Pressable>
                  ))}
                </View>
                <Text style={[type('sm', 'semibold', '#B45309'), { marginTop: spacing.sm, minHeight: 20 }]}>{LABELS[rating]}</Text>
              </View>
              <View style={st.card}>
                <Input
                  label={rating && rating <= 3 ? 'What went wrong? (optional)' : "Anything you'd like to tell us? (optional)"}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={1000}
                  style={{ minHeight: 90, textAlignVertical: 'top' }}
                />
                <Input label="Name (optional)" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" />
                <Input label="Mobile (optional)" icon="call-outline" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} containerStyle={{ marginBottom: 0 }} />
              </View>
              <ErrorBanner message={error} />
              <Button title="Send feedback" icon="send" onPress={send} loading={busy} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, ...shadowSoft },
});
