import { ConflictException } from '@nestjs/common';
import { EVENT_NAMES } from '@uitfood/contracts';
import type { OutboxWriter } from '@/messaging/outbox/outbox.writer';
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
  const orderPort = {
    checkEligibility: jest
      .fn()
      .mockResolvedValue({ restaurantId: 'restaurant-1' }),
    markReviewed: jest.fn().mockResolvedValue(undefined),
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
    outbox as unknown as OutboxWriter,
    db as never,
  );

  return { handler, reviewRepo, orderPort, outbox };
}

describe('SubmitReviewHandler (Phase 2 — outbox, no cross-context UoW)', () => {
  it('persists the review and a review.submitted outbox event in ONE transaction', async () => {
    const { handler, reviewRepo, orderPort, outbox } = setup();

    const result = await handler.execute(
      new SubmitReviewCommand('order-1', 'customer-1', 5, 'Excellent', [
        'delicious',
      ]),
    );

    expect(result).toBe(review);

    // Review inserted inside the transaction.
    expect(reviewRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', restaurantId: 'restaurant-1' }),
      expect.objectContaining({ transaction: { kind: 'transaction' } }),
    );

    // Outbox event written inside the SAME transaction.
    expect(outbox.write).toHaveBeenCalledTimes(1);
    const [tx, envelope] = outbox.write.mock.calls[0];
    expect(tx).toEqual({ kind: 'transaction' });
    expect(envelope).toMatchObject({
      eventType: EVENT_NAMES.ReviewSubmitted,
      eventVersion: 1,
      aggregateId: 'review-1',
      producer: 'monolith',
      payload: {
        reviewId: 'review-1',
        orderId: 'order-1',
        restaurantId: 'restaurant-1',
        stars: 5,
      },
    });
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);

    // The cross-context reviewed-marker is NO LONGER written here — it is a
    // downstream event consumer now.
    expect(orderPort.markReviewed).not.toHaveBeenCalled();
  });

  it('rejects a duplicate review before any eligibility/transaction work', async () => {
    const { handler, reviewRepo, orderPort, outbox } = setup();
    reviewRepo.findByOrderId.mockResolvedValue(review);

    await expect(
      handler.execute(
        new SubmitReviewCommand('order-1', 'customer-1', 5, undefined, undefined),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(orderPort.checkEligibility).not.toHaveBeenCalled();
    expect(reviewRepo.create).not.toHaveBeenCalled();
    expect(outbox.write).not.toHaveBeenCalled();
  });

  it('maps a unique-violation (23505) race to a 409 conflict', async () => {
    const { handler, reviewRepo } = setup();
    reviewRepo.create.mockRejectedValue({ code: '23505' });

    await expect(
      handler.execute(
        new SubmitReviewCommand('order-1', 'customer-1', 5, undefined, undefined),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
