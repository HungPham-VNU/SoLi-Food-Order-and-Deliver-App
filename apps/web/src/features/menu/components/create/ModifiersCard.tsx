import { useState } from 'react';
import { Plus, GripVertical, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModifierGroups } from '@/features/menu/hooks/useMenu';
import { useDeleteModifierGroup } from '@/features/menu/hooks/useMenuMutations';
import type { ModifierGroup } from '@/features/menu/types';
import { ModifierGroupDialog } from './ModifierGroupDialog';
import { formatPrice } from '@/lib/format';

interface ModifiersCardProps {
  menuItemId: string;
}

export function ModifiersCard({ menuItemId }: ModifiersCardProps) {
  const [selectedGroup, setSelectedGroup] = useState<ModifierGroup | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: groups = [] } = useModifierGroups(menuItemId);
  const { mutate: deleteGroup } = useDeleteModifierGroup(menuItemId);

  const handleOpenDialog = (group?: ModifierGroup) => {
    setSelectedGroup(group || null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedGroup(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (confirm('Delete this modifier group?')) {
      deleteGroup(groupId);
    }
  };

  return (
    <>
      <div className="space-y-6 bg-card rounded-3xl p-8 shadow-sm border border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Modifiers</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {groups.length === 0 ? 'Add size, extras, or other options' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-start gap-4 bg-muted/30 rounded-xl p-4 hover:bg-muted/50 transition-colors"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <h4 className="font-bold text-foreground">{group.name}</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {group.minSelections === 0 ? 'Optional' : 'Required'}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {group.options.map((option) => (
                    <div key={option.id} className="text-sm text-muted-foreground flex justify-between">
                      <span>{option.name}</span>
                      <span className="text-foreground font-medium">
                        {option.price > 0 ? `+${formatPrice(option.price)}` : 'Free'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDialog(group)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteGroup(group.id)}
                  className="h-8 w-8 p-0 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => handleOpenDialog()}
          className="w-full text-primary border-primary/30 hover:bg-primary/5"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Modifier Group
        </Button>
      </div>

      <ModifierGroupDialog
        menuItemId={menuItemId}
        group={selectedGroup}
        open={isDialogOpen}
        onOpenChange={handleCloseDialog}
      />
    </>
  );
}
