import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ColorValue, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth';
import { colors, fonts } from '../../theme';
import { hapticTap, type IonName } from '../../ui';

/** Tab icon with a soft pill behind it when the tab is active. */
function icon(on: IonName, off: IonName) {
  return function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return (
      <View
        style={{
          width: 56,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? colors.brandLight : 'transparent',
        }}
      >
        <Ionicons name={focused ? on : off} size={22} color={color} />
      </View>
    );
  };
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const bottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 },
        tabBarStyle: {
          height: 64 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: { minHeight: 48 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="bookings" options={{ title: 'My Bookings', tabBarIcon: icon('ticket', 'ticket-outline') }} />
      {/* Admins only: opens the office dashboard as its own stack, so Back returns here. */}
      <Tabs.Screen
        name="office"
        options={{ title: 'Office', tabBarIcon: icon('speedometer', 'speedometer-outline'), href: isAdmin ? undefined : null }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            hapticTap();
            router.push('/admin');
          },
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
