import React from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Search, X } from 'lucide-react-native';

interface HomeSearchBarProps {
  query: string;
  onChangeQuery: (query: string) => void;
}

export function HomeSearchBar({ query, onChangeQuery }: HomeSearchBarProps) {
  return (
    <View className="px-4 mb-6">
      <View className="relative justify-center">
        <View className="absolute left-4 z-10 pointer-events-none">
          <Search size={20} color="#40493d" />
        </View>
        <TextInput
          className="w-full h-14 pl-12 pr-12 bg-surface-container-lowest border border-surface-variant rounded-full font-inter text-sm text-on-surface shadow-sm"
          placeholder="Search restaurants, dishes..."
          placeholderTextColor="#40493d"
          value={query}
          onChangeText={onChangeQuery}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {query.length > 0 ? (
          <TouchableOpacity
            onPress={() => onChangeQuery('')}
            className="absolute right-4 z-10"
          >
            <X size={18} color="#40493d" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
