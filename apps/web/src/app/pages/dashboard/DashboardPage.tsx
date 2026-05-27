import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  useMyRestaurant,
  useUpdateRestaurant,
} from '@/features/restaurant/hooks/useRestaurants';
import { useOrderCounts } from '@/features/dashboard/hooks/useOrderCounts';
import { useApiConnectivity } from '@/features/dashboard/hooks/useApiConnectivity';

const LOAD_BARS = [40, 60, 55, 80, 95, 70, 45, 30];

const STAFF = [
  {
    name: 'Marco Rossini',
    role: 'Head Chef',
    station: 'STATION A',
    available: true,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDlNNtQFc3Cjt5qAySWQn1-iz7e3vnQoxUXHYxUiIg36r5ONHNfaKupmrD44rI_eFNQaK6NEUgbR1Y_ZPWJny4ryabMun_2dhLnYSHOOrlG-ISRcsxi7EvCuh3zRek-tbg1F4oE0_rxl4jq-RPBLex8Uu2zUlKoBuk4HrOekN5Z5pyTIkSg6fjSq9fRbu3BF0XxNZamhRGRvVX_GDawDLy3IMgMAB9wVSzJnl8_-kwVEEVyaek0aYmh9vb5tNh8cVArDJ2d8qz4Hjs',
  },
  {
    name: 'Elena Vance',
    role: 'Sous Chef',
    station: 'STATION B',
    available: true,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuChIYz8_a3Wj1m6QhFG0kea0-REyCP4UNib18aaJebB_jDo6MbVHxANurc2Gdi46TMifpHDP8-kdnHOIKFV4PurzoPPuNYyeFGbj92mo6ZfoX7wAcrriRNmhniou5MdMFIhfxoLsq65jGGNZsB0hQcwgyIOppCGv4xAK04bmyZvEn1Xb-YuwQ4GBn5DVnbv9WJpsdwTz-uYyY9JJOJAeekdLGx87uZDwy7Q8Ok2SQEKA65ALNK8xfE4LL7k0LEnXI4lsC7F1EVf7jU',
  },
  {
    name: 'Shift Open',
    role: 'Delivery Prep',
    station: 'STATION C',
    available: false,
    avatar: null,
  },
];

const PAD2 = (n: number) => String(n).padStart(2, '0');

