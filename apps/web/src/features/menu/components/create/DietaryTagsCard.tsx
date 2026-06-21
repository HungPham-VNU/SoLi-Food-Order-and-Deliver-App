import { Tag } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { CreateMenuItemFormValues } from '@/features/menu/schemas/menu.schema';
import { useDietaryTags } from '@/features/menu/hooks/useMenu';

const FALLBACK_DIETARY_TAGS = [
  'Vegan',
  'Gluten-Free',
  'Organic',
  'Locally Sourced',
  'Sugar-Free',
];

export function DietaryTagsCard() {
  const { watch, setValue } = useFormContext<CreateMenuItemFormValues>();
  const selected = watch('tags') ?? [];
  const { data } = useDietaryTags();
  const activeTagNames = data?.map((tag) => tag.name) ?? FALLBACK_DIETARY_TAGS;
  const activeTagSet = new Set(activeTagNames);
  const tagOptions = [
    ...activeTagNames,
    ...selected.filter((tag) => !activeTagSet.has(tag)),
  ];

  const toggle = (tag: string) => {
    setValue(
      'tags',
      selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag],
    );
  };

  return (
    <div className="bg-card rounded-3xl p-8 shadow-sm border border-border/50">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Tag className="h-5 w-5 text-primary" />
        Dietary &amp; Lifestyle Tags
      </h3>
      <div className="flex flex-wrap gap-3">
        {tagOptions.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`px-5 py-2.5 rounded-full border font-medium transition-all ${
                active
                  ? 'bg-primary-200 border-primary-200 text-on-primary-fixed'
                  : 'border-border text-muted-foreground hover:border-primary'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
