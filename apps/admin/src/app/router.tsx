import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/app/pages/auth/LoginPage';
import { RestaurantsPage } from '@/app/pages/restaurants/RestaurantsPage';
import { OrdersPage } from '@/app/pages/orders/OrdersPage';
import { PromotionsPage } from '@/app/pages/promotions/PromotionsPage';
import { PromotionFormPage } from '@/app/pages/promotions/PromotionFormPage';
import { UsersPage } from '@/app/pages/users/UsersPage';
import { SettingsPage } from '@/app/pages/settings/SettingsPage';
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
          { index: true, element: <Navigate to="/restaurants" replace /> },
          { path: 'restaurants', element: <RestaurantsPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'promotions', element: <PromotionsPage /> },
          { path: 'promotions/new', element: <PromotionFormPage /> },
          { path: 'promotions/:id/edit', element: <PromotionFormPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
