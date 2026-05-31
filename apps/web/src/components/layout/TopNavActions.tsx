import { useNavigate } from 'react-router-dom';
import { Bell, Settings, LogOut, User } from 'lucide-react';
import { useInbox } from '@/features/dashboard/hooks/useInbox';
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
  const { data: inbox } = useInbox();
  const user = session?.user;
  const unreadCount = inbox?.unreadCount || 0;

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground hover:bg-black/10 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {inbox?.items?.length ? (
              <div className="max-h-80 overflow-y-auto">
                {inbox.items.map((item) => (
                  <DropdownMenuItem key={item.id} className="flex flex-col items-start gap-1 p-3 cursor-default focus:bg-surface-container-low">
                    <div className="flex justify-between w-full">
                      <span className="font-semibold text-sm">{item.title}</span>
                      {!item.isRead && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-pre-wrap">{item.body}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                there's no incoming notification
              </div>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings */}
      <button
        type="button"
        aria-label="Settings"
        onClick={() => navigate('/settings')}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground hover:bg-black/10 transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Divider */}
      <div className="mx-1 h-6 w-px bg-primary-foreground/30" />

      {/* Profile dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="User profile"
            className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-black/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
          >
            <Avatar className="h-8 w-8">
              {user?.image && <AvatarImage src={user.image} alt={displayName} />}
              <AvatarFallback className="bg-primary-foreground text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-primary-foreground hidden sm:block max-w-[160px] truncate">
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
