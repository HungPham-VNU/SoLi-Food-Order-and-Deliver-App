import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type {
  AdminReviewListRequest,
  AdminReviewListResponse,
  ListRestaurantReviewsRequest,
  PublicReviewListResponse,
  ReviewResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
} from '@uitfood/contracts';
import { SubmitReviewCommand } from '../commands/submit-review.command';
import type { Review } from '../domain/review.schema';
import { ReviewRepository } from '../repositories/review.repository';

@Injectable()
export class ReviewService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly reviewRepo: ReviewRepository,
  ) {}

  async submit(
    dto: Omit<SubmitReviewRequest, 'internalAuth'>,
    customerId: string,
  ): Promise<SubmitReviewResponse> {
    const review = await this.commandBus.execute<SubmitReviewCommand, Review>(
      new SubmitReviewCommand(
        dto.orderId,
        customerId,
        dto.stars,
        dto.comment,
        dto.tags,
      ),
    );
    return {
      ...this.toResponseDto(review),
      message: 'Thank you for your review.',
    };
  }

  async listRestaurantReviews(
    request: ListRestaurantReviewsRequest,
  ): Promise<PublicReviewListResponse> {
    const { data, total } = await this.reviewRepo.findByRestaurantId(
      request.restaurantId,
      request.page,
      request.limit,
    );
    return {
      data: data.map((r) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        tags: this.tags(r),
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: request.page,
      limit: request.limit,
    };
  }

  async listRestaurantReviewsAdmin(
    request: AdminReviewListRequest,
  ): Promise<AdminReviewListResponse> {
    const { data, total, averageRating, ratingDistribution } =
      await this.reviewRepo.findAdminByRestaurantId(
        request.restaurantId,
        request.page,
        request.limit,
      );
    return {
      data: data.map((r) => ({
        ...this.toResponseDto(r),
        moderationReason: r.moderationReason,
      })),
      total,
      averageRating,
      ratingDistribution,
    };
  }

  async getMyReview(
    orderId: string,
    customerId: string,
  ): Promise<ReviewResponse> {
    const review = await this.reviewRepo.findByOrderIdAndCustomerId(
      orderId,
      customerId,
    );
    if (!review) {
      throw new NotFoundException({
        message: 'Review not found.',
        code: 'MSG-RATE-05',
      });
    }
    return this.toResponseDto(review);
  }

  private toResponseDto(review: Review): ReviewResponse {
    return {
      id: review.id,
      orderId: review.orderId,
      customerId: review.customerId,
      restaurantId: review.restaurantId,
      stars: review.stars,
      comment: review.comment,
      tags: this.tags(review),
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt.toISOString(),
    };
  }

  private tags(review: Review): ReviewResponse['tags'] {
    return review.tags as ReviewResponse['tags'];
  }
}
