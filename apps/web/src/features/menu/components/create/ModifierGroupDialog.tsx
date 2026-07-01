import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { PriceInput } from '@/components/ui/price-input';
import { useCreateModifierGroup, useUpdateModifierGroup, useCreateModifierOption, useDeleteModifierOption } from '@/features/menu/hooks/useMenuMutations';
import type { ModifierGroup } from '@/features/menu/types';

const modifierGroupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  minSelections: z.number().int().min(0),
  maxSelections: z.number().int().min(0),
});

type ModifierGroupFormData = z.infer<typeof modifierGroupSchema>;

interface ModifierOptionFormData {
  name: string;
  price: number;
}

interface ModifierGroupDialogProps {
  menuItemId: string;
  group: ModifierGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModifierGroupDialog({
  menuItemId,
  group,
  open,
  onOpenChange,
}: ModifierGroupDialogProps) {
  const [newOptions, setNewOptions] = useState<ModifierOptionFormData[]>([]);
  const [newOptionInput, setNewOptionInput] = useState<{name: string; price: number | undefined}>({
    name: '',
    price: undefined,
  });
  const [isSavingOptions, setIsSavingOptions] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ModifierGroupFormData>({
    resolver: zodResolver(modifierGroupSchema),
    defaultValues: {
      name: group?.name ?? '',
      minSelections: group?.minSelections ?? 0,
      maxSelections: group?.maxSelections ?? 1,
    },
  });

  const { mutate: createGroup, isPending: isCreating } = useCreateModifierGroup(menuItemId);
  const { mutate: updateGroup, isPending: isUpdating } = useUpdateModifierGroup(menuItemId);
  const { mutate: createOption } = useCreateModifierOption(menuItemId, group?.id ?? '');
  const { mutate: deleteOption, isPending: isDeletingOption } = useDeleteModifierOption(menuItemId, group?.id ?? '');

  useEffect(() => {
    if (open) {
      if (group) {
        reset({
          name: group.name,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
        });
      } else {
        reset({
          name: '',
          minSelections: 0,
          maxSelections: 1,
        });
      }
    }
  }, [open, group, reset]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNewOptions([]);
      setNewOptionInput({ name: '', price: undefined });
    }
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: ModifierGroupFormData) => {
    if (group) {
      updateGroup(
        {
          groupId: group.id,
          dto: data,
        },
        {
          onSuccess: () => {
            if (newOptions.length > 0) {
              setIsSavingOptions(true);
              saveGroupOptions(group.id, newOptions);
            } else {
              handleOpenChange(false);
            }
          },
        }
      );
    } else {
      createGroup(
        {
          ...data,
          displayOrder: 0,
        },
        {
          onSuccess: (createdGroup) => {
            if (newOptions.length > 0) {
              setIsSavingOptions(true);
              saveGroupOptions(createdGroup.id, newOptions);
            } else {
              handleOpenChange(false);
            }
          },
        }
      );
    }
  };

  const saveGroupOptions = (groupId: string, optionsToSave: ModifierOptionFormData[]) => {
    let savedCount = 0;
    optionsToSave.forEach((option, index) => {
      createOption(
        {
          name: option.name,
          price: option.price,
          displayOrder: index,
          isAvailable: true,
          isDefault: false,
          groupId,
        },
        {
          onSuccess: () => {
            savedCount++;
            if (savedCount === optionsToSave.length) {
              setIsSavingOptions(false);
              handleOpenChange(false);
            }
          },
          onError: (error) => {
            console.error('Failed to save modifier option:', error);
            setIsSavingOptions(false);
          },
        }
      );
    });
  };

  const handleAddOption = () => {
    if (newOptionInput.name.trim()) {
      setNewOptions([...newOptions, { ...newOptionInput, price: newOptionInput.price || 0 }]);
      setNewOptionInput({ name: '', price: undefined });
    }
  };

  const handleDeleteExistingOption = (optionId: string) => {
    if (group) {
      deleteOption(optionId);
    }
  };

  const handleRemoveNewOption = (index: number) => {
    setNewOptions(newOptions.filter((_, i) => i !== index));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">
            {group ? 'Edit Modifier Group' : 'Add Modifier Group'}
          </h2>
          <button
            onClick={() => handleOpenChange(false)}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <form id="group-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-bold mb-2">Group Name</label>
              <input
                {...register('name')}
                placeholder="e.g., Size, Extras, Spice Level"
                className="w-full px-4 py-2 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Min/Max Selections */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Min Selections</label>
                <input
                  type="number"
                  {...register('minSelections', { valueAsNumber: true })}
                  min={0}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Max Selections</label>
                <input
                  type="number"
                  {...register('maxSelections', { valueAsNumber: true })}
                  min={0}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

          </form>

          {/* Options Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="font-bold">Options</h3>

            {/* Existing Options */}
            {group?.options.map((option) => (
                <div key={option.id} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm">
                    <p className="font-medium">{option.name}</p>
                    <p className="text-xs text-muted-foreground">
                      +₫{option.price.toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteExistingOption(option.id)}
                    disabled={isDeletingOption}
                    className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* New Options */}
              {newOptions.map((option, index) => (
                <div key={index} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm">
                    <p className="font-medium">{option.name}</p>
                    <p className="text-xs text-muted-foreground">
                      +₫{option.price.toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveNewOption(index)}
                    className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Add Another Option Button */}
              <div className="pt-2 border-t">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Add Another Option
                </p>
              </div>

              {/* Add Option Form */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={newOptionInput.name}
                  onChange={(e) => setNewOptionInput({ ...newOptionInput, name: e.target.value })}
                  placeholder="Option name (e.g., Large)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <div className="flex gap-2">
                  <PriceInput
                    value={newOptionInput.price}
                    onChange={(val) => setNewOptionInput({ ...newOptionInput, price: val })}
                    placeholder="Price adjustment"
                    min={0}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddOption}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

          {/* Submit Button */}
          <Button
            type="submit"
            form="group-form"
            disabled={isCreating || isUpdating || isSavingOptions}
            className="w-full"
          >
            {isCreating || isUpdating || isSavingOptions ? 'Saving...' : group ? 'Update Group' : 'Create Group'}
          </Button>
        </div>
      </div>
    </div>
  );
}
