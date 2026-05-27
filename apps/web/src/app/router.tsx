import { withFaroRouterInstrumentation } from '@grafana/faro-react';
import { createBrowserRouter } from 'react-router-dom';
import { RegisterPage } from '@/app/pages/auth/register/RegisterPage';
import { RegisterLocationPage } from '@/app/pages/auth/register/RegisterBusinessPage';
import { RegisterPendingPage } from '@/app/pages/auth/register/RegisterPendingPage';
import { LoginPage } from '@/app/pages/auth/login/LoginPage';
import { PendingApprovalPage } from '@/app/pages/auth/PendingApprovalPage';
import { DashboardPage } from '@/app/pages/dashboard/DashboardPage';
import { MenuManagementPage } from '@/app/pages/menu/MenuManagementPage';
import CreateMenuItemPage from '@/app/pages/menu/CreateMenuItemPage';
import EditMenuItemPage from '@/app/pages/menu/EditMenuItemPage';
import { OrdersPage } from '@/app/pages/orders/OrdersPage';
import { OrderDetailPage } from '@/app/pages/orders/OrderDetailPage';
import { DeliveryZonesPage } from '@/app/pages/delivery-zones/DeliveryZonesPage';
import { SettingsPage } from '@/app/pages/settings/SettingsPage';
import { MainLayout } from '@/components/layout/MainLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireRestaurantAccess } from '@/components/auth/RequireRestaurantAccess';
import { RootRedirect } from '@/components/auth/RootRedirect';

export const router = withFaroRouterInstrumentation(createBrowserRouter([
  {
    path: '/auth/register',
    element: <RegisterPage />,
  },
  {
    path: '/auth/register/business',
    element: <RegisterLocationPage />,
  },
  {
    path: '/auth/register/pending',
    element: <RegisterPendingPage />,
  },
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      // Root redirect — decides where a logged-in user should land. Lives
      // OUTSIDE RequireRestaurantAccess so role='user' can still reach it
      // (and get routed to /auth/register/business when they don't own a
      // restaurant yet — first-time Google sign-in flow).
      { path: '/', element: <RootRedirect /> },

      // Pending approval — accessible to any authenticated non-restaurant user.
      {
        path: 'pending-approval',
        element: <PendingApprovalPage />,
      },

      // Restaurant routes — blocked for non-restaurant roles.
      {
        element: <RequireRestaurantAccess />,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                path: 'dashboard',
                element: <DashboardPage />,
                handle: { breadcrumb: 'Dashboard' },
              },
              {
                path: 'orders',
                handle: { breadcrumb: 'Orders' },
                children: [
                  { index: true, element: <OrdersPage /> },
                  {
                    path: ':orderId',
                    element: <OrderDetailPage />,
                    handle: { breadcrumb: 'Order Detail' },
                  },
                ],
              },
              {
                path: 'menu',
                handle: { breadcrumb: 'Menu' },
                children: [
                  { index: true, element: <MenuManagementPage /> },
                  {
                    path: 'create',
                    element: <CreateMenuItemPage />,
                    handle: { breadcrumb: 'Create Item' },
                  },
                  {
                    path: 'edit/:itemId',
                    element: <EditMenuItemPage />,
                    handle: { breadcrumb: 'Edit Item' },
                  },
                ],
              },
              {
                path: 'delivery-zones',
                element: <DeliveryZonesPage />,
                handle: { breadcrumb: 'Delivery Zones' },
              },
              {
                path: 'settings',
                element: <SettingsPage />,
                handle: { breadcrumb: 'Settings' },
              },
            ],
          },
        ],
      },
    ],
  },
]));
