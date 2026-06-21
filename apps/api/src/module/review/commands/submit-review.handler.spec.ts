import { ConflictException } from '@nestjs/common';
import type { EventBus } from '@nestjs/cqrs';
import { ReviewSubmittedEvent } from '@/shared/events/review-submitted.event';
import type { ReviewRepository } from '../repositories/review.repository';
import { SubmitReviewCommand } from './submit-review.command';
import { SubmitReviewHandler } from './submit-review.handler';

const review = {
  id: 'review-1',
  orderId: 'order-1',
  customerId: 'customer-1',
  restaurantId: 'restaurant-1',
  stars: 5,
  comment: 'Excellent',
  tags: ['delicious'],
  moderationStatus: 'visible',
  moderationReason: null,
  createdAt: new Date('2026-06-21T00:00:00Z'),
  updatedAt: new Date('2026-06-21T00:00:00Z'),
} as const;

function setup() {
  const reviewRepo = {
    findByOrderId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(review),
  };
  const eventBus = { publish: jest.fn() };
  const orderPort = {
    checkEligibility: jest
      .fn()
      .mockResolvedValue({ restaurantId: 'restaurant-1' }),
    markReviewed: jest.fn().mockResolvedValue(undefined),
  };
  const restaurantPort = {
    assertOwner: jest.fn(),
    incrementRating: jest.fn().mockResolvedValue(undefined),
  };

  const db = {
    transaction: jest.fn(
      async (work: (transaction: object) => Promise<unknown>) =>
        work({ kind: 'transaction' }),
    ),
  };

  const handler = new SubmitReviewHandler(
    reviewRepo as unknown as ReviewRepository,
    eventBus as unknown as EventBus,
    orderPort,
    restaurantPort,
    db as never,
  );

  return { handler, reviewRepo, eventBus, orderPort, restaurantPort };
}

describe('SubmitReviewHandler boundaries', () => {
  it('updates foreign contexts only through their public ports', async () => {
    const { handler, reviewRepo, eventBus, orderPort, restaurantPort } =
      setup();

    const result = await handler.execute(
      new SubmitReviewCommand('order-1', 'customer-1', 5, 'Excellent', [
        'delicious',
      ]),
    );

    expect(result).toBe(review);
    expect(reviewRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        restaurantId: 'restaurant-1',
      }),
      expect.objectContaining({ transaction: { kind: 'transaction' } }),
    );
    expect(restaurantPort.incrementRating).toHaveBeenCalledWith(
      'restaurant-1',
      5,
      expect.objectContaining({ transaction: { kind: 'transaction' } }),
    );
    expect(orderPort.markReviewed).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ transaction: { kind: 'transaction' } }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(ReviewSubmittedEvent),
    );
  });

  it('does not call integration ports for a duplicate review', async () => {
    const { handler, reviewRepo, orderPort, restaurantPort } = setup();
    reviewRepo.findByOrderId.mockResolvedValue(review);

    await expect(
      handler.execute(
        new SubmitReviewCommand(
          'order-1',
          'customer-1',
          5,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(orderPort.checkEligibility).not.toHaveBeenCalled();
    expect(restaurantPort.incrementRating).not.toHaveBeenCalled();
  });
});
