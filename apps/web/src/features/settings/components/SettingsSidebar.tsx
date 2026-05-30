import { cn } from '@/lib/utils';
import type { SettingsTab } from '../types';

interface SettingsSidebarProps {
  active: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

const TABS: Array<{
  value: SettingsTab;
  label: string;
  icon: string;
  variant?: 'default' | 'danger';
}> = [
  { value: 'profile', label: 'Profile', icon: 'person' },
  { value: 'store', label: 'Store Profile', icon: 'storefront' },
  { value: 'security', label: 'Security', icon: 'lock' },
  { value: 'notifications', label: 'Notifications', icon: 'notifications' },
  { value: 'devices', label: 'Devices', icon: 'devices' },
  { value: 'danger', label: 'Danger Zone', icon: 'warning', variant: 'danger' },
];

export function SettingsSidebar({ active, onChange }: SettingsSidebarProps) {
  return (
    <aside className="w-full lg:w-60 shrink-0 lg:sticky lg:top-6">
      <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
        {TABS.map((tab, idx) => {
          const isActive = active === tab.value;
          const isDanger = tab.variant === 'danger';

          // Visual divider before Danger Zone (desktop only).
          const isLast = idx === TABS.length - 1;

          return (
            <div key={tab.value} className="contents">
              {isLast && (
                <div className="hidden lg:block h-px w-full bg-outline-variant/30 my-1" />
              )}
              <button
                type="button"
                onClick={() => onChange(tab.value)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm whitespace-nowrap lg:whitespace-normal transition-colors',
                  isActive && !isDanger &&
                    'bg-surface-container text-primary font-semibold',
                  isActive && isDanger &&
                    'bg-error/10 text-error font-semibold',
                  !isActive && !isDanger &&
                    'text-on-surface-variant hover:bg-surface-container-low',
                  !isActive && isDanger &&
                    'text-error hover:bg-error/5',
                )}
              >
                <span className="material-symbols-outlined text-base">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
