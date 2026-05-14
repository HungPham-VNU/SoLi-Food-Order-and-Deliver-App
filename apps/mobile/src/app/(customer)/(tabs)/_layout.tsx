import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import { Home, ReceiptText, User } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#0d631b';
const INACTIVE_COLOR = '#707a6c';
const TAB_BAR_BG = '#f8faf7';

type TabBarIconProps = {
  children: ReactNode;
  color: string;
  focused: boolean;
};

function TabBarIcon({ children, focused }: TabBarIconProps) {
  return (
    <View
      style={[
        styles.tabIcon,
        focused ? styles.tabIconFocused : styles.tabIconInactive,
      ]}
    >
      {children}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Dynamically adjust padding and height based on the device's safe area bottom inset.
  // Add a minimum padding for devices that don't have a bottom notch/bar.
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10);
  const baseHeight = Platform.OS === 'ios' ? 56 : 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopWidth: 1,
          borderTopColor: 'rgba(191,202,186,0.25)',
          elevation: 12,
          shadowColor: '#1a1c1c',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 24,
          height: baseHeight + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused}>
              <Home size={22} color={color} />
            </TabBarIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused}>
              <ReceiptText size={22} color={color} />
            </TabBarIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused}>
              <User size={22} color={color} />
            </TabBarIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tabIconFocused: {
    backgroundColor: 'rgba(13,99,27,0.12)',
  },
  tabIconInactive: {
    backgroundColor: 'transparent',
  },
});
