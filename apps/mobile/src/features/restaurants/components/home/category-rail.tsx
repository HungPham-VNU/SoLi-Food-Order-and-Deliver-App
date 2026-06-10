import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  Croissant,
  Leaf,
  Pizza,
  Soup,
  Utensils,
} from 'lucide-react-native';

type CategoryIconProps = {
  size: number;
  color: string;
  fill?: string;
};

const CATEGORIES: {
  id: string;
  name: string;
  Icon: React.ComponentType<CategoryIconProps>;
}[] = [
  { id: 'all', name: 'All', Icon: Utensils },
  { id: 'italian', name: 'Italian', Icon: Pizza },
  { id: 'asian', name: 'Asian', Icon: Soup },
  { id: 'healthy', name: 'Healthy', Icon: Leaf },
  { id: 'bakery', name: 'Bakery', Icon: Croissant },
];

interface CategoryRailProps {
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryRail({
  selectedCategory,
  onSelectCategory,
}: CategoryRailProps) {
  return (
    <View className="mb-8">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4"
        contentContainerStyle={{ gap: 16, paddingRight: 32 }}
      >
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          const Icon = category.Icon;

          return (
            <TouchableOpacity
              key={category.id}
              onPress={() => onSelectCategory(category.id)}
              className="flex-col items-center gap-1.5 active:scale-95"
            >
              <View
                className={`w-16 h-16 rounded-2xl items-center justify-center shadow-md ${
                  isActive
                    ? 'bg-primary rotate-3'
                    : 'bg-surface-container-lowest border border-surface-variant'
                }`}
              >
                <Icon
                  size={30}
                  color={isActive ? '#ffffff' : '#00490e'}
                  fill={isActive ? '#ffffff' : 'none'}
                />
              </View>
              <Text
                className={`font-jakarta-sans text-sm font-bold mt-1 ${
                  isActive ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
