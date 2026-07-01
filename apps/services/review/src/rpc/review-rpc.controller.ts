import { Controller, ForbiddenException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  REVIEW_RPC_PATTERNS,
  adminReviewListRequestSchema,
  getMyReviewRequestSchema,
  listRestaurantReviewsRequestSchema,
  submitReviewRequestSchema,
  type AdminReviewListRequest,
  type GetMyReviewRequest,
  type ListRestaurantReviewsRequest,
  type SubmitReviewRequest,
} from '@uitfood/contracts';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { ReviewService } from '@/review/services/review.service';
import { asReviewRpcException } from './review-rpc.errors';

@Controller()
export class ReviewRpcController {
  constructor(
    private readonly service: ReviewService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(REVIEW_RPC_PATTERNS.submitReview)
  async submit(@Payload() p: SubmitReviewRequest) {
    try {
      const request = submitReviewRequestSchema.parse(p);
      const caller = this.auth.verifyReviewToken(request.internalAuth);
      this.assertCustomer(caller.roles);
      return await this.service.submit(
        {
          orderId: request.orderId,
          stars: request.stars,
          comment: request.comment,
          tags: request.tags,
        },
        caller.userId,
      );
    } catch (e) {
      throw asReviewRpcException(e);
    }
  }

  @MessagePattern(REVIEW_RPC_PATTERNS.listRestaurantReviews)
  async listRestaurantReviews(@Payload() p: ListRestaurantReviewsRequest) {
    try {
      const request = listRestaurantReviewsRequestSchema.parse(p);
      return await this.service.listRestaurantReviews(request);
    } catch (e) {
      throw asReviewRpcException(e);
    }
  }

  @MessagePattern(REVIEW_RPC_PATTERNS.listRestaurantReviewsAdmin)
  async listRestaurantReviewsAdmin(@Payload() p: AdminReviewListRequest) {
    try {
      const request = adminReviewListRequestSchema.parse(p);
      const caller = this.auth.verifyReviewToken(request.internalAuth);
      this.assertAdmin(caller.roles);
      return await this.service.listRestaurantReviewsAdmin(request);
    } catch (e) {
      throw asReviewRpcException(e);
    }
  }

  @MessagePattern(REVIEW_RPC_PATTERNS.getMyReview)
  async getMyReview(@Payload() p: GetMyReviewRequest) {
    try {
      const request = getMyReviewRequestSchema.parse(p);
      const caller = this.auth.verifyReviewToken(request.internalAuth);
      this.assertCustomer(caller.roles);
      return await this.service.getMyReview(request.orderId, caller.userId);
    } catch (e) {
      throw asReviewRpcException(e);
    }
  }

  private assertCustomer(roles: readonly string[]): void {
    const normalized = roles.map((role) => role.toLowerCase());
    if (!normalized.includes('user') && !normalized.includes('customer')) {
      throw new ForbiddenException(
        'Only customers can submit or view their own reviews.',
      );
    }
  }

  private assertAdmin(roles: readonly string[]): void {
    const normalized = roles.map((role) => role.toLowerCase());
    if (!normalized.includes('admin')) {
      throw new ForbiddenException('Admin role required.');
    }
  }
}
