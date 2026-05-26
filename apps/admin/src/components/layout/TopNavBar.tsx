import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Bell,
  Settings,
  ChevronDown,
  User,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { getInitials } from '@/features/users/utils/format';

const PAGE_TITLES: Record<string, string> = {
  '/restaurants': 'Restaurants',
  '/orders': 'Platform Orders',
  '/promotions': 'Promotions',
  '/users': 'Users',
  '/settings': 'Settings',
};

function deriveTitle(pathname: string): string {
  // Match the most specific known route first
  const sorted = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const path of sorted) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return PAGE_TITLES[path];
    }
  }
  return 'Admin';
}

export function TopNavBar() {
  const { data: session } = useSession();
  const { logout, isLoggingOut } = useLogout();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  const user = session?.user;
  const name = user?.name ?? 'Admin';
  const email = user?.email ?? '';
  const title = deriveTitle(location.pathname);

  return (
    <header className="sticky top-0 z-30 h-16 shrink-0 border-b bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/70 flex items-center justify-between px-6 gap-4">
      {/* Left: page title */}
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
          Admin Portal
        </p>
        <h1 className="text-base font-bold text-on-surface truncate">
          {title}
        </h1>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        {/* Notifications */}
        <DropdownMenu
          open={showNotifications}
          onOpenChange={setShowNotifications}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <button className="text-[11px] font-medium text-primary hover:underline">
                  Mark all read
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-3 py-8 text-center">
                <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-on-surface">
                  You're all caught up
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  New alerts about restaurants and users will appear here.
                </p>
              </div>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings shortcut */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Settings"
        >
          <Link to="/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full px-1.5 py-1 hover:bg-surface-container transition-colors">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarImage src={user?.image ?? undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-700 text-primary-foreground text-xs font-bold">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left min-w-0">
                <p className="text-xs font-semibold text-on-surface leading-tight truncate max-w-[140px]">
                  {name}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Administrator
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <div className="px-3 py-3 border-b">
                <p className="text-sm font-semibold text-on-surface truncate">
                  {name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 w-full">
                  <User className="h-4 w-4 shrink-0" />
                  <span>Account settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 w-full">
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>Preferences</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                disabled={isLoggingOut}
                className="text-red-600 focus:text-red-600 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{isLoggingOut ? 'Signing out…' : 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