export function DashboardPage() {
  const { data: restaurant, isLoading: loadingRestaurant } = useMyRestaurant();
  const { mutate: updateRestaurant, isPending: updatingStore } =
    useUpdateRestaurant();

  const { inProgress, readyForPickup, urgentReady, isLoading: loadingOrders } =
    useOrderCounts();

  const { status: apiStatus, pingMs } = useApiConnectivity();

  const [muted, setMuted] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const isOpen = restaurant?.isOpen ?? false;
  const toggleStoreStatus = (next: boolean) => {
    if (!restaurant) return;
    if (next === restaurant.isOpen) return;
    updateRestaurant({ id: restaurant.id, data: { isOpen: next } });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full">

      {/* ── Section 1: Global Control Bar ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Store Status Toggle */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-3xl">storefront</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">Store Status</h2>
              <p className="text-sm text-on-surface-variant">
                {loadingRestaurant
                  ? 'Loading…'
                  : isOpen
                  ? 'Currently accepting orders through all channels.'
                  : 'Store is closed. Not accepting new orders.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-1.5 bg-surface-container rounded-full">
            <button
              onClick={() => toggleStoreStatus(true)}
              disabled={updatingStore || loadingRestaurant}
              className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all disabled:opacity-50 ${
                isOpen
                  ? 'bg-primary text-white shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => toggleStoreStatus(false)}
              disabled={updatingStore || loadingRestaurant}
              className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all disabled:opacity-50 ${
                !isOpen
                  ? 'bg-primary text-white shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Closed
            </button>
          </div>
        </div>

        {/* Audio Alerts */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col justify-center gap-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold uppercase tracking-tighter text-on-surface-variant">
              Audio Alerts
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setMuted(true)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  muted
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-lg">volume_off</span>
              </button>
              <button
                onClick={() => setMuted(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  !muted
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-lg">volume_up</span>
              </button>
            </div>
          </div>
          {!alertDismissed && urgentReady > 0 ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-error-container/20 rounded-2xl border border-error/10">
              <span className="material-symbols-outlined text-error">campaign</span>
              <span className="text-sm font-semibold text-error">
                {urgentReady} order{urgentReady > 1 ? 's' : ''} waiting &gt; 10 min
              </span>
              <button
                onClick={() => setAlertDismissed(true)}
                className="ml-auto text-xs font-bold uppercase underline text-error"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-surface-container rounded-2xl">
              <span className="material-symbols-outlined text-on-surface-variant text-sm">check_circle</span>
              <span className="text-sm text-on-surface-variant">No pending alerts</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Operational Bento Grid ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* In Progress */}
        <div className="bg-primary-container p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between h-48">
          <div className="z-10 relative">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-primary-container/70">
              In Progress
            </span>
            <h3 className="text-4xl font-black text-on-primary-container mt-1">
              {loadingOrders ? '—' : PAD2(inProgress)}
            </h3>
            <p className="text-sm font-medium text-on-primary-container/80">Preparing now</p>
          </div>
          <div className="z-10 relative flex items-center gap-2">
            <span className="text-xs font-bold py-1 px-3 bg-on-primary-container/10 rounded-full text-on-primary-container">
              Live count
            </span>
          </div>
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl text-on-primary-container/10 rotate-12 pointer-events-none">
            skillet
          </span>
        </div>

        {/* Ready for Pickup */}
        <div className="bg-secondary-container p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between h-48">
          <div className="z-10 relative">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-secondary-container/70">
              Outbound
            </span>
            <h3 className="text-4xl font-black text-on-secondary-container mt-1">
              {loadingOrders ? '—' : PAD2(readyForPickup)}
            </h3>
            <p className="text-sm font-medium text-on-secondary-container/80">Ready for Pickup</p>
          </div>
          <div className="z-10 relative flex items-center gap-2">
            <span className="text-xs font-bold py-1 px-3 bg-on-secondary-container/10 rounded-full text-on-secondary-container">
              {urgentReady > 0 ? `${urgentReady} urgent` : 'On track'}
            </span>
          </div>
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl text-on-secondary-container/10 -rotate-12 pointer-events-none">
            shopping_bag
          </span>
        </div>

        {/* System Connectivity */}
        <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-outline-variant/10">
          <h3 className="font-bold text-on-surface-variant mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">hub</span>
            System Connectivity
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-2xl">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  apiStatus === 'connected'
                    ? 'bg-primary/10 text-primary'
                    : apiStatus === 'connecting'
                    ? 'bg-secondary-container/40 text-on-secondary-container'
                    : 'bg-error-container/40 text-error'
                }`}>
                  <span className="material-symbols-outlined text-sm">
                    {apiStatus === 'connected' ? 'sync_alt' : apiStatus === 'connecting' ? 'sync' : 'sync_problem'}
                  </span>
                </div>
                <span className="text-sm font-bold">API Server</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                apiStatus === 'connected'
                  ? 'bg-primary/10 text-primary'
                  : apiStatus === 'connecting'
                  ? 'bg-secondary-container/40 text-on-secondary-container'
                  : 'bg-error-container/40 text-error'
              }`}>
                {apiStatus === 'connected' ? 'CONNECTED' : apiStatus === 'connecting' ? 'CONNECTING…' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-sm">language</span>
                </div>
                <span className="text-sm font-bold">Network Latency</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black">
                {pingMs !== null ? `${pingMs}ms` : '— ms'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Visual Data / Order Flow ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Active Load Monitor */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="p-6 flex justify-between items-center border-b border-surface-container">
            <h3 className="text-lg font-extrabold">Active Load Monitor</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Demo data
            </span>
          </div>
          <div className="p-8 aspect-[21/9] bg-gradient-to-b from-primary/5 to-transparent relative flex items-end gap-1">
            {LOAD_BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-lg transition-all duration-700"
                style={{
                  height: `${h}%`,
                  backgroundColor: `oklch(0.39 0.12 145 / ${h / 100})`,
                }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-4 py-2 bg-white/90 backdrop-blur shadow-xl rounded-2xl flex items-center gap-3 border border-primary/20">
                <span className="material-symbols-outlined text-primary">trending_up</span>
                <span className="text-sm font-bold">Hourly load — analytics pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Availability */}
        <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">
              Staff Availability
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Demo
            </span>
          </div>
          <div className="space-y-4 flex-1">
            {STAFF.map((member) => (
              <div
                key={member.name}
                className={`flex items-center gap-4 ${!member.available ? 'opacity-50' : ''}`}
              >
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-12 h-12 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{member.name}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium">
                    {member.role} • {member.station}
                  </p>
                </div>
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    member.available ? 'bg-primary' : 'bg-surface-container-highest'
                  }`}
                />
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            className="mt-6 w-full py-3 h-auto bg-surface-container-lowest text-primary text-xs font-black uppercase tracking-tighter rounded-2xl hover:bg-white transition-colors"
            disabled
          >
            Assign Station
          </Button>
        </div>
      </section>
    </div>
  );
}
