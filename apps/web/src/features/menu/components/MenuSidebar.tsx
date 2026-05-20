import { MenuOverview } from '@/features/menu/types';
import { AddMenuItemCard } from './AddMenuItemCard';
import { Card, CardContent } from '@/components/ui/card';

interface MenuSidebarProps {
  overview: MenuOverview;
  onAddItem: () => void;
}

export function MenuSidebar({ overview, onAddItem }: MenuSidebarProps) {
  const { totalItems, availableItems, unavailableItems, outOfStockItems, categories } = overview;
  const healthPct = totalItems > 0 ? Math.round((availableItems / totalItems) * 100) : 100;

  return (
    <div className="space-y-6">
      <AddMenuItemCard onClick={onAddItem} />

      {/* Menu Stats Card */}
      <Card className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 py-0 gap-0 ring-0">
        <CardContent className="p-6">
          <h4 className="font-headline text-lg font-bold mb-4">Menu Overview</h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-on-surface-variant">Active Items</span>
              <span className="text-sm font-bold text-primary bg-primary-200 px-3 py-1 rounded-full">
                {availableItems}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-on-surface-variant">Out of Stock</span>
              <span className="text-sm font-bold text-error bg-error-container px-3 py-1 rounded-full">
                {outOfStockItems}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-on-surface-variant">Hidden / Unavailable</span>
              <span className="text-sm font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                {unavailableItems}
              </span>
            </div>
            <div className="pt-4 border-t border-outline-variant/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-outline uppercase">Inventory Health</span>
                <span className="text-xs font-bold text-primary">{healthPct}%</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${healthPct}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Management */}
      <Card className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 py-0 gap-0 ring-0">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-headline text-lg font-bold">Categories</h4>
            <span className="text-xs font-bold text-outline">{categories.length} total</span>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-2">
              No categories yet. Add one when creating a menu item.
            </p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                  <Card
                    key={cat.id}
                    className="bg-surface rounded-2xl py-0 gap-0 ring-0 group cursor-pointer hover:bg-stone-50 transition-colors"
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-on-surface">{cat.name}</span>
                      <span className="text-xs text-outline font-medium">#{cat.displayOrder + 1}</span>
                    </CardContent>
                  </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
