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
  X,
  Share2,
  Heart,
  Check,
  Minus,
  Plus,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/src/lib/format-utils';
import { MenuItemDetailScreenProps, ModifierGroup } from '../types';
import { useMenuItem, useMenuItemModifiers } from '../api/restaurant-api';
import { useMyCart } from '@/src/features/cart';
import { LinearGradient } from 'expo-linear-gradient';

const areModifierSelectionsEqual = (a: Record<string, string[]>, b: Record<string, string[]>) => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => {
    const valA = a[key];
    const valB = b[key];
    if (!valB || valA.length !== valB.length) return false;
    return valA.every(id => valB.includes(id)) && valB.every(id => valA.includes(id));
  });
};

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
  const { data: cart } = useMyCart();

  const currentSelections = useMemo(() => {
    const selections: Record<string, string[]> = {};
    modifierGroups?.forEach(group => {
      const selectedInGroup = selectedOptionIds.filter(id => 
        group.options?.some(o => o.id === id)
      );
      if (selectedInGroup.length > 0) {
        selections[group.id] = selectedInGroup;
      }
    });
    return selections;
  }, [modifierGroups, selectedOptionIds]);

  const isItemInCart = useMemo(() => {
    return cart?.items?.some(cartItem => {
      if (cartItem.menuItemId !== itemId) return false;
      
      const cartItemSelections: Record<string, string[]> = {};
      cartItem.selectedModifiers.forEach(mod => {
        if (!cartItemSelections[mod.groupId]) {
          cartItemSelections[mod.groupId] = [];
        }
        cartItemSelections[mod.groupId].push(mod.optionId);
      });
      
      return areModifierSelectionsEqual(currentSelections, cartItemSelections);
    });
  }, [cart, itemId, currentSelections]);

  const toggleOption = (optionId: string, group: ModifierGroup) => {
    setSelectedOptionIds(prev => {
      const isSelected = prev.includes(optionId);
      
      if (group.maxSelections === 1) {
        if (isSelected) {
          if (group.minSelections === 0) {
            return prev.filter(id => id !== optionId);
          }
          return prev;
        }
        const otherOptionsInGroup = group.options?.map(o => o.id) || [];
        const filtered = prev.filter(id => !otherOptionsInGroup.includes(id));
        return [...filtered, optionId];
      }
      
      if (isSelected) {
        return prev.filter(id => id !== optionId);
      } else {
        const optionsInGroupCount = prev.filter(id => group.options?.some(o => o.id === id)).length;
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
        group.options?.some(o => o.id === id)
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
    onAddToCart?.(itemId, quantity, currentSelections, isItemInCart);
  };

  const isLoading = isLoadingItem || isLoadingModifiers;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#00490e" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-on-surface">Item not found</Text>
        <TouchableOpacity onPress={onBack} className="mt-4">
          <Text className="text-primary font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background font-inter text-on-surface">
      <StatusBar barStyle="dark-content" />
      
      {/* Hero Image Area with Overlaid Navigation */}
      <View className="relative w-full h-72 shrink-0">
        <Image 
          source={{ uri: item.imageUrl }}
          className="w-full h-full rounded-b-xl"
          contentFit="cover"
        />
        <View className="absolute top-0 w-full flex-row justify-between items-start px-4 py-6" style={{ paddingTop: insets.top + 10 }}>
          <TouchableOpacity 
            onPress={onBack}
            className="bg-surface/80 backdrop-blur-md rounded-full p-2 shadow-sm active:bg-surface-container-highest"
          >
            <X size={24} color="#1a1c1c" />
          </TouchableOpacity>
          <View className="flex-row gap-2">
            <TouchableOpacity 
              className="bg-surface/80 backdrop-blur-md rounded-full p-2 shadow-sm active:bg-surface-container-highest"
            >
              <Share2 size={24} color="#1a1c1c" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                setIsFavorited(!isFavorited);
                onFavoriteToggle?.(itemId);
              }}
              className="bg-surface/80 backdrop-blur-md rounded-full p-2 shadow-sm active:bg-surface-container-highest"
            >
              <Heart 
                size={24} 
                color={isFavorited ? "#ba1a1a" : "#1a1c1c"} 
                fill={isFavorited ? "#ba1a1a" : "none"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Product Header Information */}
      <View className="px-6 pt-6 pb-8 bg-surface rounded-t-xl -mt-6 relative z-20 flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="font-jakarta-sans text-3xl font-bold text-on-surface mb-1">
            {item.name}
          </Text>
          <Text className="text-on-surface-variant font-inter text-sm">
            {item.description}
          </Text>
        </View>
        <View className="text-right flex flex-col items-end">
          <Text className="font-jakarta-sans text-2xl font-bold text-primary">
            {formatCurrency(item.price)}
          </Text>
          <Text className="text-on-surface-variant text-xs mt-1">Base Price</Text>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View className="flex-col gap-6">
          {/* Modifier Groups */}
          {modifierGroups?.map((group) => (
            <View key={group.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
              <View className="flex-row justify-between items-baseline mb-6">
                <Text className="font-jakarta-sans text-xl font-semibold text-on-surface">
                  {group.name}
                </Text>
                <View className="bg-surface-container px-3 py-1 rounded-full">
                  <Text className="text-[11px] font-medium text-on-surface-variant">
                    {group.minSelections > 0 ? 'Required' : 'Optional'}, max {group.maxSelections}
                  </Text>
                </View>
              </View>
              
              <View className="flex-col gap-4">
                {group.options?.map((option) => {
                  const isSelected = selectedOptionIds.includes(option.id);
                  const isRadio = group.maxSelections === 1;
                  
                  return (
                    <TouchableOpacity 
                      key={option.id}
                      onPress={() => toggleOption(option.id, group)}
                      disabled={!option.isAvailable}
                      className={`flex-row items-center justify-between group py-1 ${!option.isAvailable ? 'opacity-50' : ''}`}
                    >
                      <View className="flex-row items-center space-x-4 flex-1">
                        <View className={`relative flex items-center justify-center w-6 h-6 border border-outline-variant bg-surface ${
                          isRadio ? 'rounded-full' : 'rounded'
                        } ${isSelected ? 'border-primary' : ''}`}>
                          {isSelected && (
                            isRadio ? (
                              <View className="w-3 h-3 rounded-full bg-primary" />
                            ) : (
                              <Check size={14} color="#00490e" strokeWidth={3} />
                            )
                          )}
                        </View>
                        <Text className="font-inter text-base text-on-surface ml-4">
                          {option.name}
                        </Text>
                      </View>
                      {option.price > 0 && (
                        <Text className="font-inter text-sm font-medium text-on-surface-variant">
                          +{formatCurrency(option.price)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Quantity Section */}
          <View className="bg-surface-container-lowest rounded-xl p-6 shadow-sm flex-row justify-between items-center mb-10">
            <Text className="font-jakarta-sans text-xl font-semibold text-on-surface">Quantity</Text>
            <View className="flex-row items-center bg-surface-container-low rounded-full px-2 py-1 h-14">
              <TouchableOpacity 
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full items-center justify-center active:bg-surface-container-high"
              >
                <Minus size={20} color="#1a1c1c" />
              </TouchableOpacity>
              <Text className="font-jakarta-sans font-semibold text-lg px-4 text-on-surface w-12 text-center">
                {quantity}
              </Text>
              <TouchableOpacity 
                onPress={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full items-center justify-center bg-primary-fixed/20 active:bg-primary-fixed/40"
              >
                <Plus size={20} color="#00490e" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View 
        className="absolute bottom-0 w-full z-50 bg-surface pb-8 pt-4 px-6 shadow-lg rounded-t-xl border-t border-outline-variant"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <TouchableOpacity 
          onPress={handleAddToCart}
          disabled={!areRequiredModifiersSelected}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={areRequiredModifiersSelected ? ['#00490e', '#0d631b'] : ['#e0e0e0', '#bdbdbd']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-full h-14 rounded-full flex-row items-center justify-center"
            style={{ borderRadius: 9999 }}
          >
            <Text 
              className={`font-jakarta-sans font-bold text-lg ${
                areRequiredModifiersSelected ? 'text-white' : 'text-on-surface-variant'
              }`}
            >
              {isItemInCart ? 'Update Cart' : 'Add to Cart'} - {formatCurrency(calculateTotal())}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
