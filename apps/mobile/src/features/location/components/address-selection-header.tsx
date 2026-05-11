import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

interface AddressSelectionHeaderProps {
  onBack: () => void;
  insetsTop: number;
}

export function AddressSelectionHeader({ onBack, insetsTop }: AddressSelectionHeaderProps) {
  return (
    <View 
      className="bg-white/80 backdrop-blur-md absolute top-0 w-full z-50 flex-row items-center px-6 border-b border-surface-variant/20"
      style={{ paddingTop: Math.max(insetsTop, 16), paddingBottom: 16 }}
    >
      <TouchableOpacity 
        onPress={onBack}
        className="p-2 -ml-2 rounded-full active:bg-surface-variant"
      >
        <ArrowLeft size={24} color="#00490e" />
      </TouchableOpacity>
      <Text className="font-jakarta-sans font-bold text-lg text-primary ml-2">
        Delivery Address
      </Text>
    </View>
  );
}
