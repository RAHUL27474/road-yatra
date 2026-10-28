import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Messages, useAdmin } from '../../admin/api';
import { AdminScreen, Panel, Pill } from '../../admin/components';
import { fmtDateShort, fmtTime } from '../../format';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { EmptyState, ErrorBanner, Notice, SegmentedControl, SkeletonList, Tone } from '../../ui';

const STATUS_TONE: Record<string, Tone> = {
  SENT: 'success',
  FAILED: 'danger',
  LOGGED: 'neutral',
};

export default function AdminMessages() {
  const { data, error, refreshing, refresh, reload } = useAdmin<Messages>('/api/admin/messages');
  const [tab, setTab] = useState<'log' | 'templates'>('log');
  const missing = (data?.templates ?? []).filter((t) => !t.name).length;

  const header = data ? (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <ErrorBanner message={error} onRetry={reload} />
      <Notice tone={data.connected ? 'success' : 'warning'} icon={data.connected ? 'logo-whatsapp' : 'warning-outline'}>
        {data.connected
          ? `WhatsApp Business is connected.${missing ? ` ${missing} template(s) still need a name in the server settings.` : ''}`
          : 'WhatsApp is not connected yet: messages are only recorded here. Add the WhatsApp keys on the server to start sending.'}
      </Notice>
      <SegmentedControl
        options={[
          {
            key: 'log',
            label: `Messages (${data.messages.length})`,
            icon: 'chatbubbles-outline',
          },
          {
            key: 'templates',
            label: 'Templates',
            icon: 'document-text-outline',
          },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  ) : null;

  return (
    <AdminScreen title="WhatsApp log" subtitle="Messages sent to passengers and drivers">
      {!data ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={reload} />
          <SkeletonList count={4} style={{ padding: 0 }} />
        </View>
      ) : tab === 'log' ? (
        <FlatList
          data={data.messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.sm,
            flexGrow: 1,
          }}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No messages yet" />}
          renderItem={({ item: m }) => (
            <View style={st.msg}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <MaterialCommunityIcons
                  name={m.channel === 'SMS' ? 'message-text-outline' : 'whatsapp'}
                  size={18}
                  color={m.channel === 'SMS' ? colors.brand : '#1FAF54'}
                />
                <Text style={[type('sm', 'bold'), tabular, { flex: 1 }]} numberOfLines={1}>
                  {m.to} · {m.event.replace(/_/g, ' ').toLowerCase()}
                </Text>
                <Pill label={m.status} tone={STATUS_TONE[m.status] ?? 'neutral'} />
              </View>
              <Text style={[type('sm', 'regular', colors.text), { marginTop: 6 }]}>{m.body}</Text>
              {m.error ? <Text style={[type('xs', 'medium', colors.danger), { marginTop: 4 }]}>{m.error}</Text> : null}
              <Text style={[type('xs', 'regular', colors.textSubtle), { marginTop: 4 }]}>
                {fmtDateShort(m.createdAt)} {fmtTime(m.createdAt)}
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={data.templates}
          keyExtractor={(t) => t.event}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={header}
          renderItem={({ item: t }) => (
            <Panel>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Text style={[type('sm', 'bold'), { flex: 1 }]}>{t.event.replace(/_/g, ' ')}</Text>
                <Pill label={t.name ? 'Ready' : 'Missing'} tone={t.name ? 'success' : 'warning'} />
              </View>
              <Text style={type('xs', 'regular', colors.textMuted)}>
                To {t.to} · {t.category}
                {t.name ? ` · ${t.name}` : ''}
              </Text>
              {t.vars.length ? (
                <Text style={[type('xs', 'medium', colors.textMuted), { marginTop: 4 }]}>{t.vars.map((v, i) => `{{${i + 1}}} ${v}`).join('  ')}</Text>
              ) : null}
            </Panel>
          )}
        />
      )}
    </AdminScreen>
  );
}

const st = StyleSheet.create({
  msg: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    ...shadowSoft,
  },
});
