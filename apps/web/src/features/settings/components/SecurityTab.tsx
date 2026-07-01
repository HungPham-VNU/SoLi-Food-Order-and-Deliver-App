import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Laptop, Smartphone, Tablet } from 'lucide-react';
import { authClient, useSession } from '@/lib/auth-client';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .max(72, 'Too long'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type PasswordValues = z.infer<typeof passwordSchema>;

function scorePassword(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const map = [
    { label: 'Too weak', color: 'bg-error' },
    { label: 'Weak', color: 'bg-error' },
    { label: 'Fair', color: 'bg-secondary-container' },
    { label: 'Good', color: 'bg-primary/60' },
    { label: 'Strong', color: 'bg-primary' },
    { label: 'Excellent', color: 'bg-primary' },
  ];
  const r = map[Math.min(score, map.length - 1)];
  return { score, label: r.label, color: r.color };
}

interface PasswordInputProps {
  id: string;
  label: string;
  placeholder?: string;
  error?: string;
  register: ReturnType<typeof useForm<PasswordValues>>['register'];
  name: keyof PasswordValues;
  onValue?: (v: string) => void;
}

function PasswordInput({
  id,
  label,
  placeholder,
  error,
  register,
  name,
  onValue,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-headline text-sm font-semibold text-on-surface">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          {...register(name, {
            onChange: (e) => onValue?.(e.target.value),
          })}
          className="w-full rounded-md border-0 bg-surface-container-high px-4 py-3 pr-12 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

// ── Mock sessions until authClient.listSessions is wired ─────────────────────
type MockSession = {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  icon: React.ReactNode;
  current?: boolean;
};

const mockSessions: MockSession[] = [
  {
    id: 'current',
    device: 'MacBook Pro',
    browser: 'Chrome on macOS',
    location: 'Hanoi, Vietnam',
    lastActive: 'Active now',
    icon: <Laptop className="h-5 w-5" />,
    current: true,
  },
  {
    id: 's2',
    device: 'iPhone 14',
    browser: 'Safari on iOS',
    location: 'Ho Chi Minh, Vietnam',
    lastActive: '2 hours ago',
    icon: <Smartphone className="h-5 w-5" />,
  },
  {
    id: 's3',
    device: 'iPad Pro',
    browser: 'Safari on iPadOS',
    location: 'Hanoi, Vietnam',
    lastActive: '3 days ago',
    icon: <Tablet className="h-5 w-5" />,
  },
];

export function SecurityTab() {
  const { data: session } = useSession();
  const [pwdValue, setPwdValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const strength = scorePassword(pwdValue);
  const strengthBars = Array.from({ length: 5 }).map((_, i) => i < strength.score);

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    setSuccess(false);
    try {
      // @ts-expect-error better-auth changePassword shape varies by version
      await authClient.changePassword({ currentPassword, newPassword });
      setSuccess(true);
      reset();
      setPwdValue('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to change password');
    }
  });

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
        <div className="mb-6">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            Change Password
          </h3>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Ensure your account is using a long, random password to stay secure.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 max-w-xl">
          <PasswordInput
            id="currentPassword"
            label="Current Password"
            register={register}
            name="currentPassword"
            error={errors.currentPassword?.message}
          />

          <div>
            <PasswordInput
              id="newPassword"
              label="New Password"
              placeholder="Create a new password"
              register={register}
              name="newPassword"
              onValue={setPwdValue}
              error={errors.newPassword?.message}
            />
            {pwdValue && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {strengthBars.map((on, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        on ? strength.color : 'bg-surface-container-highest'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant">
                  Password strength: <span className="font-bold">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          <PasswordInput
            id="confirmPassword"
            label="Confirm Password"
            placeholder="Confirm your new password"
            register={register}
            name="confirmPassword"
            error={errors.confirmPassword?.message}
          />

          {error && (
            <div className="rounded-xl bg-error/5 border border-error/20 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Password updated successfully.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Active Sessions */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
        <div className="mb-6">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            Active Sessions
          </h3>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Devices currently signed in to your account.
          </p>
        </div>

        <div className="space-y-3">
          {mockSessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-fixed/40 flex items-center justify-center text-primary">
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-on-surface text-sm">{s.device}</p>
                  <span className="text-xs text-on-surface-variant">· {s.browser}</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                  {s.location} · {s.lastActive}
                </p>
              </div>
              {s.current ? (
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold uppercase">
                  Current
                </span>
              ) : (
                <button
                  type="button"
                  className="text-xs font-bold text-error hover:bg-error/10 px-3 py-1.5 rounded-full transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-outline-variant/15 flex justify-end">
          <button
            type="button"
            className="px-5 py-2.5 rounded-full border border-error text-error font-semibold text-sm hover:bg-error/5 transition-colors"
          >
            Sign Out All Other Devices
          </button>
        </div>

        {session?.user?.email && (
          <p className="mt-4 text-xs text-on-surface-variant italic">
            Tip: session list integration with the auth backend is upcoming. The current device is detected from your active session.
          </p>
        )}
      </section>
    </div>
  );
}
