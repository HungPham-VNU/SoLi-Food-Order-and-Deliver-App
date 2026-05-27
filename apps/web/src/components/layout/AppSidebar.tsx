import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  LayoutDashboard,
  ClipboardList,
  Utensils,
  Map,
  Settings,
  CircleHelp,
  LogOut,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { signOut } from '@/lib/auth-client';
import { resetAnalyticsIdentity } from '@/lib/analytics';
import { Sentry } from '@/lib/observability';
import { useLogout } from '@/features/auth/hooks/useLogout';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Orders', url: '/orders', icon: ClipboardList },
  { title: 'Menu', url: '/menu', icon: Utensils },
  { title: 'Delivery Zones', url: '/delivery-zones', icon: Map },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const footerNavItems = [
  {
    title: 'Help',
    url: '/help',
    icon: CircleHelp,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      resetAnalyticsIdentity();
      Sentry.setUser(null);
      navigate('/auth/login', { replace: true });
    }
  };

  return (
    <Sidebar className="bg-card">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-200">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight text-primary">
              SoLi Food
            </span>
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground">
              MANAGEMENT PORTAL
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarMenu className="gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={
                    isActive
                      ? 'bg-primary-200 text-primary hover:bg-primary-200 hover:text-primary'
                      : 'text-on-surface-variant'
                  }
                >
                  <Link to={item.url} className="flex items-center gap-3 py-6">
                    <item.icon
                      className={
                        isActive ? 'text-primary' : 'text-on-surface-variant'
                      }
                    />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 gap-4">
        <SidebarMenu className="gap-1">
          {footerNavItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                className="text-on-surface-variant hover:bg-surface-container"
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon
                    className={item.className || 'text-on-surface-variant'}
                  />
                  <span className={item.className || 'font-medium'}>
                    {item.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              onClick={handleSignOut}
              className="text-on-surface-variant hover:bg-surface-container"
            >
              <LogOut className="text-error" />
              <span className="text-error">Logout</span>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="text-on-surface-variant hover:bg-surface-container"
            >
              <Link to={helpItem.url} className="flex items-center gap-3">
                <helpItem.icon className="text-on-surface-variant" />
                <span className="font-medium">{helpItem.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              disabled={isLoggingOut}
              className="text-error hover:bg-error/10 hover:text-error focus-visible:text-error active:text-error disabled:opacity-50"
            >
              <LogOut className="text-error" />
              <span className="font-medium text-error">
                {isLoggingOut ? 'Logging out…' : 'Logout'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
