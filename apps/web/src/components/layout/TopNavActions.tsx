import { useNavigate } from 'react-router-dom';
import { Bell, Settings, LogOut, User } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TopNavActions() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { logout, isLoggingOut } = useLogout();
  const user = session?.user;

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {/* Notification */}
      <button
        type="button"
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error" />
      </button>

      {/* Settings */}
      <button
        type="button"
        aria-label="Settings"
        onClick={() => navigate('/settings')}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Divider */}
      <div className="mx-1 h-6 w-px bg-outline-variant/40" />

      {/* Profile dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="User profile"
            className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Avatar className="h-8 w-8">
              {user?.image && <AvatarImage src={user.image} alt={displayName} />}
              <AvatarFallback className="bg-primary text-on-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-on-surface hidden sm:block max-w-[160px] truncate">
              {displayName}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold truncate">
                {displayName}
              </span>
              {user?.email && (
                <span className="text-xs font-normal text-muted-foreground truncate">
                  {user.email}
                </span>
              )}
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={logout}
              disabled={isLoggingOut}
              className="text-error focus:bg-error/10 focus:text-error"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{isLoggingOut ? 'Logging out…' : 'Logout'}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
