import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api, Earnings, errorMessage } from '../../api';
import { fmtDate, fmtTime, fmtYmd, inr, ymdIST } from '../../format';
import { colors, fonts, radius, space } from '../../theme';
import { Badge, Card, EmptyState, Header, Ionicons, Money, Notice, SectionTitle, Skeleton, T } from '../../ui';

const dayLabel = (ymd: string) => {
  const today = ymdIST(new Date());
  const yesterday = ymdIST(new Date(Date.now() - 86_400_000));
  return ymd === today ? 'Today' : ymd === yesterday ? 'Yesterday' : fmtYmd(ymd);
};

/** Cash the driver holds for the office, a day-by-day summary and the duties of the last 30 days. */
export default function CashAndHistory() {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Earnings>('/api/driver/earnings'));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Reload every time the tab is opened (cash changes during the day).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = data?.days.find((d) => d.date === ymdIST(new Date()));
  const month = data?.days.reduce((n, d) => ({ duties: n.duties + d.duties, passengers: n.passengers + d.passengers, km: n.km + d.km, cash: n.cash + d.cash }), {
    duties: 0,
    passengers: 0,
    km: 0,
    cash: 0,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Cash & history" subtitle="Last 30 days" overlap={56} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.brand]}
            tintColor={colors.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {/* Cash in hand: overlaps the header */}
        <Card style={[st.cashCard, data && data.cashInHand > 0 && { borderColor: colors.warning, borderWidth: 1.5 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={st.cashIcon}>
              <Ionicons name="wallet" size={28} color={data && data.cashInHand > 0 ? '#B45309' : colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="label" color={colors.textMuted}>
                Cash with you for the office
              </T>
              {data ? <Money amount={data.cashInHand} size={30} color={data.cashInHand > 0 ? colors.text : colors.success} /> : <Skeleton width={120} height={30} />}
            </View>
          </View>
          {data ? (
            <T v="label" color={colors.textMuted} style={{ marginTop: space.sm, fontFamily: fonts.medium }}>
              {data.cashInHand > 0
                ? `From ${data.cashInHandCount} booking${data.cashInHandCount === 1 ? '' : 's'}. Hand it over at the office — it clears here once they mark it received.`
                : 'Nothing to hand over. All cash you collected has been received by the office.'}
            </T>
          ) : null}
        </Card>

        {error ? <Notice tone="danger" text={`${error} Pull down to retry.`} style={{ marginTop: space.lg }} /> : null}

        {data ? (
          <View style={st.stats}>
            <Stat label="Today" value={`${today?.duties ?? 0}`} unit={`dut${today?.duties === 1 ? 'y' : 'ies'}`} sub={inr(today?.cash ?? 0) + ' cash'} />
            <Stat label="30 days" value={`${month?.duties ?? 0}`} unit="duties" sub={`${month?.passengers ?? 0} passengers`} />
            <Stat label="Distance" value={`${month?.km ?? 0}`} unit="km" sub={inr(month?.cash ?? 0) + ' cash'} />
          </View>
        ) : null}

        {data && data.days.length ? (
          <>
            <SectionTitle title="Day by day" />
            <Card padded={false}>
              {data.days.map((d, i) => (
                <View key={d.date} style={[st.dayRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{dayLabel(d.date)}</T>
                    <T v="caption" color={colors.textMuted}>
                      {d.duties} dut{d.duties === 1 ? 'y' : 'ies'} · {d.passengers} passengers · {d.km} km
                    </T>
                  </View>
                  <Money amount={d.cash} size={18} color={d.cash > 0 ? colors.text : colors.textMuted} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionTitle title="Completed duties" />
        {!data && !error ? (
          <Card style={{ gap: space.md }}>
            <Skeleton width="70%" height={18} />
            <Skeleton width="45%" height={14} />
          </Card>
        ) : data && !data.history.length ? (
          <Card>
            <EmptyState icon="time-outline" title="No completed duties yet" subtitle="Trips you finish will be listed here for 30 days." />
          </Card>
        ) : (
          <View style={{ gap: space.md }}>
            {data?.history.map((h) => (
              <Card key={h.kind + h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="h2" numberOfLines={1}>
                    {h.title}
                  </T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <Badge label={h.kind === 'TRIP' ? 'Shared' : 'Full cab'} tone={h.kind === 'TRIP' ? 'brand' : 'accent'} />
                    <T v="caption" color={colors.textMuted}>
                      {fmtDate(h.at)} · {fmtTime(h.at)}
                      {h.vehicleReg ? ` · ${h.vehicleReg}` : ''}
                    </T>
                  </View>
                  <T v="caption" color={colors.textMuted}>
                    {h.passengers} passenger{h.passengers === 1 ? '' : 's'}
                    {h.km != null ? ` · ${h.km} km` : ''}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="caption" color={colors.textMuted}>
                    Cash
                  </T>
                  <Money amount={h.cash} size={18} color={h.cash > 0 ? colors.text : colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, unit, sub }: { label: string; value: string; unit: string; sub: string }) {
  return (
    <View style={st.stat}>
      <T v="caption" color={colors.textMuted}>
        {label}
      </T>
      <T style={st.statNum} numberOfLines={1} adjustsFontSizeToFit>
        {value}{' '}
        <T v="label" color={colors.textMuted}>
          {unit}
        </T>
      </T>
      <T v="caption" color={colors.textMuted} numberOfLines={1}>
        {sub}
      </T>
    </View>
  );
}

const st = StyleSheet.create({
  cashCard: { marginTop: -56 },
  cashIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.warningLight, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 2 },
  statNum: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.text },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
