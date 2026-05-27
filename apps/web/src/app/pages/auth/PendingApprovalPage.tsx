import { RegisterPendingHeader } from '@/features/auth/components/register/RegisterPendingHeader';
import { RegisterPendingStatus } from '@/features/auth/components/register/RegisterPendingStatus';
import { RegisterPendingAlerts } from '@/features/auth/components/register/RegisterPendingAlerts';
import { RegisterPendingSteps } from '@/features/auth/components/register/RegisterPendingSteps';
import { RegisterPendingContact } from '@/features/auth/components/register/RegisterPendingContact';
import { RegisterPendingMobileNav } from '@/features/auth/components/register/RegisterPendingMobileNav';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { UtensilsCrossed } from 'lucide-react';

export function PendingApprovalPage() {
  const { logout, isLoggingOut } = useLogout();

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col font-body">
      {/* Minimal top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-surface-container-lowest">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-200">
            <UtensilsCrossed className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-primary text-sm">SoLi Food</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          disabled={isLoggingOut}
          className="text-muted-foreground"
        >
          {isLoggingOut ? 'Logging out…' : 'Log out'}
        </Button>
      </header>

      <div className="flex flex-1">
        <main className="flex-1 overflow-y-auto bg-surface-container-low p-6 md:p-12 w-full min-h-full pb-24 md:pb-12">
          <div className="mx-auto space-y-10 max-w-5xl">
            <RegisterPendingHeader />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <RegisterPendingStatus />
              <RegisterPendingAlerts />
            </div>
            <RegisterPendingSteps />
            <RegisterPendingContact />
          </div>
        </main>
      </div>
      <RegisterPendingMobileNav />
    </div>
  );
}
