import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { fetchText, Report, useAdmin } from '../../admin/api';
import { AdminScreen, DateField, GroupLabel, HeaderAction, Panel, TwoCol } from '../../admin/components';
import { errorMessage } from '../../api';
import { inr } from '../../format';
import { colors, spacing, tabular, type } from '../../theme';
import { Button, Chip, EmptyState, ErrorBanner, Skeleton } from '../../ui';

const fmtCell = (v: string | number, money: boolean) => (money && typeof v === 'number' ? inr(v) : String(v));

export default function AdminReports() {
  const [type_, setType] = useState('daily');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = `type=${type_}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`;
  const { data, error, refreshing, refresh, reload } = useAdmin<Report>(`/api/admin/reports?${qs}`);
  const [sharing, setSharing] = useState(false);
  const shown = data && data.type === type_ ? data : null;

  const shareCsv = async () => {
    if (!data) return;
    setSharing(true);
    try {
      const csv = await fetchText(data.csvUrl);
      await Share.share({
        title: `${data.title} ${data.from} to ${data.to}.csv`,
        message: csv,
      });
    } catch (e) {
      Alert.alert('Could not export', errorMessage(e));
    } finally {
      setSharing(false);
    }
  };

  // Column widths: wider for the first (label) column.
  const width = (i: number) => (i === 0 ? 130 : 104);

  return (
    <AdminScreen
      title="Reports"
      subtitle={data ? `${data.from} to ${data.to}` : 'This month'}
      right={<HeaderAction icon="share-outline" label="Export CSV" onPress={shareCsv} />}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {Object.entries(data?.types ?? { daily: 'Daily sales' }).map(([k, label]) => (
            <Chip key={k} label={label} selected={type_ === k} onPress={() => setType(k)} />
          ))}
        </ScrollView>
        <Panel style={{ marginTop: spacing.md, paddingBottom: 0 }}>
          <TwoCol>
            <DateField label="From" value={from || data?.from || ''} onChange={setFrom} allowClear={false} />
            <DateField label="To" value={to || data?.to || ''} onChange={setTo} allowClear={false} />
          </TwoCol>
        </Panel>
        <ErrorBanner message={error} onRetry={reload} style={{ marginTop: spacing.md }} />

        {!shown ? (
          <Skeleton height={260} r={14} style={{ marginTop: spacing.md }} />
        ) : (
          <>
            <GroupLabel>{shown.title}</GroupLabel>
            {shown.note ? (
              <Text style={[type('xs', 'regular', colors.textMuted), { marginBottom: spacing.sm, marginHorizontal: spacing.xs }]}>{shown.note}</Text>
            ) : null}
            {shown.rows.length === 0 ? (
              <EmptyState
                icon="bar-chart-outline"
                title="No data for these dates"
                text="Pick another date range or report."
                style={{ paddingVertical: spacing.xl }}
              />
            ) : (
              <Panel flush>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={[st.tr, st.th]}>
                      {shown.columns.map((c, i) => (
                        <Text key={c} style={[st.cell, { width: width(i) }, type('xs', 'bold', colors.textMuted), i > 0 && st.right]} numberOfLines={2}>
                          {c}
                        </Text>
                      ))}
                    </View>
                    {shown.rows.map((row, r) => (
                      <View key={r} style={[st.tr, r % 2 === 1 && { backgroundColor: colors.surface }]}>
                        {row.map((v, i) => (
                          <Text
                            key={i}
                            style={[st.cell, { width: width(i) }, type('sm', i === 0 ? 'semibold' : 'medium'), tabular, i > 0 && st.right]}
                            numberOfLines={2}
                          >
                            {fmtCell(v, shown.moneyColumns[i])}
                          </Text>
                        ))}
                      </View>
                    ))}
                    {shown.totals ? (
                      <View style={[st.tr, st.total]}>
                        {shown.totals.map((v, i) => (
                          <Text key={i} style={[st.cell, { width: width(i) }, type('sm', 'extrabold'), tabular, i > 0 && st.right]} numberOfLines={1}>
                            {fmtCell(v, shown.moneyColumns[i])}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </ScrollView>
              </Panel>
            )}
            <Button title="Export as CSV" icon="download-outline" variant="outline" loading={sharing} onPress={shareCsv} style={{ marginTop: spacing.lg }} />
            <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center', marginTop: spacing.sm }]}>
              Shares the CSV text to WhatsApp, email or Drive. Scroll the table sideways for more columns.
            </Text>
          </>
        )}
      </ScrollView>
    </AdminScreen>
  );
}

const st = StyleSheet.create({
  tr: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  th: { backgroundColor: colors.background },
  total: { backgroundColor: colors.brandLight, borderBottomWidth: 0 },
  cell: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  right: { textAlign: 'right' },
});
