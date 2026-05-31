import { NavLink } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  Store,
  ClipboardList,
  Tag,
  Users,
  Sparkles,
} from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/features/users/utils/format';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Restaurants', url: '/restaurants', icon: Store },
  { title: 'Orders', url: '/orders', icon: ClipboardList },
  { title: 'Promotions', url: '/promotions', icon: Tag },
  { title: 'Users', url: '/users', icon: Users },
];

export function AdminSidebar() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? 'Admin';
  const email = session?.user?.email ?? '';

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-card border-r relative overflow-hidden">
      {/* Decorative brand gradient */}
      <div className="pointer-events-none absolute -top-20 -left-12 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute top-32 -right-16 h-40 w-40 rounded-full bg-secondary/10 blur-3xl" />

      {/* Brand */}
      <div className="relative px-6 pt-6 pb-5 border-b">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-700 shadow-lg shadow-primary/25">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-secondary" />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold leading-tight text-on-surface font-headline">
              SoLi
            </span>
            <span className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
              Admin Portal
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 px-3 py-4">
        <div className="px-3 mb-2">
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Workspace
          </p>
        </div>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.url}>
              <NavLink
                to={item.url}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-200/80 to-primary-200/30 text-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active indicator strip on the left */}
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />
                    )}
                    <item.icon
                      className={`h-5 w-5 transition-transform ${
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:scale-110'
                      }`}
                    />
                    <span className="flex-1">{item.title}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* "Pro tip" decorative card */}
        <div className="mt-6 px-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-700 to-primary-800 p-4 text-primary-foreground shadow-md">
            <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
            <Sparkles className="h-5 w-5 mb-2 text-secondary-300" />
            <p className="text-xs font-bold leading-tight">
              Keep an eye on pending reviews
            </p>
            <p className="text-[11px] mt-1 text-primary-foreground/70 leading-snug">
              New restaurant applications appear at the top of the queue.
            </p>
          </div>
        </div>
      </nav>

      {/* User card */}
      <div className="relative border-t p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-container transition-colors">
          <Avatar className="h-9 w-9 ring-2 ring-primary/20 shrink-0">
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary-700 text-primary-foreground text-xs font-bold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-on-surface truncate leading-tight">
              {name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {email}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
