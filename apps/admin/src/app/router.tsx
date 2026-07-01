import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/app/pages/auth/LoginPage';
import { AdminDashboardPage } from '@/app/pages/dashboard/AdminDashboardPage';
import { RestaurantsPage } from '@/app/pages/restaurants/RestaurantsPage';
import { RestaurantDetailPage } from '@/app/pages/restaurants/RestaurantDetailPage';
import { OrdersPage } from '@/app/pages/orders/OrdersPage';
import { PromotionsPage } from '@/app/pages/promotions/PromotionsPage';
import { PromotionFormPage } from '@/app/pages/promotions/PromotionFormPage';
import { PromotionDetailPage } from '@/app/pages/promotions/PromotionDetailPage';
import { UsersPage } from '@/app/pages/users/UsersPage';
import { SettingsPage } from '@/app/pages/settings/SettingsPage';
import { DietaryTagsPage } from '@/app/pages/dietary-tags/DietaryTagsPage';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { RequireAdminAuth } from '@/components/auth/RequireAdminAuth';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAdminAuth />,
    children: [
      {
        path: '/',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            element: <AdminDashboardPage />,
            handle: { breadcrumb: 'Dashboard' },
          },
          {
            path: 'restaurants',
            handle: { breadcrumb: 'Restaurants' },
            children: [
              { index: true, element: <RestaurantsPage /> },
              {
                path: ':id',
                element: <RestaurantDetailPage />,
                handle: { breadcrumb: 'Restaurant Details' },
              },
            ],
          },
          {
            path: 'orders',
            element: <OrdersPage />,
            handle: { breadcrumb: 'Orders' },
          },
          {
            path: 'promotions',
            handle: { breadcrumb: 'Promotions' },
            children: [
              { index: true, element: <PromotionsPage /> },
              {
                path: 'new',
                element: <PromotionFormPage />,
                handle: { breadcrumb: 'New Promotion' },
              },
              {
                path: ':id',
                element: <PromotionDetailPage />,
                handle: { breadcrumb: 'Promotion Details' },
              },
              {
                path: ':id/edit',
                element: <PromotionFormPage />,
                handle: { breadcrumb: 'Edit Promotion' },
              },
            ],
          },
          {
            path: 'users',
            element: <UsersPage />,
            handle: { breadcrumb: 'Users' },
          },
          {
            path: 'dietary-tags',
            element: <DietaryTagsPage />,
            handle: { breadcrumb: 'Dietary Tags' },
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
]);
