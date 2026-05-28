import { describeRouteTelemetry } from './route-telemetry';

describe('describeRouteTelemetry', () => {
  it.each([
    ['/api/menu-items', 'menu-items', '/api/menu-items'],
    [
      '/api/menu-items/22222222-2222-4222-9222-222222222222/image',
      'menu-items',
      '/api/menu-items/:id/image',
    ],
    ['api/restaurants/', 'restaurants', '/api/restaurants'],
    [
      '/api/restaurants/11111111-1111-4111-9111-111111111111',
      'restaurants',
      '/api/restaurants/:id',
    ],
    ['/api/search?q=pho', 'search', '/api/search'],
    ['/api/promotions/active', 'promotions', '/api/promotions/active'],
    ['/api/promotion/active', 'promotions', '/api/promotion/active'],
    ['/api/carts/my/items', 'carts', '/api/carts/my/items'],
    ['/api/my', 'my', '/api/my'],
    [
      '/api/restaurant/orders/active',
      'restaurant',
      '/api/restaurant/orders/active',
    ],
    ['/api/restaurnent/orders', 'restaurant', '/api/restaurnent/orders'],
    ['/api/payments/vnpay/return', 'payments', '/api/payments/vnpay/return'],
    ['/api/payment/vnpay/return', 'payments', '/api/payment/vnpay/return'],
  ])('groups %s as %s', (path, expectedRouteGroup, expectedRouteTemplate) => {
    expect(describeRouteTelemetry(path)).toMatchObject({
      routeGroup: expectedRouteGroup,
      routeTemplate: expectedRouteTemplate,
      monitoredRoute: true,
    });
  });

  it('marks my routes with a route scope without overriding their route group', () => {
    expect(describeRouteTelemetry('/api/carts/my')).toMatchObject({
      routeGroup: 'carts',
      routeScope: 'my',
    });
  });

  it('keeps unlisted endpoints queryable as other', () => {
    expect(describeRouteTelemetry('/api/notifications/my')).toMatchObject({
      routeGroup: 'other',
      routeTemplate: '/api/notifications/my',
      routeScope: 'my',
      monitoredRoute: false,
    });
  });
});
