import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  MapPin,
  CreditCard,
  Settings,
  ChevronRight,
  Pencil,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/src/lib/auth-client';
import { authApi } from '@/src/features/auth';
import { useNotificationStore } from '@/src/store/notification-store';
import { notificationApi } from '@/src/features/notification/api';

type MenuItem = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
};

type MenuGroup = {
  key: string;
  items: MenuItem[];
};

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: session } = useSession();
  const { pushToken, setPushToken } = useNotificationStore();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleSignOut = () => {
    if (isSigningOut) return;

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          if (isSigningOut) return;

          setIsSigningOut(true);
          let didFinish = false;

          const finishOnce = () => {
            if (didFinish) return;
            didFinish = true;
            setPushToken(null);
            router.replace('/(auth)');
          };

          try {
            if (pushToken) {
              try {
                await notificationApi.deregisterPushToken(pushToken);
                setPushToken(null);
              } catch (err) {
                console.warn('[Profile] Failed to deregister push token:', err);
              }
            }

            await authApi.signOut({
              fetchOptions: {
                onSuccess: finishOnce,
              },
            });
          } catch (err) {
            console.error('[Profile] Failed to sign out:', err);
          } finally {
            finishOnce();
            setIsSigningOut(false);
          }
        },
      },
    ]);
  };

  const menuGroups: MenuGroup[] = [
    {
      key: 'account',
      items: [
        {
          icon: User,
          label: 'Personal Information',
          onPress: () => router.push('/(customer)/edit-profile' as any),
        },
        {
          icon: MapPin,
          label: 'Saved Addresses',
          onPress: () => router.push('/(customer)/address-selection'),
        },
        {
          icon: CreditCard,
          label: 'Payment Methods',
          onPress: () => {},
        },
      ],
    },
    {
      key: 'support',
      items: [
        {
          icon: Settings,
          label: 'Settings',
          onPress: () => router.push('/(customer)/settings' as any),
        },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-16 flex-row items-center bg-surface px-4 border-b border-outline-variant/40">
        <View className="w-10" />
        <Text className="flex-1 text-center font-jakarta-sans text-lg font-bold text-primary-container">
          Profile
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 24,
          paddingTop: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar section */}
        <View className="items-center px-6 mb-8">
          <View className="relative mb-4">
            <View
              className="w-28 h-28 rounded-full bg-surface-container-lowest items-center justify-center"
              style={{ borderWidth: 4, borderColor: '#a3f69c' }}
            >
              <User size={52} color="#00490e" />
            </View>
            <TouchableOpacity
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary-container items-center justify-center"
              style={{ elevation: 4 }}
              activeOpacity={0.8}
              accessibilityLabel="Edit profile photo"
            >
              <Pencil size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <Text className="font-jakarta-sans text-2xl font-extrabold tracking-tight text-on-surface">
            {session?.user.name || 'User'}
          </Text>
          <Text className="mt-1 font-inter text-sm text-on-surface-variant">
            {session?.user.email || ''}
          </Text>
        </View>

        {/* Menu groups */}
        <View className="px-4 gap-3">
          {menuGroups.map((group) => (
            <View
              key={group.key}
              className="overflow-hidden rounded-3xl bg-surface-container-lowest"
              style={{
                shadowColor: '#1a1c1c',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              {group.items.map((item, index) => (
                <React.Fragment key={item.label}>
                  {index > 0 && (
                    <View className="mx-5 h-px bg-surface-container" />
                  )}
                  <TouchableOpacity
                    onPress={item.onPress}
                    className="flex-row items-center justify-between p-5 active:bg-surface-container-low"
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <View className="flex-row items-center gap-4">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-container">
                        <item.icon size={20} color="#00490e" />
                      </View>
                      <Text className="font-inter text-base font-semibold text-on-surface">
                        {item.label}
                      </Text>
                    </View>
                    <ChevronRight size={20} color="#707a6c" />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Log Out — fixed at bottom */}
      <View
        className="px-4 border-t border-outline-variant/40 bg-surface"
        style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 12 }}
      >
        <TouchableOpacity
          onPress={handleSignOut}
          disabled={isSigningOut}
          className="w-full items-center rounded-2xl bg-error-container/20 py-4 disabled:opacity-60"
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Text className="font-jakarta-sans text-base font-bold text-error">
            {isSigningOut ? 'Logging Out...' : 'Log Out'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
