import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { REVIEW_RPC_PATTERNS } from '@uitfood/contracts';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';
import type { ReviewRpcGateway } from './review.interfaces';
import { REVIEW_RPC_GATEWAY } from './review.tokens';
import { ReviewSessionGuard } from './review-session.guard';

interface SubmitReviewBody {
  orderId: string;
  stars: number;
  comment?: string;
  tags?: string[];
}

@ApiTags('Review')
@ApiBearerAuth()
@Controller('api/reviews')
export class ReviewsController {
  constructor(
    @Inject(REVIEW_RPC_GATEWAY)
    private readonly review: ReviewRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ReviewSessionGuard)
  submit(
    @Req() req: GatewayRequestWithSession,
    @Body() body: SubmitReviewBody,
  ) {
    return this.review.send(REVIEW_RPC_PATTERNS.submitReview, {
      internalAuth: this.internalJwt.issueForRequest(req, 'review'),
      orderId: body.orderId,
      stars: body.stars,
      comment: body.comment,
      tags: body.tags,
    });
  }

  @Get('restaurant/:restaurantId')
  listRestaurantReviews(
    @Param('restaurantId') restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.review.send(REVIEW_RPC_PATTERNS.listRestaurantReviews, {
      restaurantId,
      page: page < 1 ? 1 : page,
      limit: limit < 1 ? 1 : Math.min(limit, 50),
    });
  }

  @Get('my/:orderId')
  @UseGuards(ReviewSessionGuard)
  getMyReview(
    @Req() req: GatewayRequestWithSession,
    @Param('orderId') orderId: string,
  ) {
    return this.review.send(REVIEW_RPC_PATTERNS.getMyReview, {
      internalAuth: this.internalJwt.issueForRequest(req, 'review'),
      orderId,
    });
  }
}

@ApiTags('Review: Admin')
@ApiBearerAuth()
@Controller('api/admin/restaurants')
@UseGuards(ReviewSessionGuard)
export class AdminReviewsController {
  constructor(
    @Inject(REVIEW_RPC_GATEWAY)
    private readonly review: ReviewRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  @Get(':restaurantId/reviews')
  listRestaurantReviewsAdmin(
    @Req() req: GatewayRequestWithSession,
    @Param('restaurantId') restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.review.send(REVIEW_RPC_PATTERNS.listRestaurantReviewsAdmin, {
      internalAuth: this.internalJwt.issueForRequest(req, 'review'),
      restaurantId,
      page: page < 1 ? 1 : page,
      limit: limit < 1 ? 1 : Math.min(limit, 50),
    });
  }
}
