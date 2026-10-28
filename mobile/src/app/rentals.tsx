import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Quote, RentalRequest } from '../api';
import { fmtDateShort, fmtTime, inr, RENTAL_TYPE, VEHICLE_TYPE } from '../format';
import { VehicleArt } from '../illustrations';
import { useQuote, useRentalRequest } from '../rental';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../theme';
import { amenityIcon, Button, EmptyState, ErrorBanner, Header, HeaderButton, IonName, Row, Screen, Skeleton } from '../ui';

export default function RentalResults() {
  const req = useRentalRequest();
  const { data, error, reload } = useQuote(req);
  const [refreshing, setRefreshing] = useState(false);
  const route = req.dropCity ? `${req.pickupCity} → ${req.dropCity}` : req.pickupCity;
  const modify = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const header = (
    <Header
      title={route}
      subtitle={`${RENTAL_TYPE[req.rentalType] ?? 'Hire'} · ${fmtDateShort(req.startAt)}, ${fmtTime(req.startAt)}`}
      right={<HeaderButton icon="create-outline" label="Modify" onPress={modify} accessibilityLabel="Modify search" />}
    />
  );

  if (!data)
    return (
      <Screen>
        {header}
        {error ? (
          <View style={{ padding: spacing.lg }}>
            <ErrorBanner message={error} onRetry={reload} />
          </View>
        ) : (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Skeleton height={56} r={12} />
            {[0, 1, 2].map((i) => (
              <QuoteSkeleton key={i} />
            ))}
          </View>
        )}
      </Screen>
    );

  const available = data.results.filter((q) => q.available).length;

  return (
    <Screen>
      {header}
      <View style={st.planBar}>
        <PlanItem icon="calendar-outline" text={`${fmtDateShort(req.startAt)} · ${fmtTime(req.startAt)}`} />
        {req.returnAt ? <PlanItem icon="return-down-back-outline" text={`Back ${fmtDateShort(req.returnAt)}`} /> : null}
        <PlanItem icon="speedometer-outline" text={`~${data.plan.estimatedKm} km`} />
        <PlanItem icon="sunny-outline" text={`${data.plan.days} day${data.plan.days > 1 ? 's' : ''}`} />
      </View>
      <FlatList
        data={data.results}
        keyExtractor={(q) => q.vehicle.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, flexGrow: 1, gap: spacing.md }}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <ErrorBanner message={error} onRetry={reload} />
            {data.results.length ? (
              <Text style={type('xs', 'semibold', colors.textMuted)}>
                {available} of {data.results.length} vehicle{data.results.length === 1 ? '' : 's'} available · prices include GST
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            art="noVehicles"
            title="No vehicles available"
            text="Please try a different date or time, or call us and we will help you plan the trip."
            action={<Button title="Change search" variant="outline" icon="search" onPress={modify} />}
          />
        }
        renderItem={({ item }) => <QuoteCard quote={item} req={req} />}
      />
    </Screen>
  );
}

function PlanItem({ icon, text }: { icon: IonName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <Ionicons name={icon} size={14} color={colors.brand} />
      <Text style={[type('xs', 'semibold'), tabular]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function QuoteCard({ quote, req }: { quote: Quote; req: RentalRequest }) {
  const v = quote.vehicle;
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };
  const select = () => router.push({ pathname: '/passenger', params: { kind: 'RENTAL', vehicleId: v.id, ...req } });
  return (
    <View style={[st.card, !quote.available && { opacity: 0.6 }]}>
      <Pressable
        onPress={quote.available ? select : undefined}
        disabled={!quote.available}
        android_ripple={{ color: colors.brandRipple }}
        style={({ pressed }) => [{ padding: spacing.lg }, pressed && { backgroundColor: colors.surface }]}
        accessibilityRole="button"
        accessibilityLabel={`${v.name}, ${inr(quote.totalAmount)}${quote.available ? '' : ', sold out'}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={st.art}>
            <VehicleArt type={v.type} width={104} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type('md', 'bold')} numberOfLines={1}>
              {v.name}
            </Text>
            <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
              {VEHICLE_TYPE[v.type]}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="people-outline" size={14} color={colors.textMuted} />
              <Text style={type('xs', 'semibold', colors.text)}>Up to {v.seats} passengers</Text>
            </View>
          </View>
        </View>
        {v.amenities.length ? (
          <View style={st.amenities}>
            {v.amenities.map((a) => (
              <View key={a} style={st.amenity}>
                <MaterialCommunityIcons name={amenityIcon(a)} size={14} color={colors.textMuted} />
                <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                  {a}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>

      <View style={st.foot}>
        <Pressable onPress={toggle} hitSlop={8} style={st.toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Text style={type('xs', 'bold', colors.brand)}>{open ? 'Hide fare details' : 'Fare details'}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.brand} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[type('xl', 'extrabold', quote.available ? colors.text : colors.textMuted), tabular]}>{inr(quote.totalAmount)}</Text>
          <Text style={[type('xs', 'regular', colors.textMuted), tabular]}>
            {quote.billableKm} km · incl. GST{quote.toll + quote.parking > 0 ? ' & tolls' : ''}
          </Text>
        </View>
        {quote.available ? (
          <Button title="Select" size="md" fullWidth={false} onPress={select} style={{ minWidth: 92 }} />
        ) : (
          <View style={st.soldOut}>
            <Text style={type('xs', 'bold', colors.danger)}>Sold out</Text>
          </View>
        )}
      </View>

      {open ? (
        <View style={st.breakdown}>
          <Row label={`Fare (${quote.billableKm} km)`} value={inr(quote.baseAmount)} />
          <Row label="GST" value={inr(quote.taxAmount)} />
          {quote.toll > 0 ? <Row label="Toll" value={inr(quote.toll)} /> : null}
          {quote.parking > 0 ? <Row label="Parking" value={inr(quote.parking)} /> : null}
          <View style={st.dash} />
          <Row label="Total" value={inr(quote.totalAmount)} bold />
          {quote.driverAllowance > 0 ? (
            <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 4 }]}>Fare includes driver allowance of {inr(quote.driverAllowance)}.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function QuoteSkeleton() {
  return (
    <View style={[st.card, { padding: spacing.lg, gap: spacing.md }]}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <Skeleton width={104} height={56} r={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="50%" height={12} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={80} height={14} />
        <Skeleton width={120} height={36} r={10} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  modify: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    minHeight: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  planBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadowSoft },
  art: { width: 116, height: 64, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 4, marginTop: spacing.md },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  soldOut: { backgroundColor: colors.dangerLight, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 32, justifyContent: 'center' },
  breakdown: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  dash: { height: 0, borderTopWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginVertical: spacing.xs },
});
