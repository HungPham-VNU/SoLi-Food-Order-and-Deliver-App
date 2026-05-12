import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Heart,
  Flame,
  Minus,
  Plus,
  ShoppingBag,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/src/lib/format-utils';
import { MenuItemDetailScreenProps, ModifierGroup } from '../types';
import { useMenuItem, useMenuItemModifiers } from '../api/restaurant-api';

export function MenuItemDetailScreen({
  itemId,
  onBack,
  onFavoriteToggle,
  onAddToCart,
}: MenuItemDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);

  const { data: item, isLoading: isLoadingItem } = useMenuItem(itemId);
  const { data: modifierGroups, isLoading: isLoadingModifiers } = useMenuItemModifiers(itemId);

  // Sync favorited state from server
  React.useEffect(() => {
    if (item) {
      // setIsFavorited(!!item.isFavorited); // Assuming API might have this
    }
  }, [item]);

  const toggleOption = (optionId: string, group: ModifierGroup) => {
    setSelectedOptionIds(prev => {
      const isSelected = prev.includes(optionId);
      
      // If it's a radio group (maxSelections = 1)
      if (group.maxSelections === 1) {
        if (isSelected) {
          // If optional, allow deselection
          if (group.minSelections === 0) {
            return prev.filter(id => id !== optionId);
          }
          return prev;
        }
        const otherOptionsInGroup = group.options.map(o => o.id);
        const filtered = prev.filter(id => !otherOptionsInGroup.includes(id));
        return [...filtered, optionId];
      }
      
      // If it's a checkbox group
      if (isSelected) {
        return prev.filter(id => id !== optionId);
      } else {
        // Check if we hit max selections
        const optionsInGroupCount = prev.filter(id => group.options.some(o => o.id === id)).length;
        if (optionsInGroupCount < group.maxSelections) {
          return [...prev, optionId];
        }
        return prev;
      }
    });
  };

  const areRequiredModifiersSelected = useMemo(() => {
    if (!modifierGroups) return true;
    return modifierGroups.every(group => {
      if (group.minSelections === 0) return true;
      const selectedInGroupCount = selectedOptionIds.filter(id => 
        group.options.some(o => o.id === id)
      ).length;
      return selectedInGroupCount >= group.minSelections;
    });
  }, [modifierGroups, selectedOptionIds]);

  const calculateTotal = () => {
    if (!item) return 0;
    const optionsTotal = selectedOptionIds.reduce((acc, id) => {
      const option = modifierGroups?.flatMap(g => g.options).find(o => o.id === id);
      return acc + (option?.price || 0);
    }, 0);
    return (item.price + optionsTotal) * quantity;
  };

  const handleAddToCart = () => {
    if (!areRequiredModifiersSelected) return;
    
    const selections: Record<string, string[]> = {};
    modifierGroups?.forEach(group => {
      const selectedInGroup = selectedOptionIds.filter(id => 
        group.options.some(o => o.id === id)
      );
      if (selectedInGroup.length > 0) {
        selections[group.id] = selectedInGroup;
      }
    });
    
    onAddToCart?.(itemId, quantity, selections);
  };

  const isLoading = isLoadingItem || isLoadingModifiers;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#0d631b" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-on-surface">Item not found</Text>
        <TouchableOpacity onPress={onBack} className="mt-4">
          <Text className="text-primary">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background font-inter text-on-surface">
      <StatusBar barStyle="dark-content" />
      
      {/* Top App Bar */}
      <View 
        className="absolute top-0 w-full z-50 flex-row items-center justify-between px-6 bg-surface/80 backdrop-blur-xl"
        style={{ paddingTop: insets.top, height: insets.top + 60 }}
      >
        <TouchableOpacity 
          onPress={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:scale-95"
        >
          <ArrowLeft size={24} color="#1a1c1c" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => {
            setIsFavorited(!isFavorited);
            onFavoriteToggle?.(itemId);
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:scale-95"
        >
          <Heart 
            size={24} 
            color="#1a1c1c" 
            fill={isFavorited ? "#1a1c1c" : "none"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ 
          paddingTop: insets.top + 70,
          paddingBottom: insets.bottom + 100 
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        {item.imageUrl && (
          <View className="px-4 mb-8">
            <View className="w-full h-80 rounded-3xl overflow-hidden shadow-sm bg-surface-container-low border border-surface-variant/20">
              <Image 
                source={{ uri: item.imageUrl }}
                className="w-full h-full"
                contentFit="cover"
                transition={200}
              />
            </View>
          </View>
        )}

        {/* Product Info */}
        <View className="px-6 flex-col gap-6">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-4">
              <Text className="font-jakarta-sans font-bold text-3xl text-on-surface tracking-tight mb-2">
                {item.name}
              </Text>
              {item.tags?.includes('popular') && (
                <View className="flex-row">
                  <View className="flex-row items-center gap-1 bg-surface-container-high px-2 py-1 rounded-md">
                    <Flame size={14} color="#8b5000" fill="#8b5000" />
                    <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Popular
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <Text className="font-jakarta-sans font-extrabold text-2xl text-secondary">
              {formatCurrency(item.price)}
            </Text>
          </View>

          <Text className="font-inter text-base text-on-surface-variant leading-6">
            {item.description}
          </Text>

          <View className="h-[1px] bg-surface-container my-2" />

          {/* Quantity Selection */}
          <View className="flex-row justify-between items-center bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-outline-variant/15">
            <Text className="font-jakarta-sans font-semibold text-lg text-on-surface">Quantity</Text>
            <View className="flex-row items-center gap-4 bg-surface-container-high rounded-full px-2 py-1">
              <TouchableOpacity 
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 items-center justify-center rounded-full active:bg-surface-container-highest"
              >
                <Minus size={20} color="#0d631b" />
              </TouchableOpacity>
              <Text className="font-jakarta-sans font-bold text-lg w-6 text-center">{quantity}</Text>
              <TouchableOpacity 
                onPress={() => setQuantity(quantity + 1)}
                className="w-10 h-10 items-center justify-center rounded-full active:bg-surface-container-highest"
              >
                <Plus size={20} color="#0d631b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Modifier Groups */}
          {modifierGroups?.map((group) => (
            <View key={group.id} className="mt-4">
              <View className="flex-row justify-between items-end mb-4">
                <Text className="font-jakarta-sans font-semibold text-lg">{group.name}</Text>
                <Text className="font-inter text-xs text-on-surface-variant">
                  {group.minSelections > 0 ? `Required • Select up to ${group.maxSelections}` : `Optional • Select up to ${group.maxSelections}`}
                </Text>
              </View>
              <View className="flex-col gap-3">
                {group.options.map((option) => {
                  const isSelected = selectedOptionIds.includes(option.id);
                  return (
                    <TouchableOpacity 
                      key={option.id}
                      onPress={() => toggleOption(option.id, group)}
                      disabled={!option.isAvailable}
                      className={`flex-row items-center justify-between bg-surface-container-lowest p-4 rounded-2xl border ${
                        isSelected ? 'border-primary bg-primary-fixed-dim/5' : 'border-outline-variant/15'
                      } ${!option.isAvailable ? 'opacity-50' : ''} active:bg-surface-container-low`}
                    >
                      <View className="flex-1">
                        <Text className={`font-inter font-medium text-sm ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                          {option.name}
                        </Text>
                        {!option.isAvailable && (
                          <Text className="text-xs text-error font-medium">Sold Out</Text>
                        )}
                      </View>
                      <View className="flex-row items-center gap-3">
                        {option.price > 0 && (
                          <Text className="font-inter text-secondary text-xs font-bold">+{formatCurrency(option.price)}</Text>
                        )}
                        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                          isSelected ? 'border-primary bg-primary' : 'border-outline-variant'
                        }`}>
                          {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-white" />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View 
        className="absolute bottom-0 left-0 w-full p-4 bg-surface/80 backdrop-blur-xl border-t-0 shadow-[0_-8px_32px_rgba(26,28,28,0.08)] z-50 rounded-t-xl sm:px-6"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <TouchableOpacity 
          onPress={handleAddToCart}
          disabled={!areRequiredModifiersSelected}
          className={`w-full flex-row items-center justify-center gap-3 rounded-full py-4 shadow-lg active:scale-[0.98] ${
            areRequiredModifiersSelected ? 'bg-primary' : 'bg-on-surface/20'
          }`}
        >
          <ShoppingBag size={24} color={areRequiredModifiersSelected ? "#ffffff" : "#707a6c"} />
          <Text className={`font-jakarta-sans font-bold text-lg ${
            areRequiredModifiersSelected ? 'text-white' : 'text-on-surface-variant'
          }`}>
            {areRequiredModifiersSelected 
              ? `Add to Cart • ${formatCurrency(calculateTotal())}`
              : 'Select required options'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
