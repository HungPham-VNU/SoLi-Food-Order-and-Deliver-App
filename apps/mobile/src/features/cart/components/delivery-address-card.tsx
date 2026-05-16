import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Pencil } from 'lucide-react-native';

export interface DeliveryAddressOption {
  id: string;
  label: string;
  isDefault?: boolean;
  lines: string[];
  phone: string;
}

interface DeliveryAddressCardProps {
  address: DeliveryAddressOption;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}

export function DeliveryAddressCard({
  address,
  selected,
  onSelect,
  onEdit,
}: DeliveryAddressCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onSelect}
      className={
        selected
          ? 'bg-primary-fixed/10 border-2 border-primary/30 rounded-[20px]'
          : 'bg-surface-container-lowest border-2 border-transparent rounded-[20px]'
      }
    >
      <View className="p-5">
        <View className="flex-row justify-between items-start">
          <View className="flex-row items-start gap-4 flex-1">
            <View
              className={
                selected
                  ? 'mt-1 w-5 h-5 rounded-full border-2 border-primary items-center justify-center'
                  : 'mt-1 w-5 h-5 rounded-full border-2 border-outline-variant items-center justify-center'
              }
            >
              {selected ? (
                <View className="w-2.5 h-2.5 rounded-full bg-primary" />
              ) : null}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                <Text
                  className="text-on-surface text-base"
                  style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                >
                  {address.label}
                </Text>
                {address.isDefault ? (
                  <View className="bg-primary-fixed rounded-full px-2 py-0.5">
                    <Text
                      className="text-[10px]"
                      style={{ fontFamily: 'Inter_700Bold', color: '#002204' }}
                    >
                      DEFAULT
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                className="text-on-surface-variant text-sm leading-relaxed"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                {address.lines.join('\n')}
              </Text>
              <Text
                className="text-on-surface-variant text-xs mt-2"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Phone: {address.phone}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onEdit}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={18} color="#707a6c" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
