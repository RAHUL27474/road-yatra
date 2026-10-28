import { Stack } from 'expo-router';
import { colors } from '../../theme';

/** Office (admin) screens. Each screen checks the admin role itself (AdminScreen). */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
