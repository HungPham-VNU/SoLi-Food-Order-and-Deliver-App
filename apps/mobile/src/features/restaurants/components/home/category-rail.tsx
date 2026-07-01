import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  Leaf,
  Utensils,
  WheatOff,
  Apple,
  Pizza,
  Soup,
  Coffee,
  Croissant,
  Fish,
  Carrot,
  Cherry,
  Egg,
  Beef,
  IceCream,
} from 'lucide-react-native';
import { useDietaryTags } from '../../api/restaurant-api';

type CategoryIconProps = {
  size: number;
  color: string;
  fill?: string;
};

const FALLBACK_ICONS = [
  Pizza,
  Soup,
  Coffee,
  Croissant,
  Fish,
  Carrot,
  Cherry,
  Egg,
  Beef,
  IceCream,
  Utensils,
];

const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

interface CategoryRailProps {
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryRail({
  selectedCategory,
  onSelectCategory,
}: CategoryRailProps) {
  const { data: dietaryTags } = useDietaryTags('dietary');

  const categories = React.useMemo(() => {
    const base = [{ id: 'all', name: 'All', Icon: Utensils }];
    if (!dietaryTags) return base;

    const dynamic = dietaryTags.map((tag) => {
      let Icon: React.ComponentType<CategoryIconProps> = Utensils;
      const slug = tag.slug.toLowerCase();
      
      if (slug.includes('vegan') || slug.includes('vegetarian')) {
        Icon = Leaf;
      } else if (slug.includes('gluten-free')) {
        Icon = WheatOff;
      } else if (slug.includes('sugar-free')) {
        Icon = Apple;
      } else {
        const hash = hashString(tag.slug);
        Icon = FALLBACK_ICONS[hash % FALLBACK_ICONS.length];
      }

      return {
        id: tag.slug,
        name: tag.name,
        Icon,
      };
    });

    return [...base, ...dynamic];
  }, [dietaryTags]);
  return (
    <View className="mb-8">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4"
        contentContainerStyle={{ gap: 16, paddingRight: 32 }}
      >
        {categories.map((category) => {
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
