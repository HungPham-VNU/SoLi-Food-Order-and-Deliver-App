import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { History } from 'lucide-react-native';

interface RecentSearchItemProps {
  address: string;
  onPress: () => void;
}

export function RecentSearchItem({ address, onPress }: RecentSearchItemProps) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className="flex-row items-center gap-4 py-3 px-2 active:bg-surface-container rounded-lg"
    >
      <History size={20} color="#bfcaba" />
      <Text className="text-on-surface-variant text-sm">{address}</Text>
    </TouchableOpacity>
  );
}
