import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Search, Sparkles, X } from 'lucide-react-native';
import type { SearchMode } from '../../store';

interface HomeSearchBarProps {
  query: string;
  onChangeQuery: (query: string) => void;
  mode: SearchMode;
  onToggleMode: () => void;
}

export function HomeSearchBar({
  query,
  onChangeQuery,
  mode,
  onToggleMode,
}: HomeSearchBarProps) {
  const isAiMode = mode === 'ai';

  return (
    <View className="px-4 mb-6">
      <View className="relative justify-center">
        <View className="absolute left-4 z-10 pointer-events-none">
          {isAiMode ? (
            <Sparkles size={20} color="#00490e" />
          ) : (
            <Search size={20} color="#40493d" />
          )}
        </View>
        <TextInput
          className={`w-full h-14 pl-12 pr-28 bg-surface-container-lowest border rounded-full font-inter text-sm text-on-surface shadow-sm ${
            isAiMode ? 'border-primary' : 'border-surface-variant'
          }`}
          placeholder={
            isAiMode
              ? 'Ask for food by need, budget, rating...'
              : 'Search restaurants, dishes...'
          }
          placeholderTextColor="#40493d"
          value={query}
          onChangeText={onChangeQuery}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {query.length > 0 ? (
          <TouchableOpacity
            onPress={() => onChangeQuery('')}
            className="absolute right-20 z-10 h-9 w-9 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={18} color="#40493d" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onToggleMode}
          className={`absolute right-3 z-10 h-9 min-w-14 px-3 rounded-full flex-row items-center justify-center gap-1 ${
            isAiMode ? 'bg-primary' : 'bg-surface-container'
          }`}
          accessibilityRole="switch"
          accessibilityState={{ checked: isAiMode }}
          accessibilityLabel="Toggle AI search mode"
        >
          <Sparkles size={14} color={isAiMode ? '#ffffff' : '#00490e'} />
          <Text
            className={`font-inter text-xs font-bold ${
              isAiMode ? 'text-white' : 'text-primary'
            }`}
          >
            AI
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
