import type { UnitOfWorkContext } from './unit-of-work-context';

export const RESTAURANT_ACCESS_PORT = Symbol('RESTAURANT_ACCESS_PORT');

export interface IRestaurantAccessPort {
  assertOwner(restaurantId: string, userId: string): Promise<void>;
  incrementRating(
    restaurantId: string,
    stars: number,
    context?: UnitOfWorkContext,
  ): Promise<void>;
}
