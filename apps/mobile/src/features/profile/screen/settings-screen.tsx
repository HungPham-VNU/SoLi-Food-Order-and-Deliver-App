import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  Globe,
  Shield,
  FileText,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { notificationApi } from '@/src/features/notification/api';
import {
  NotificationPreferenceResponse,
  NotificationType,
} from '@/src/features/notification/types';

// All order/payment notification types that map to the "Order Updates" toggle.
const ORDER_NOTIFICATION_TYPES: NotificationType[] = [
  'order_placed',
  'order_confirmed',
  'order_preparing',
  'order_ready_for_pickup',
  'order_picked_up',
  'order_delivering',
  'order_delivered',
  'order_cancelled',
  'order_refunded',
  'payment_confirmed',
  'payment_failed',
  'refund_initiated',
  'refund_completed',
];
const ORDER_TYPES_SET = new Set<NotificationType>(ORDER_NOTIFICATION_TYPES);

type ToggleItem = {
  kind: 'toggle';
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
};

type LinkItem = {
  kind: 'link';
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value?: string;
  onPress: () => void;
};

type SettingsItem = ToggleItem | LinkItem;

type SettingsGroup = {
  title: string;
  items: SettingsItem[];
};

function ToggleRow({ item, disabled }: { item: ToggleItem; disabled?: boolean }) {
  return (
    <View className="flex-row items-center justify-between p-5">
      <View className="flex-row items-center gap-4 flex-1 mr-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-container">
          <item.icon size={20} color="#00490e" />
        </View>
        <View className="flex-1">
          <Text className="font-inter text-base font-semibold text-on-surface">
            {item.label}
          </Text>
          {item.subtitle ? (
            <Text className="mt-0.5 font-inter text-xs text-on-surface-variant">
              {item.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <Switch
        value={item.value}
        onValueChange={item.onToggle}
        disabled={disabled}
        trackColor={{ false: '#bfcaba', true: '#a3f69c' }}
        thumbColor={item.value ? '#00490e' : '#707a6c'}
      />
    </View>
  );
}

function LinkRow({ item }: { item: LinkItem }) {
  return (
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
      <View className="flex-row items-center gap-2">
        {item.value ? (
          <Text className="font-inter text-sm text-on-surface-variant">
            {item.value}
          </Text>
        ) : null}
        <ChevronRight size={20} color="#707a6c" />
      </View>
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [prefs, setPrefs] = React.useState<NotificationPreferenceResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // Derived toggle values
  const pushEnabled = prefs?.pushEnabled ?? true;
  const orderUpdatesEnabled = prefs
    ? !ORDER_NOTIFICATION_TYPES.every((t) => prefs.mutedTypes.includes(t))
    : true;

  // Fetch preferences on mount
  React.useEffect(() => {
    notificationApi
      .getPreferences()
      .then(setPrefs)
      .catch(() => {
        // Use defaults silently — non-critical on load failure
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handlePushToggle = async (value: boolean) => {
    if (isSaving) return;
    const prev = prefs;
    setPrefs((p) => (p ? { ...p, pushEnabled: value } : null));
    setIsSaving(true);
    try {
      const updated = await notificationApi.updatePreferences({ pushEnabled: value });
      setPrefs(updated);
    } catch {
      setPrefs(prev);
      Alert.alert('Error', 'Failed to save notification settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrderUpdatesToggle = async (value: boolean) => {
    if (isSaving || !prefs) return;
    const prev = prefs;
    // Preserve any non-order muted types; add/remove all order types as a group
    const nonOrderMuted = prefs.mutedTypes.filter((t) => !ORDER_TYPES_SET.has(t));
    const newMuted = value ? nonOrderMuted : [...nonOrderMuted, ...ORDER_NOTIFICATION_TYPES];
    setPrefs({ ...prefs, mutedTypes: newMuted });
    setIsSaving(true);
    try {
      const updated = await notificationApi.updatePreferences({ mutedTypes: newMuted });
      setPrefs(updated);
    } catch {
      setPrefs(prev);
      Alert.alert('Error', 'Failed to save notification settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const switchesDisabled = isLoading || isSaving;

  const groups: SettingsGroup[] = [
    {
      title: 'Notifications',
      items: [
        {
          kind: 'toggle',
          icon: Bell,
          label: 'Push Notifications',
          value: pushEnabled,
          onToggle: handlePushToggle,
        },
        {
          kind: 'toggle',
          icon: Bell,
          label: 'Order Updates',
          subtitle: 'Get notified about your orders',
          value: orderUpdatesEnabled,
          onToggle: handleOrderUpdatesToggle,
        },
      ],
    },
    {
      title: 'General',
      items: [
        {
          kind: 'link',
          icon: Globe,
          label: 'Language',
          value: 'English',
          onPress: () => {},
        },
        {
          kind: 'link',
          icon: Shield,
          label: 'Privacy Policy',
          onPress: () => {},
        },
        {
          kind: 'link',
          icon: FileText,
          label: 'Terms of Service',
          onPress: () => {},
        },
        {
          kind: 'link',
          icon: Info,
          label: 'About UITFood',
          value: `v${appVersion}`,
          onPress: () => {},
        },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-16 flex-row items-center bg-surface px-4 border-b border-outline-variant/40">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container-low"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={24} color="#0d631b" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-jakarta-sans text-lg font-bold text-primary-container">
          Settings
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 32,
          paddingTop: 24,
          paddingHorizontal: 16,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View key={group.title}>
            <Text className="mb-2 px-1 font-jakarta-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              {group.title}
            </Text>
            <View
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
                  {item.kind === 'toggle' ? (
                    <ToggleRow item={item} disabled={switchesDisabled} />
                  ) : (
                    <LinkRow item={item} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
