import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Tag, CheckCircle, X, ChevronRight } from 'lucide-react-native';
import { formatCurrency } from '@/src/lib/format-utils';

interface CheckoutPromoSectionProps {
  onApply: (code: string) => void;
  onClear: () => void;
  onBrowse?: () => void;
  isValidating?: boolean;
  appliedCode?: string | null;
  appliedDiscount?: number;
  error?: string | null;
}

export function CheckoutPromoSection({
  onApply,
  onClear,
  onBrowse,
  isValidating = false,
  appliedCode,
  appliedDiscount,
  error,
}: CheckoutPromoSectionProps) {
  const [promoCode, setPromoCode] = useState('');

  const isApplied = !!appliedCode;
  const isDisabled = isValidating || isApplied;

  const handleApply = () => {
    const trimmed = promoCode.trim();
    if (trimmed) onApply(trimmed);
  };

  const handleClear = () => {
    setPromoCode('');
    onClear();
  };

  return (
    <View className="gap-2">
      <View className="bg-surface-container-lowest rounded-2xl p-1.5 border border-outline-variant/15 flex-row items-center gap-2">
        <View className="flex-1 relative justify-center">
          <View className="absolute left-3 z-10">
            {isApplied ? (
              <CheckCircle size={18} color="#0d631b" />
            ) : (
              <Tag size={18} color="#40493d" />
            )}
          </View>
          <TextInput
            className="bg-surface-container-high rounded-xl py-2.5 pl-10 pr-3 text-sm text-on-surface"
            style={{ fontFamily: 'Inter_400Regular' }}
            placeholderTextColor="#40493d"
            placeholder="Promo code"
            autoCapitalize="characters"
            value={isApplied ? appliedCode! : promoCode}
            onChangeText={setPromoCode}
            editable={!isDisabled}
          />
        </View>

        {isApplied ? (
          <TouchableOpacity
            activeOpacity={0.7}
            className="px-3 py-2.5 rounded-xl bg-surface-container-high"
            onPress={handleClear}
          >
            <X size={18} color="#40493d" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            className={`px-4 py-2.5 rounded-xl ${
              promoCode.trim() && !isValidating
                ? 'bg-primary'
                : 'bg-surface-container-high'
            }`}
            onPress={handleApply}
            disabled={!promoCode.trim() || isValidating}
          >
            {isValidating ? (
              <ActivityIndicator size="small" color="#0d631b" />
            ) : (
              <Text
                className={`text-sm ${
                  promoCode.trim() ? 'text-on-primary' : 'text-on-surface'
                }`}
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                Apply
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {isApplied && appliedDiscount !== undefined && appliedDiscount > 0 && (
        <View className="flex-row items-center gap-1.5 px-1">
          <CheckCircle size={14} color="#0d631b" />
          <Text
            className="text-primary text-xs"
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            Code applied — saving {formatCurrency(appliedDiscount)}
          </Text>
        </View>
      )}

      {!isApplied && error && (
        <Text
          className="text-error text-xs px-1"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {error}
        </Text>
      )}

      {!isApplied && onBrowse && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBrowse}
          className="flex-row items-center justify-between px-1 py-0.5"
        >
          <Text
            className="text-primary text-xs"
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            Browse available deals
          </Text>
          <ChevronRight size={14} color="#0d631b" />
        </TouchableOpacity>
      )}
    </View>
  );
}
