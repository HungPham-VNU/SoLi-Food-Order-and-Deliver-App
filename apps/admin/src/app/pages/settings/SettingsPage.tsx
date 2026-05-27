import { useState, type FormEvent } from 'react';
import {
  Settings,
  User,
  Lock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/auth-client';
import { useLogout } from '@/features/auth/hooks/useLogout';
import {
  useUpdateProfile,
  useChangePassword,
} from '@/features/account/hooks/useAccount';
import { getInitials } from '@/features/users/utils/format';
import { PageHero } from '@/components/layout/PageHero';
import { ApiError } from '@/lib/api-client';

type Tab = 'profile' | 'security';

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Account"
        title="Settings"
        subtitle="Manage your admin profile and security preferences."
        icon={<Settings className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Side nav */}
        <nav className="space-y-1">
          {(
            [
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'security', label: 'Security', icon: Lock },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-card border shadow-sm text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile tab
// ---------------------------------------------------------------------------

function ProfileTab() {
  const { data: session } = useSession();
  const update = useUpdateProfile();
  const user = session?.user;
  const userId = user?.id ?? null;

  const [draft, setDraft] = useState({
    userId: null as string | null,
    name: '',
    image: '',
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const profile =
    draft.userId === userId
      ? draft
      : {
          userId,
          name: user?.name ?? '',
          image: user?.image ?? '',
        };

  const dirty =
    user != null &&
    (profile.name.trim() !== (user.name ?? '') ||
      profile.image.trim() !== (user.image ?? ''));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    await update.mutateAsync({
      name: profile.name.trim(),
      image: profile.image.trim() || undefined,
    });
    setSavedAt(Date.now());
  }

  const errorMessage =
    update.error instanceof ApiError ? update.error.message : null;

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-4 ring-primary/15 shadow-lg shadow-primary/10">
            <AvatarImage src={profile.image || user?.image || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary-700 text-primary-foreground text-xl font-bold">
              {getInitials(profile.name || user?.name || 'A')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-on-surface truncate">
              {user?.name ?? '—'}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email ?? '—'}
            </p>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 gap-1 mt-2">
              <ShieldCheck className="h-3 w-3" />
              Administrator
            </Badge>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Public profile</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Other admins will see this name and avatar.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={profile.name}
            onChange={(e) =>
              setDraft({ ...profile, name: e.target.value })
            }
            placeholder="Your name"
            minLength={1}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={user?.email ?? ''}
            disabled
            className="bg-surface-container/50 text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed from this page.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">Avatar URL</Label>
          <Input
            id="image"
            value={profile.image}
            onChange={(e) =>
              setDraft({ ...profile, image: e.target.value })
            }
            placeholder="https://…"
          />
          <p className="text-xs text-muted-foreground">
            Paste an image URL. (File upload to come later.)
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {savedAt && !update.isPending && !errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Profile saved successfully.</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security tab
// ---------------------------------------------------------------------------

function SecurityTab() {
  const change = useChangePassword();
  const { logout, isLoggingOut } = useLogout();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Naïve strength meter — count of: length≥8, upper, digit, symbol
  const strength = (() => {
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/\d/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score; // 0–4
  })();

  const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent'][
    Math.min(strength, 4)
  ];
  const strengthColor = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-green-500',
    'bg-emerald-600',
  ][Math.min(strength, 4)];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (newPassword !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('New password must be at least 8 characters.');
      return;
    }

    try {
      await change.mutateAsync({
        currentPassword,
        newPassword,
        revokeOtherSessions: revokeOthers,
      });
      setSavedAt(Date.now());
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch {
      /* error surfaced via change.error */
    }
  }

  const apiError =
    change.error instanceof ApiError ? change.error.message : null;
  const errorMessage = localError ?? apiError;

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border bg-card p-6 space-y-5"
      >
        <div>
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Change password
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use a strong, unique password you don't use anywhere else.
          </p>
        </div>

        <PasswordField
          id="currentPassword"
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((s) => !s)}
          autoComplete="current-password"
          required
        />

        <div className="space-y-2">
          <PasswordField
            id="newPassword"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((s) => !s)}
            autoComplete="new-password"
            required
          />
          {newPassword && (
            <div className="space-y-1">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < strength ? strengthColor : 'bg-surface-container'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Strength:{' '}
                <span className="font-medium text-on-surface">
                  {strengthLabel}
                </span>
              </p>
            </div>
          )}
        </div>

        <PasswordField
          id="confirm"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          show={showNew}
          onToggleShow={() => setShowNew((s) => !s)}
          autoComplete="new-password"
          required
        />

        <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border bg-surface-container/30 hover:bg-surface-container/60 transition-colors">
          <input
            type="checkbox"
            checked={revokeOthers}
            onChange={(e) => setRevokeOthers(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-medium text-on-surface">
              Sign out other devices
            </p>
            <p className="text-xs text-muted-foreground">
              All other active sessions will be revoked. Recommended.
            </p>
          </div>
        </label>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {savedAt && !change.isPending && !errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Password updated.</span>
          </div>
        )}

        <div className="flex items-center justify-end pt-2 border-t">
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>

      {/* Sign out card */}
      <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <LogOut className="h-4 w-4 text-red-600" />
          Sign out of this device
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          End the current admin session on this device.
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2 border-red-300 text-red-700 hover:bg-red-100"
          onClick={logout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Signing out…' : 'Sign out now'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password field with show/hide toggle
// ---------------------------------------------------------------------------

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-on-surface rounded"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
