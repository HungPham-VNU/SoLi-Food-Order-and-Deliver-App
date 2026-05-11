import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Home, Briefcase, Edit2, LucideIcon } from 'lucide-react-native';

interface SavedAddressItemProps {
  type: 'home' | 'work' | 'other';
  label: string;
  address: string;
  onPress: () => void;
}

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  work: Briefcase,
  other: Home,
};

export function SavedAddressItem({ type, label, address, onPress }: SavedAddressItemProps) {
  const Icon = ICONS[type] || Home;

  return (
    <TouchableOpacity 
      onPress={onPress}
      className="bg-surface-container-lowest p-5 rounded-2xl flex-row items-start gap-4 shadow-sm active:bg-surface-container"
    >
      <View className="bg-surface-container p-3 rounded-full">
        <Icon size={24} color="#40493d" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="font-bold font-jakarta-sans text-on-surface">{label}</Text>
          <TouchableOpacity>
            <Edit2 size={18} color="#bfcaba" />
          </TouchableOpacity>
        </View>
        <Text className="text-sm text-on-surface-variant leading-relaxed">
          {address}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
