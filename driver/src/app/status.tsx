import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Application, fileSource, fileUrl, getConfig } from '../api';
import { Access, useAuth } from '../auth';
import { fmtDate, fmtTime } from '../format';
import { colors, fonts, radius, space, Tone, tones } from '../theme';
import { Avatar, Badge, Button, callPhone, Card, confirm, Divider, Header, IconName, Ionicons, Notice, SectionTitle, showError, T } from '../ui';

/** Under review (PENDING), not approved (REJECTED), or status not loaded (offline). */
export default function ApplicationStatus() {
  const { user, application, access, refreshAccess, logout } = useAuth();
  const [support, setSupport] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    getConfig().then(
      (c) => setSupport(c.supportPhone),
      () => {},
    );
  }, []);

  /** Re-runs the routing; if approved, the guards move to the Duties tabs by themselves. */
  const check = useCallback(
    async (quiet = false) => {
      try {
        const now: Access | null = await refreshAccess();
        if (now === 'pending' || now === 'rejected') setCheckedAt(new Date());
      } catch (e) {
        if (!quiet) showError(e, 'Could not check status');
      }
    },
    [refreshAccess],
  );

  // Coming back to the app (e.g. after the approval SMS) re-checks the status.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check(true));
    return () => sub.remove();
  }, [check]);

  const onCheck = async () => {
    setChecking(true);
    await check();
    setChecking(false);
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await check();
    setRefreshing(false);
  };

  const askLogout = () => confirm('Log out?', 'You can log in again with your mobile number to see your application.', 'Log out', () => logout().catch(showError), true);

  const rejected = access === 'rejected';
  const pending = access === 'pending';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Road Yatra Driver"
        subtitle={user ? `Logged in as +91 ${user.phone}` : undefined}
        right={
          <Button title="Log out" icon="log-out-outline" variant="light" small onPress={askLogout} style={{ paddingHorizontal: space.md }} />
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.brand]} tintColor={colors.brand} />}
      >
        {pending || rejected ? (
          <>
            <Hero
              tone={rejected ? 'danger' : 'warning'}
              icon={rejected ? 'document-text-outline' : 'hourglass-outline'}
              badgeIcon={rejected ? 'close' : 'time'}
              title={rejected ? 'Application not approved' : 'Application under review'}
              subtitle={
                rejected
                  ? application?.reviewedAt
                    ? `Reviewed on ${fmtDate(application.reviewedAt)}`
                    : 'The office reviewed your application'
                  : application?.appliedAt
                    ? `Submitted on ${fmtDate(application.appliedAt)} at ${fmtTime(application.appliedAt)}`
                    : 'Submitted'
              }
            />

            {rejected ? (
              <Card style={st.reasonCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Ionicons name="alert-circle" size={22} color={colors.danger} />
                  <T v="overline" color="#B91C1C">
                    Reason from the office
                  </T>
                </View>
                <T v="h2" style={{ marginTop: space.sm }}>
                  {application?.rejectReason?.trim() || 'No reason was given. Please call the office to find out what to fix.'}
                </T>
                <T v="label" color={colors.textMuted} style={{ marginTop: space.md, fontFamily: fonts.medium }}>
                  Fix the details and send your application again. Photos you already uploaded are kept unless you replace them.
                </T>
                <Button title="Fix and re-apply" icon="create-outline" onPress={() => router.push('/apply')} style={{ marginTop: space.lg }} />
              </Card>
            ) : (
              <>
                <Progress />
                <Notice tone="brand" icon="chatbubble-ellipses-outline" text="We'll SMS you once the office approves your application." style={{ marginTop: space.lg }} />
              </>
            )}

            {application ? <Summary app={application} /> : null}

            <View style={{ gap: space.md, marginTop: space.xl }}>
              <Button title="Check status" icon="refresh" variant={rejected ? 'outline' : 'primary'} onPress={onCheck} loading={checking} />
              {checkedAt ? (
                <T v="caption" color={colors.textMuted} center>
                  {rejected ? 'Still not approved' : 'Still under review'} · checked at {fmtTime(checkedAt)}
                </T>
              ) : null}
              <Button title={support ? `Call office · ${support}` : 'Call office'} icon="call-outline" variant="outline" disabled={!support} onPress={() => support && callPhone(support)} />
            </View>
          </>
        ) : (
          <>
            <Hero tone="neutral" icon="cloud-offline-outline" badgeIcon="refresh" title="Couldn't load your status" subtitle="Check your internet connection and try again." />
            <View style={{ gap: space.md, marginTop: space.xl }}>
              <Button title="Try again" icon="refresh" onPress={onCheck} loading={checking} />
              {support ? <Button title={`Call office · ${support}`} icon="call-outline" variant="outline" onPress={() => callPhone(support)} /> : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Illustration-style status icon: soft rings, a big glyph and a small status badge. */
function Hero({ tone, icon, badgeIcon, title, subtitle }: { tone: Tone; icon: IconName; badgeIcon: IconName; title: string; subtitle: string }) {
  const t = tones[tone];
  const solid = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : tone === 'neutral' ? colors.textMuted : colors.brand;
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
      <View style={[st.ringOuter, { backgroundColor: t.bg }]}>
        <View style={[st.ringInner, { borderColor: t.bg }]}>
          <Ionicons name={icon} size={56} color={solid} />
        </View>
        <View style={[st.heroBadge, { backgroundColor: solid }]}>
          <Ionicons name={badgeIcon} size={20} color={colors.white} />
        </View>
      </View>
      <T v="title" center style={{ marginTop: space.lg }}>
        {title}
      </T>
      <T v="body" color={colors.textMuted} center style={{ marginTop: 4 }}>
        {subtitle}
      </T>
    </View>
  );
}

/** Submitted → Office review → Approved. */
function Progress() {
  const steps: { label: string; state: 'done' | 'current' | 'todo' }[] = [
    { label: 'Submitted', state: 'done' },
    { label: 'Office review', state: 'current' },
    { label: 'Approved', state: 'todo' },
  ];
  return (
    <Card style={{ flexDirection: 'row', paddingVertical: space.lg }}>
      {steps.map((s, i) => (
        <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
          {i > 0 ? <View style={[st.progLine, s.state !== 'todo' && { backgroundColor: colors.success }]} /> : null}
          <View
            style={[
              st.progDot,
              s.state === 'done' && { backgroundColor: colors.success, borderColor: colors.success },
              s.state === 'current' && { backgroundColor: colors.warningLight, borderColor: colors.warning },
            ]}
          >
            <Ionicons name={s.state === 'done' ? 'checkmark' : s.state === 'current' ? 'time-outline' : 'ellipse-outline'} size={16} color={s.state === 'done' ? colors.white : s.state === 'current' ? colors.warning : colors.textMuted} />
          </View>
          <T v="caption" color={s.state === 'todo' ? colors.textMuted : colors.text} style={{ marginTop: 6, fontFamily: s.state === 'current' ? fonts.bold : fonts.medium }}>
            {s.label}
          </T>
        </View>
      ))}
    </Card>
  );
}

/** What the applicant sent. */
function Summary({ app }: { app: Application }) {
  const licence = fileSource(app.licencePhotoUrl);
  return (
    <>
      <SectionTitle title="Your application" right={<Badge label={app.status === 'REJECTED' ? 'Not approved' : 'Under review'} tone={app.status === 'REJECTED' ? 'danger' : 'warning'} />} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Avatar name={app.name} uri={fileUrl(app.photoUrl)} size={72} />
          <View style={{ flex: 1 }}>
            <T v="h2" numberOfLines={2}>
              {app.name}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Ionicons name="call-outline" size={16} color={colors.textMuted} />
              <T v="bodyStrong" color={colors.textMuted}>
                +91 {app.phone}
              </T>
            </View>
          </View>
        </View>
        <Divider style={{ marginVertical: space.lg }} />
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <View style={{ flex: 1, gap: space.md }}>
            <View>
              <T v="caption" color={colors.textMuted}>
                Licence no.
              </T>
              <T numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.mono, fontWeight: '700', fontSize: 17, color: colors.text, letterSpacing: 1, marginTop: 2 }}>
                {app.licenceNo ?? '—'}
              </T>
            </View>
            <View>
              <T v="caption" color={colors.textMuted}>
                Valid till
              </T>
              <T v="bodyStrong" style={{ marginTop: 2 }}>
                {app.licenceExpiry ? fmtDate(app.licenceExpiry) : '—'}
              </T>
            </View>
          </View>
          {licence ? <Image source={licence} style={st.licenceThumb} resizeMode="cover" accessibilityLabel="Licence photo" /> : null}
        </View>
      </Card>
    </>
  );
}

const st = StyleSheet.create({
  ringOuter: { width: 152, height: 152, borderRadius: 76, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.white, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  heroBadge: { position: 'absolute', right: 14, bottom: 14, width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  reasonCard: { borderColor: colors.danger, borderWidth: 1.5, backgroundColor: '#FFF7F7' },
  progLine: { position: 'absolute', top: 15, left: '-50%', right: '50%', height: 2, backgroundColor: colors.border },
  progDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  licenceThumb: { width: 112, height: 72, borderRadius: radius.input, backgroundColor: colors.border },
});
