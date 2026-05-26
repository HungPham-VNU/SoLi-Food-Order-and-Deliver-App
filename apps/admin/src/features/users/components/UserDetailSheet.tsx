import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  Mail,
  Ban,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import {
  useSetRole,
  useBanUser,
  useUnbanUser,
  useRemoveUser,
} from '../hooks/useUsers';
import {
  ROLES,
  ROLE_BADGE,
  ROLE_LABELS,
  STATUS_META,
  effectiveRole,
  formatJoinDate,
  getInitials,
  userStatus,
} from '../utils/format';
import type { AdminUser, AppRole } from '../api/users.api';

interface Props {
  user: AdminUser | null;
  onClose: () => void;
}

const BAN_DURATIONS: { label: string; seconds: number | null }[] = [
  { label: '1 day', seconds: 24 * 60 * 60 },
  { label: '7 days', seconds: 7 * 24 * 60 * 60 },
  { label: '30 days', seconds: 30 * 24 * 60 * 60 },
  { label: 'Permanent', seconds: null },
];

export function UserDetailSheet({ user, onClose }: Props) {
  const setRoleMutation = useSetRole();
  const banMutation = useBanUser();
  const unbanMutation = useUnbanUser();
  const removeMutation = useRemoveUser();

  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDurationIdx, setBanDurationIdx] = useState<number>(1); // default 7 days
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Hydrate role selector / reset local UI state when user changes.
  useEffect(() => {
    if (user) {
      setSelectedRole(effectiveRole(user));
    } else {
      setSelectedRole(null);
      setBanReason('');
      setDeleteConfirm(false);
    }
  }, [user]);

  async function handleSaveRole() {
    if (!user || !selectedRole || selectedRole === effectiveRole(user)) return;
    await setRoleMutation.mutateAsync({ userId: user.id, role: selectedRole });
  }

  async function handleBan() {
    if (!user) return;
    const duration = BAN_DURATIONS[banDurationIdx];
    await banMutation.mutateAsync({
      userId: user.id,
      banReason: banReason.trim() || undefined,
      banExpiresIn: duration.seconds ?? undefined,
    });
    setBanReason('');
  }

  async function handleUnban() {
    if (!user) return;
    await unbanMutation.mutateAsync(user.id);
  }

  async function handleDelete() {
    if (!user) return;
    await removeMutation.mutateAsync(user.id);
    onClose();
  }

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="overflow-y-auto p-0 flex flex-col"
        style={{ width: '520px', maxWidth: '520px' }}
      >
        {user && (
          <>
            {/* Header */}
            <div className="border-b px-6 pt-6 pb-5 pr-14">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-4 border-background shadow-sm">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="bg-primary-200 text-primary text-xl font-bold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-on-surface truncate">
                    {user.name}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      className={`${ROLE_BADGE[effectiveRole(user)]} hover:${ROLE_BADGE[effectiveRole(user)]}`}
                    >
                      {ROLE_LABELS[effectiveRole(user)]}
                    </Badge>
                    <Badge
                      className={`${STATUS_META[userStatus(user)].badge} hover:${STATUS_META[userStatus(user)].badge} gap-1.5`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[userStatus(user)].dot}`} />
                      {STATUS_META[userStatus(user)].label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <InfoItem
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Joined"
                  value={formatJoinDate(user.createdAt)}
                />
                <InfoItem
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Email verified"
                  value={user.emailVerified ? 'Yes' : 'No'}
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Banned banner */}
              {user.banned && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-900">
                  <Ban className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                  <div className="min-w-0">
                    <p className="font-semibold">User is suspended</p>
                    {user.banReason && <p className="text-xs mt-0.5">Reason: {user.banReason}</p>}
                    {user.banExpires && (
                      <p className="text-xs mt-0.5">
                        Expires: {formatJoinDate(user.banExpires)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Account Management */}
              <Section
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Account management"
              >
                {/* Change role */}
                <div className="space-y-3">
                  <Label className="text-sm">Change role</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {ROLES.map((r) => {
                      const active = selectedRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSelectedRole(r)}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                            active
                              ? 'border-primary bg-primary-50/40 text-primary ring-1 ring-primary'
                              : 'border-border bg-card text-on-surface-variant hover:bg-surface-container/50'
                          }`}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      );
                    })}
                  </div>
                  {selectedRole && selectedRole !== effectiveRole(user) && (
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleSaveRole}
                      disabled={setRoleMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {setRoleMutation.isPending
                        ? 'Saving…'
                        : `Save as ${ROLE_LABELS[selectedRole]}`}
                    </Button>
                  )}
                </div>
              </Section>

              {/* Danger zone */}
              <Section
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                title="Danger zone"
                tone="danger"
              >
                {/* Ban / Unban */}
                {user.banned ? (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        Lift suspension
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Restore full account access for this user.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-green-300 text-green-700 hover:bg-green-50"
                      onClick={handleUnban}
                      disabled={unbanMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {unbanMutation.isPending ? 'Unbanning…' : 'Unban user'}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        Suspend user
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prevent the user from signing in for a defined period.
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs">Duration</Label>
                      <div className="grid grid-cols-4 gap-2 mt-1.5">
                        {BAN_DURATIONS.map((d, i) => {
                          const active = banDurationIdx === i;
                          return (
                            <button
                              key={d.label}
                              type="button"
                              onClick={() => setBanDurationIdx(i)}
                              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? 'border-red-400 bg-red-50 text-red-700'
                                  : 'border-border bg-card text-on-surface-variant hover:bg-surface-container/50'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="banReason" className="text-xs">
                        Reason (optional)
                      </Label>
                      <Input
                        id="banReason"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="e.g. Violation of Terms of Service"
                        className="mt-1.5"
                      />
                    </div>

                    <Button
                      variant="outline"
                      className="w-full gap-2 border-red-300 text-red-700 hover:bg-red-50"
                      onClick={handleBan}
                      disabled={banMutation.isPending}
                    >
                      <Ban className="h-4 w-4" />
                      {banMutation.isPending ? 'Suspending…' : 'Apply suspension'}
                    </Button>
                  </div>
                )}

                {/* Delete */}
                <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
                      <Trash2 className="h-4 w-4 text-red-600" />
                      Delete account
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Permanently remove the user and all associated data. This
                      action is irreversible.
                    </p>
                  </div>

                  {!deleteConfirm ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-red-300 text-red-700 hover:bg-red-100"
                      onClick={() => setDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete user
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-red-500 bg-red-600 text-white hover:bg-red-700"
                        onClick={handleDelete}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        {removeMutation.isPending ? 'Deleting…' : 'Confirm delete'}
                      </Button>
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="border-t bg-background px-6 py-4">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={tone === 'danger' ? 'text-red-500' : 'text-primary'}>
          {icon}
        </span>
        <h3
          className={`text-xs font-semibold uppercase tracking-wider ${
            tone === 'danger' ? 'text-red-600' : 'text-muted-foreground'
          }`}
        >
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-muted-foreground">{label}</p>
        <p className="text-on-surface font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

