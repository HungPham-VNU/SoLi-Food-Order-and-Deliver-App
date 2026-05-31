import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../hooks/useNotificationPreferences';
import { MUTED_CATEGORY_OPTIONS } from '../types';
import { useBrowserNotification } from '@/hooks/useBrowserNotification';

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Indochina (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'UTC', label: 'UTC' },
];

const CHANNELS: Array<{
  key: 'pushEnabled' | 'inAppEnabled' | 'emailEnabled' | 'smsEnabled';
  icon: string;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    key: 'pushEnabled',
    icon: 'phone_iphone',
    title: 'Push Notifications',
    description: 'Instant alerts sent directly to your device.',
  },
  {
    key: 'inAppEnabled',
    icon: 'inbox',
    title: 'In-app Messages',
    description: 'Notifications delivered within the dashboard.',
  },
  {
    key: 'emailEnabled',
    icon: 'mail',
    title: 'Email Summaries',
    description: 'Daily or weekly rollups sent to your inbox.',
  },
  {
    key: 'smsEnabled',
    icon: 'sms',
    title: 'SMS Alerts',
    description: 'Critical alerts sent via text message.',
    badge: 'Pro plan required',
  },
];

function hourToTimeStr(h: number | null): string {
  if (h === null || h === undefined) return '22:00';
  return `${String(h).padStart(2, '0')}:00`;
}

function timeStrToHour(s: string): number {
  const [h] = s.split(':');
  const parsed = parseInt(h, 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(23, parsed)) : 0;
}

export function NotificationsTab() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const { mutate: updatePrefs, isPending } = useUpdateNotificationPreferences();
  const { requestPermission } = useBrowserNotification();

  // Local state for quiet hours master toggle (synthetic since API uses null = disabled)
  const [quietHoursStaged, setQuietHoursStaged] = useState<{
    start: number;
    end: number;
  } | null>(null);

  if (isLoading || !prefs) {
    return (
      <div className="bg-surface-container-low rounded-3xl p-8 animate-pulse">
        <div className="h-5 bg-surface-container-highest rounded w-1/3 mb-4" />
        <div className="h-3 bg-surface-container-highest rounded w-2/3 mb-2" />
        <div className="h-3 bg-surface-container-highest rounded w-1/2" />
      </div>
    );
  }

  const quietHoursEnabled =
    prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null;

  const handleChannelToggle = async (
    key: 'pushEnabled' | 'inAppEnabled' | 'emailEnabled' | 'smsEnabled',
    value: boolean,
  ) => {
    if (key === 'pushEnabled' && value) {
      const perm = await requestPermission();
      if (perm !== 'granted') {
        return;
      }
    }
    updatePrefs({ [key]: value });
  };

  const handleQuietHoursMaster = (enabled: boolean) => {
    if (enabled) {
      const start = quietHoursStaged?.start ?? 22;
      const end = quietHoursStaged?.end ?? 7;
      updatePrefs({ quietHoursStart: start, quietHoursEnd: end });
    } else {
      setQuietHoursStaged({
        start: prefs.quietHoursStart ?? 22,
        end: prefs.quietHoursEnd ?? 7,
      });
      updatePrefs({ quietHoursStart: null, quietHoursEnd: null });
    }
  };

  const toggleMutedCategory = (value: string) => {
    const set = new Set(prefs.mutedTypes);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    updatePrefs({ mutedTypes: Array.from(set) });
  };

  return (
    <div className="space-y-6">
      {/* Channels */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
        <div className="mb-6">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            Delivery Channels
          </h3>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Choose how you want to receive alerts and messages.
          </p>
        </div>

        <div className="divide-y divide-outline-variant/15">
          {CHANNELS.map((ch) => (
            <div key={ch.key} className="flex items-center gap-4 py-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-base">{ch.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-on-surface text-sm">{ch.title}</p>
                  {ch.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container/60 text-on-secondary-container text-[10px] font-bold uppercase">
                      {ch.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {ch.description}
                </p>
              </div>
              <Switch
                checked={prefs[ch.key]}
                disabled={isPending}
                onCheckedChange={(v) => handleChannelToggle(ch.key, v)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Quiet Hours */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="font-headline text-lg font-bold text-on-surface">
              Quiet Hours
            </h3>
            <p className="font-body text-sm text-on-surface-variant mt-1">
              Pause non-critical notifications during these times.
            </p>
          </div>
          <Switch
            checked={quietHoursEnabled}
            disabled={isPending}
            onCheckedChange={handleQuietHoursMaster}
          />
        </div>

        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-3 gap-4 transition-opacity',
            !quietHoursEnabled && 'opacity-40 pointer-events-none',
          )}
        >
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Start Time
            </label>
            <input
              type="time"
              value={hourToTimeStr(prefs.quietHoursStart)}
              onChange={(e) =>
                updatePrefs({ quietHoursStart: timeStrToHour(e.target.value) })
              }
              className="w-full rounded-xl border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              End Time
            </label>
            <input
              type="time"
              value={hourToTimeStr(prefs.quietHoursEnd)}
              onChange={(e) =>
                updatePrefs({ quietHoursEnd: timeStrToHour(e.target.value) })
              }
              className="w-full rounded-xl border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Timezone
            </label>
            <select
              value={prefs.timezone}
              onChange={(e) => updatePrefs({ timezone: e.target.value })}
              className="w-full rounded-xl border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-4 text-xs text-on-surface-variant italic">
          Critical alerts (e.g. new orders) still come through during quiet hours.
        </p>
      </section>

      {/* Muted Categories */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
        <div className="mb-4">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            Muted Categories
          </h3>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Select the types of content you do not want to be notified about.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {MUTED_CATEGORY_OPTIONS.map((opt) => {
            const isMuted = prefs.mutedTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMutedCategory(opt.value)}
                disabled={isPending}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
                  isMuted
                    ? 'bg-secondary-container/60 text-on-secondary-container'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
                )}
              >
                {opt.label}
                <span className="material-symbols-outlined text-sm">
                  {isMuted ? 'check' : 'add'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
