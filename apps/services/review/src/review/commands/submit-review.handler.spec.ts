import { ConflictException } from '@nestjs/common';
import { EVENT_NAMES } from '@uitfood/contracts';

import type { ReviewRepository } from '../repositories/review.repository';
import { SubmitReviewCommand } from './submit-review.command';
import { SubmitReviewHandler } from './submit-review.handler';

const review = {
  id: '00000000-0000-4000-8000-000000000001',
  orderId: '00000000-0000-4000-8000-000000000002',
  customerId: '00000000-0000-4000-8000-000000000003',
  restaurantId: '00000000-0000-4000-8000-000000000004',
  stars: 5,
  comment: 'Excellent',
  tags: ['fresh_food'],
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
  const orderPort = {
    checkEligibility: jest.fn().mockResolvedValue({
      restaurantId: '00000000-0000-4000-8000-000000000004',
    }),
  };
  const outbox = { write: jest.fn().mockResolvedValue(undefined) };

  const db = {
    transaction: jest.fn(
      async (work: (transaction: object) => Promise<unknown>) =>
        work({ kind: 'transaction' }),
    ),
  };

  const handler = new SubmitReviewHandler(
    reviewRepo as unknown as ReviewRepository,
    orderPort,
    outbox,
    db,
  );

  return { handler, reviewRepo, orderPort, outbox };
}

describe('SubmitReviewHandler', () => {
  it('persists the review and review.submitted event in one transaction', async () => {
    const { handler, reviewRepo, orderPort, outbox } = setup();

    const result = await handler.execute(
      new SubmitReviewCommand(
        review.orderId,
        review.customerId,
        5,
        'Excellent',
        ['fresh_food'],
      ),
    );

    expect(result).toBe(review);
    expect(orderPort.checkEligibility).toHaveBeenCalledWith(
      review.orderId,
      review.customerId,
    );
    expect(reviewRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: review.orderId,
        restaurantId: review.restaurantId,
      }),
      expect.objectContaining({ transaction: { kind: 'transaction' } }),
    );

    expect(outbox.write).toHaveBeenCalledTimes(1);
    const [tx, envelope] = outbox.write.mock.calls[0];
    expect(tx).toEqual({ kind: 'transaction' });
    expect(envelope).toMatchObject({
      eventType: EVENT_NAMES.ReviewSubmitted,
      eventVersion: 1,
      aggregateId: review.id,
      producer: 'review-service',
      payload: {
        reviewId: review.id,
        orderId: review.orderId,
        restaurantId: review.restaurantId,
        stars: 5,
      },
    });
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects a duplicate review before eligibility or transaction work', async () => {
    const { handler, reviewRepo, orderPort, outbox } = setup();
    reviewRepo.findByOrderId.mockResolvedValue(review);

    await expect(
      handler.execute(
        new SubmitReviewCommand(
          review.orderId,
          review.customerId,
          5,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(orderPort.checkEligibility).not.toHaveBeenCalled();
    expect(reviewRepo.create).not.toHaveBeenCalled();
    expect(outbox.write).not.toHaveBeenCalled();
  });

  it('maps the unique-violation race to a 409 conflict', async () => {
    const { handler, reviewRepo } = setup();
    reviewRepo.create.mockRejectedValue({ code: '23505' });

    await expect(
      handler.execute(
        new SubmitReviewCommand(
          review.orderId,
          review.customerId,
          5,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
