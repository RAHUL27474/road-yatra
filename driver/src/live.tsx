import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import type { LiveLocation } from './api';
import { colors, space } from './theme';
import { Button, navigateToPoint, T } from './ui';

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 1 ? 'just now' : `${mins} min ago`;
};

/** "Ramesh is sharing live location · 2 min ago" with directions to where they are (before boarding). */
export function LiveLocationRow({ loc, name }: { loc: LiveLocation; name: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, padding: space.sm, borderRadius: 12, backgroundColor: colors.successLight }}>
      <Ionicons name="radio" size={18} color={colors.success} />
      <View style={{ flex: 1 }}>
        <T v="label" color={colors.success} numberOfLines={1}>
          {name} is sharing live location
        </T>
        <T v="label" color={colors.textMuted} numberOfLines={1}>
          Updated {ago(loc.at)}
        </T>
      </View>
      <Button small variant="success" icon="navigate" title="Go to them" onPress={() => navigateToPoint(loc)} />
    </View>
  );
}
