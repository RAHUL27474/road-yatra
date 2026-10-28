import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feedback, useAdmin } from '../../admin/api';
import { AdminScreen, ContactButtons, Kpi, Panel, Pill, runAction } from '../../admin/components';
import { fmtDateShort, fmtTime } from '../../format';
import { colors, spacing, type } from '../../theme';
import { EmptyState, ErrorBanner, SegmentedControl, SkeletonList } from '../../ui';

function Stars({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${n} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={14} color={i <= n ? colors.gold : colors.textSubtle} />
      ))}
    </View>
  );
}

export default function AdminFeedback() {
  const { data, error, refreshing, refresh, reload } = useAdmin<Feedback>('/api/admin/feedback');
  const [tab, setTab] = useState<'feedback' | 'ratings'>('feedback');

  return (
    <AdminScreen title="Feedback" subtitle={data ? `${data.open} new · ${data.total} total` : 'Loading…'}>
      {!data ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={reload} />
          <SkeletonList count={4} style={{ padding: 0 }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xxxl,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} />}
        >
          <ErrorBanner message={error} onRetry={reload} style={{ marginBottom: spacing.md }} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Kpi label="Average" value={data.average != null ? `${data.average.toFixed(1)} ★` : '—'} icon="star-outline" tone="warning" style={{ flex: 1 }} />
            <Kpi label="New" value={String(data.open)} icon="bell-outline" tone="danger" style={{ flex: 1 }} />
            <Kpi label="Trip ratings" value={String(data.ratings.length)} icon="car-outline" style={{ flex: 1 }} />
          </View>
          <SegmentedControl
            style={{ marginVertical: spacing.lg }}
            options={[
              {
                key: 'feedback',
                label: 'Feedback',
                icon: 'chatbubble-ellipses-outline',
              },
              { key: 'ratings', label: 'Trip ratings', icon: 'star-outline' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'feedback' ? (
            data.feedback.length === 0 ? (
              <EmptyState icon="chatbubble-ellipses-outline" title="No feedback yet" />
            ) : (
              data.feedback.map((f) => (
                <Panel
                  key={f.id}
                  style={[
                    { marginBottom: spacing.md },
                    !f.handled && {
                      borderLeftWidth: 4,
                      borderLeftColor: colors.accent,
                    },
                  ]}
                >
                  <View style={st.head}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={type('sm', 'bold')} numberOfLines={1}>
                        {f.name || 'Anonymous'}
                      </Text>
                      <Text style={type('xs', 'regular', colors.textMuted)}>
                        {fmtDateShort(f.createdAt)} {fmtTime(f.createdAt)} · {f.source.toLowerCase()}
                        {f.bookingCode ? ` · ${f.bookingCode}` : ''}
                      </Text>
                    </View>
                    <Stars n={f.rating} />
                  </View>
                  {f.comment ? <Text style={[type('sm', 'regular'), { marginTop: spacing.sm }]}>{f.comment}</Text> : null}
                  <View style={[st.head, { marginTop: spacing.md }]}>
                    {f.phone ? <ContactButtons phone={f.phone} /> : null}
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={async () => {
                        if (await runAction('markFeedbackHandled', { id: f.id })) reload();
                      }}
                      style={({ pressed }) => [st.mark, f.handled && { backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons name={f.handled ? 'arrow-undo-outline' : 'checkmark-done'} size={16} color={f.handled ? colors.textMuted : colors.white} />
                      <Text style={type('xs', 'bold', f.handled ? colors.textMuted : colors.white)}>{f.handled ? 'Mark as new' : 'Mark seen'}</Text>
                    </Pressable>
                  </View>
                </Panel>
              ))
            )
          ) : data.ratings.length === 0 ? (
            <EmptyState icon="star-outline" title="No trip ratings yet" />
          ) : (
            data.ratings.map((r) => (
              <Pressable key={r.bookingId} onPress={() => router.push(`/admin/bookings/${r.bookingId}`)}>
                <Panel style={{ marginBottom: spacing.md }}>
                  <View style={st.head}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={type('sm', 'bold')} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                        {r.code} · {r.passengerName}
                        {r.driverName ? ` · driver ${r.driverName}` : ''} · {fmtDateShort(r.ratedAt)}
                      </Text>
                    </View>
                    <Stars n={r.rating} />
                  </View>
                  {r.comment ? <Text style={[type('sm', 'regular'), { marginTop: spacing.sm }]}>{r.comment}</Text> : null}
                  {r.rating <= 2 ? <Pill label="Low rating: call the passenger" tone="danger" /> : null}
                </Panel>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </AdminScreen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    minHeight: 34,
  },
});
