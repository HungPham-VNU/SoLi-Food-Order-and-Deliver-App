import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLogout } from '@/features/auth/hooks/useLogout';

export function DangerZoneTab() {
  const { logout, isLoggingOut } = useLogout();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSignOutAll = () => {
    if (
      window.confirm(
        'Force sign out from all devices? You will be redirected to the login page.',
      )
    ) {
      logout();
    }
  };

  const handleDeleteAccount = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    window.alert(
      'Account deletion is not yet wired to the backend. Contact support@harvestkitchen.com to permanently delete your account.',
    );
    setConfirmingDelete(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-error-container/30 border-2 border-error/20 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="h-6 w-6 text-error" />
          <h3 className="font-headline text-xl font-bold text-error">
            Danger Zone
          </h3>
        </div>

        <div className="space-y-5">
          {/* Sign Out Everywhere */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-error/20">
            <div className="flex-1">
              <h4 className="font-bold text-on-surface mb-1">Sign Out Everywhere</h4>
              <p className="text-sm text-on-surface-variant">
                Force sign out on all devices. This will invalidate all active sessions immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOutAll}
              disabled={isLoggingOut}
              className="px-5 py-2.5 rounded-full border border-error text-error font-semibold text-sm hover:bg-error/10 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isLoggingOut ? 'Signing out…' : 'Sign Out All'}
            </button>
          </div>

          {/* Delete Account */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-on-surface mb-1">Delete Account</h4>
              <p className="text-sm text-on-surface-variant">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              {confirmingDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-4 py-2.5 rounded-full text-on-surface-variant font-medium text-sm hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="px-5 py-2.5 rounded-full bg-error text-on-error font-semibold text-sm hover:brightness-110 transition-all active:scale-95 whitespace-nowrap"
              >
                {confirmingDelete ? 'Confirm Delete' : 'Delete Account…'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
