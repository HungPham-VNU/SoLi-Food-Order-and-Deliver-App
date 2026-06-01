import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { hasRole } from '@/module/auth/role.util';
import {
  PublicReviewListResponseDto,
  ReviewResponseDto,
  SubmitReviewDto,
} from '../dto/review.dto';
import type { Review } from '../domain/review.schema';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewService } from '../services/review.service';

/**
 * ReviewController
 *
 * Endpoints:
 *  POST /reviews                          → submit a review (customer only)
 *  GET  /reviews/restaurant/:restaurantId → paginated public listing
 *  GET  /reviews/my/:orderId              → caller's own review for an order
 *
 * Auth pattern matches the rest of the codebase: `@Session() session: UserSession`
 * automatically throws 401 when no valid Better Auth session exists. Role
 * enforcement is inline via `hasRole()` — no `@UseGuards(AuthGuard)` or
 * `@Roles()` decorators are used (these don't exist in this codebase).
 *
 * Phase: RV-2
 */
@ApiTags('Review')
@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewRepo: ReviewRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /reviews — submit a review for a completed order
  // ---------------------------------------------------------------------------
  @Post()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review for a completed order (UC-22)' })
  @ApiCreatedResponse({
    description: 'Review created',
    type: ReviewResponseDto,
  })
  @ApiBadRequestResponse({ description: 'MSG-RATE-01 — validation failure' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Wrong role (not a customer)' })
  @ApiNotFoundResponse({
    description: 'MSG-HIST-01 — order not found or not owned by caller',
  })
  @ApiConflictResponse({
    description: 'MSG-RATE-03 — duplicate review for this order',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'MSG-RATE-02 — order has not been completed (ready_for_pickup or delivered)',
  })
  async submitReview(
    @Body() dto: SubmitReviewDto,
    @Session() session: UserSession,
  ): Promise<ReviewResponseDto> {
    this.assertCustomerRole(session);
    const review = await this.reviewService.submit(dto, session.user.id);
    return {
      ...this.toResponseDto(review),
      message: 'Thank you for your review.',
    };
  }

  // ---------------------------------------------------------------------------
  // GET /reviews/restaurant/:restaurantId — public paginated listing
  // ---------------------------------------------------------------------------
  @Get('restaurant/:restaurantId')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'List visible reviews for a restaurant (public, paginated)',
  })
  @ApiOkResponse({
    description: 'Paginated reviews',
    type: PublicReviewListResponseDto,
  })
  @ApiParam({ name: 'restaurantId', format: 'uuid' })
  async getRestaurantReviews(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PublicReviewListResponseDto> {
    const safePage = page < 1 ? 1 : page;
    const safeLimit = limit < 1 ? 1 : Math.min(limit, 50);

    const { data, total } = await this.reviewRepo.findByRestaurantId(
      restaurantId,
      safePage,
      safeLimit,
    );

    return {
      data: data.map((r) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        tags: r.tags,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /reviews/my/:orderId — caller's own review for one order
  // ---------------------------------------------------------------------------
  @Get('my/:orderId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the caller's own review for an order" })
  @ApiOkResponse({ description: 'Review found', type: ReviewResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Wrong role (not a customer)' })
  @ApiNotFoundResponse({ description: 'MSG-RATE-05 — review not found' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  async getMyReview(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Session() session: UserSession,
  ): Promise<ReviewResponseDto> {
    this.assertCustomerRole(session);
    const review = await this.reviewRepo.findByOrderIdAndCustomerId(
      orderId,
      session.user.id,
    );
    if (!review) {
      throw new NotFoundException({
        message: 'Review not found.',
        code: 'MSG-RATE-05',
      });
    }
    return this.toResponseDto(review);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Inline role check matching the codebase convention. Any user with no
   * privileged role (admin/restaurant/shipper) is treated as 'user' (customer)
   * by Better Auth defaults, so we accept either 'user' or 'customer' to be
   * forgiving of role-string variations across the project.
   */
  private assertCustomerRole(session: UserSession): void {
    if (
      !hasRole(session.user.role, 'user') &&
      !hasRole(session.user.role, 'customer')
    ) {
      throw new ForbiddenException(
        'Only customers can submit or view their own reviews.',
      );
    }
  }

  private toResponseDto(review: Review): ReviewResponseDto {
    return {
      id: review.id,
      orderId: review.orderId,
      customerId: review.customerId,
      restaurantId: review.restaurantId,
      stars: review.stars,
      comment: review.comment,
      tags: review.tags,
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
