import { withFaroRouterInstrumentation } from '@grafana/faro-react';
import { createBrowserRouter } from 'react-router-dom';
import { FaroErrorBoundary } from '@/lib/observability';
import { PageErrorFallback } from '@/app/PageErrorFallback';
import { RegisterPage } from '@/app/pages/auth/register/RegisterPage';
import { RegisterLocationPage } from '@/app/pages/auth/register/RegisterBusinessPage';
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
import {
  RequireOnboardingStep,
  RootRedirect,
} from '@/components/auth/RootRedirect';
import { PromotionsPage } from '@/app/pages/promotions/PromotionsPage';
import { PromotionFormPage } from '@/app/pages/promotions/PromotionFormPage';
import { LandingPage } from '@/app/pages/landing/LandingPage';

export const router = withFaroRouterInstrumentation(createBrowserRouter([
  {
    // Public marketing landing. Workspace and onboarding redirects happen only
    // after explicit authentication actions.
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/auth/register',
    element: <RegisterPage />,
  },
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/onboarding',
    element: <RootRedirect unauthenticatedTo="/auth/register" />,
  },
  {
    path: '/auth/callback',
    element: <RootRedirect />,
  },
  {
    element: <RequireAuth />,
    children: [
      // Onboarding routes are guarded by persisted restaurant ownership.
      {
        element: <RequireOnboardingStep step="business" />,
        children: [
          {
            path: 'auth/register/business',
            element: <RegisterLocationPage />,
          },
        ],
      },
      {
        path: 'auth/register/pending',
        element: <RootRedirect />,
      },
      {
        element: <RequireOnboardingStep step="pending" />,
        children: [
          {
            path: 'pending-approval',
            element: <PendingApprovalPage />,
          },
        ],
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
