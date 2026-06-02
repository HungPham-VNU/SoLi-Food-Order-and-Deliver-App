import { withFaroRouterInstrumentation } from '@grafana/faro-react';
import { createBrowserRouter } from 'react-router-dom';
import { FaroErrorBoundary } from '@/lib/observability';
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
import { AnalyticsPage } from '@/app/pages/analytics/AnalyticsPage';
import { SettingsPage } from '@/app/pages/settings/SettingsPage';
import { MainLayout } from '@/components/layout/MainLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireRestaurantAccess } from '@/components/auth/RequireRestaurantAccess';
import { PromotionsPage } from '@/app/pages/promotions/PromotionsPage';
import { PromotionFormPage } from '@/app/pages/promotions/PromotionFormPage';
import { LandingPage } from '@/app/pages/landing/LandingPage';

function PageErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
      <p className="text-lg font-semibold text-foreground">This page encountered an error.</p>
      <p className="text-sm text-muted-foreground">Try refreshing the page.</p>
    </div>
  );
}

export const router = withFaroRouterInstrumentation(createBrowserRouter([
  {
    // Public marketing landing. Logged-in visitors are forwarded to their
    // workspace by RootRedirect, which LandingPage renders when a session exists.
    path: '/',
    element: <LandingPage />,
  },
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
                element: <FaroErrorBoundary fallback={<PageErrorFallback />}><DashboardPage /></FaroErrorBoundary>,
                handle: { breadcrumb: 'Dashboard' },
              },
              {
                path: 'orders',
                handle: { breadcrumb: 'Orders' },
                children: [
                  { index: true, element: <FaroErrorBoundary fallback={<PageErrorFallback />}><OrdersPage /></FaroErrorBoundary> },
                  {
                    path: ':orderId',
                    element: <FaroErrorBoundary fallback={<PageErrorFallback />}><OrderDetailPage /></FaroErrorBoundary>,
                    handle: { breadcrumb: 'Order Detail' },
                  },
                ],
              },
              {
                path: 'menu',
                handle: { breadcrumb: 'Menu' },
                children: [
                  { index: true, element: <FaroErrorBoundary fallback={<PageErrorFallback />}><MenuManagementPage /></FaroErrorBoundary> },
                  {
                    path: 'create',
                    element: <FaroErrorBoundary fallback={<PageErrorFallback />}><CreateMenuItemPage /></FaroErrorBoundary>,
                    handle: { breadcrumb: 'Create Item' },
                  },
                  {
                    path: 'edit/:itemId',
                    element: <FaroErrorBoundary fallback={<PageErrorFallback />}><EditMenuItemPage /></FaroErrorBoundary>,
                    handle: { breadcrumb: 'Edit Item' },
                  },
                ],
              },
              {
                path: 'delivery-zones',
                element: <FaroErrorBoundary fallback={<PageErrorFallback />}><DeliveryZonesPage /></FaroErrorBoundary>,
                handle: { breadcrumb: 'Delivery Zones' },
              },
              {
                path: 'analytics',
                element: <FaroErrorBoundary fallback={<PageErrorFallback />}><AnalyticsPage /></FaroErrorBoundary>,
                handle: { breadcrumb: 'Analytics' },
              },
              {
                path: 'promotions',
                handle: { breadcrumb: 'Promotions' },
                children: [
                  { index: true, element: <FaroErrorBoundary fallback={<PageErrorFallback />}><PromotionsPage /></FaroErrorBoundary> },
                  {
                    path: 'new',
                    element: <FaroErrorBoundary fallback={<PageErrorFallback />}><PromotionFormPage /></FaroErrorBoundary>,
                    handle: { breadcrumb: 'New Promotion' },
                  },
                  {
                    path: ':id/edit',
                    element: <FaroErrorBoundary fallback={<PageErrorFallback />}><PromotionFormPage /></FaroErrorBoundary>,
                    handle: { breadcrumb: 'Edit Promotion' },
                  },
                ],
              },
              {
                path: 'settings',
                element: <FaroErrorBoundary fallback={<PageErrorFallback />}><SettingsPage /></FaroErrorBoundary>,
                handle: { breadcrumb: 'Settings' },
              },
            ],
          },
        ],
      },
    ],
  },
]));
