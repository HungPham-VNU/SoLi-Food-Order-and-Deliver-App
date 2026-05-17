import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Menu, ChevronDown, User as UserIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAddressStore } from '@/src/features/location';
import { useSession } from '@/src/lib/auth-client';
import { NotificationBell } from '@/src/features/notification';

interface HomeTopBarProps {
  insetsTop: number;
}

export function HomeTopBar({ insetsTop }: HomeTopBarProps) {
  const router = useRouter();
  const { selectedAddress } = useAddressStore();
  const { data: session } = useSession();

  const user = session?.user;
  const avatarUrl = user?.image;

  return (
    <View
      className="absolute top-0 w-full z-50 bg-surface-container-lowest/90 shadow-sm"
      style={{ paddingTop: Math.max(insetsTop, 12), paddingBottom: 12 }}
    >
      <View className="flex-row items-center px-6 gap-2 w-full max-w-md mx-auto">
        <TouchableOpacity 
          className="text-on-background p-2 -ml-2 rounded-full active:bg-surface-variant"
          onPress={() => router.push('/(customer)/(tabs)/profile')}
        >
          <Menu size={24} color="#1a1c1c" />
        </TouchableOpacity>

        <View className="flex-col items-start flex-1 ml-2">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-inter leading-none mb-0.5">
            Deliver to
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-1"
            onPress={() => router.push('/(customer)/address-selection')}
          >
            <Text 
              numberOfLines={1}
              className="font-jakarta-sans font-bold text-lg text-on-surface leading-tight"
            >
              {selectedAddress || 'Select address'}
            </Text>
            <ChevronDown size={18} color="#00490e" />
          </TouchableOpacity>
        </View>

        <NotificationBell color="#1a1c1c" />

        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-surface-container overflow-hidden ring-2 ring-primary/20 shadow-sm items-center justify-center"
          onPress={() => router.push('/(customer)/(tabs)/profile')}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              className="w-full h-full"
              contentFit="cover"
            />
          ) : (
            <UserIcon size={20} color="#40493d" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
