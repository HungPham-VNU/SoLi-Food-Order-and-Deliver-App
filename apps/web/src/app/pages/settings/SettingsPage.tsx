import { useState } from 'react';
import { SettingsSidebar } from '@/features/settings/components/SettingsSidebar';
import { ProfileTab } from '@/features/settings/components/ProfileTab';
import { SecurityTab } from '@/features/settings/components/SecurityTab';
import { NotificationsTab } from '@/features/settings/components/NotificationsTab';
import { DevicesTab } from '@/features/settings/components/DevicesTab';
import { DangerZoneTab } from '@/features/settings/components/DangerZoneTab';
import { StoreTab } from '@/features/settings/components/StoreTab';
import type { SettingsTab } from '@/features/settings/types';

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header>
        <h2 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">
          Settings
        </h2>
        <p className="text-on-surface-variant font-medium mt-2 max-w-2xl">
          Manage your account, security, and notifications.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        <SettingsSidebar active={tab} onChange={setTab} />

        <div className="flex-1 w-full min-w-0">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'store' && <StoreTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'devices' && <DevicesTab />}
          {tab === 'danger' && <DangerZoneTab />}
        </div>
      </div>
    </div>
  );
}
