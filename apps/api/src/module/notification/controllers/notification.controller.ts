import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DevOnlyGuard } from '@/lib/guards/dev-only.guard';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { NotificationService } from '../services/notification.service';
import { TestPushService } from '../services/test-push.service';
import {
  MarkAllReadResponseDto,
  MarkReadResponseDto,
  NotificationInboxQueryDto,
  NotificationInboxResponseDto,
  UnreadCountResponseDto,
} from '../dto/notification.dto';
import {
  RegisterPushTokenDto,
  RegisterPushTokenResponseDto,
  RemovePushTokenDto,
  RemovePushTokenResponseDto,
  PushTokenListResponseDto,
} from '../dto/device-token.dto';
import {
  NotificationPreferenceResponseDto,
  UpdateNotificationPreferenceDto,
} from '../dto/preference.dto';
import { TestPushDto, TestPushResponseDto } from '../dto/test-push.dto';
import { TestEmailDto, TestEmailResponseDto } from '../dto/test-email.dto';
import { TestEmailService } from '../services/test-email.service';

/**
 * NotificationController
 *
 * Exposes the notification-related REST API.
 *
 * All routes are protected by the Better Auth session guard — the `@Session()`
 * decorator verifies the Bearer token and populates `session.user.id`.
 *
 * Routes:
 *  GET  /notifications/my            — paginated in-app inbox
 *  GET  /notifications/my/unread-count — cached unread badge count
 *  GET  /notifications/my/preferences  — notification delivery preferences
 *  PATCH /notifications/my/read-all  — bulk mark all as read
 *  PATCH /notifications/my/preferences — update delivery preferences
 *  GET   /notifications/my/push-tokens — list all registered push tokens (masked)
 *  POST  /notifications/my/push-tokens — register a push device token
 *  DELETE /notifications/my/push-tokens — deactivate a push device token
 *  PATCH /notifications/:id/read     — mark single notification as read
 *
 * Route ordering note:
 *  All static sub-paths (`my/...`) are registered BEFORE the parameterised
 *  `:id/read` route. NestJS prioritises static segments over parameterised
 *  ones, preventing the literal string `my` from being treated as a UUID.
 *
 * Phase: N-3 — Inbox REST API
 * Phase: N-4 — Push Token + Preference Management
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly testPushService: TestPushService,
    private readonly testEmailService: TestEmailService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /notifications/my
  // ---------------------------------------------------------------------------

  /**
   * Return a paginated page of the caller's in-app notification inbox.
   *
   * Query parameters:
   *  - unreadOnly (boolean, default: false) — filter to unread only
   *  - type (NotificationType)              — filter by notification type
   *  - limit (1–100, default: 20)           — page size
   *  - offset (≥ 0, default: 0)            — pagination offset
   *
   * The `unreadCount` field in the response reflects the caller's total
   * unread count (from Redis cache or DB fallback) — not just for this page.
   */
  @Get('my')
  @ApiOperation({
    summary: "Get current user's in-app notification inbox (paginated)",
  })
  @ApiOkResponse({ type: NotificationInboxResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getInbox(
    @Session() session: UserSession,
    @Query() query: NotificationInboxQueryDto,
  ): Promise<NotificationInboxResponseDto> {
    return this.notificationService.getInbox(session.user.id, query);
  }

  // ---------------------------------------------------------------------------
  // GET /notifications/my/unread-count
  // ---------------------------------------------------------------------------

  /**
   * Return the total unread in-app notification count for the current user.
   *
   * Redis-cached (TTL: 5 minutes). Invalidated immediately on any write
   * operation (markRead, markAllRead, new notification received).
   *
   * Lightweight endpoint intended for polling or badge refresh without
   * fetching the full inbox.
   */
  @Get('my/unread-count')
  @ApiOperation({
    summary: "Get current user's total unread notification count (cached)",
  })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getUnreadCount(
    @Session() session: UserSession,
  ): Promise<UnreadCountResponseDto> {
    const count = await this.notificationService.getUnreadCount(
      session.user.id,
    );
    return { count };
  }

  // ---------------------------------------------------------------------------
  // PATCH /notifications/my/read-all
  // ---------------------------------------------------------------------------

  /**
   * Mark all of the caller's unread in-app notifications as read.
   *
   * Idempotent: safe to call when there are no unread notifications
   * (returns count = 0).
   *
   * After the bulk update:
   *  - Redis unread cache is invalidated.
   *  - A `notification.read` WS event (`{ all: true }`) is emitted to the
   *    caller's room so that all open tabs clear their unread indicators.
   */
  @Patch('my/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Mark all current user's unread notifications as read",
  })
  @ApiOkResponse({ type: MarkAllReadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async markAllRead(
    @Session() session: UserSession,
  ): Promise<MarkAllReadResponseDto> {
    const count = await this.notificationService.markAllRead(session.user.id);
    return { count };
  }

  // ---------------------------------------------------------------------------
  // PATCH /notifications/:id/read
  // NOTE: defined AFTER the static /my/** routes to avoid `:id` capturing `my`
  // ---------------------------------------------------------------------------

  /**
   * Mark a single notification as read.
   *
   * Ownership is enforced at the DB level — a notification belonging to
   * another user returns `{ success: false }` without revealing whether the
   * notification exists (no 404 leakage).
   *
   * Idempotent: calling this on an already-read notification returns
   * `{ success: true }` if the row exists (the DB mark-read is a no-op
   * when `is_read` is already true — the WHERE clause filters on ownership,
   * not on read state).
   *
   * After a successful mark-read:
   *  - Redis unread cache is invalidated.
   *  - A `notification.read` WS event is emitted so other open tabs update.
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read (idempotent)' })
  @ApiParam({
    name: 'id',
    description: 'Notification UUID',
    format: 'uuid',
  })
  @ApiOkResponse({ type: MarkReadResponseDto })
  @ApiNotFoundResponse({
    description:
      'Notification not found or does not belong to the current user',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async markRead(
    @Session() session: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MarkReadResponseDto> {
    const success = await this.notificationService.markRead(
      session.user.id,
      id,
    );
    return { success };
  }

  // ---------------------------------------------------------------------------
  // GET /notifications/my/preferences
  // ---------------------------------------------------------------------------

  /**
   * Fetch the current user's notification delivery preferences.
   * Returns system defaults when no preference row exists.
   */
  @Get('my/preferences')
  @ApiOperation({
    summary: "Get current user's notification delivery preferences",
  })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getPreferences(
    @Session() session: UserSession,
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationService.getPreferences(session.user.id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /notifications/my/preferences
  // ---------------------------------------------------------------------------

  /**
   * Partially update the current user's notification delivery preferences.
   *
   * Only provided fields are updated. Omitting a field retains its current
   * value (or the system default for new users).
   *
   * Use quietHoursStart: null to disable quiet hours.
   * Use email: null to clear the stored email address.
   */
  @Patch('my/preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Partially update current user's notification preferences",
  })
  @ApiBody({ type: UpdateNotificationPreferenceDto })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async updatePreferences(
    @Session() session: UserSession,
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationService.updatePreferences(session.user.id, dto);
  }

  // ---------------------------------------------------------------------------
  // GET /notifications/my/push-tokens
  // ---------------------------------------------------------------------------

  /**
   * List all push device tokens registered for the current user.
   *
   * Returns both active and inactive tokens so users can see the full history
   * of their registered devices. Token values are masked to the last 8
   * characters — full tokens are never returned from the API.
   *
   * Useful for:
   *  - Debugging missing push notifications ("is my browser token registered?")
   *  - Multi-device management UIs
   *  - Verifying that registration succeeded after calling POST
   */
  @Get('my/push-tokens')
  @ApiOperation({
    summary: "List current user's registered push device tokens",
  })
  @ApiOkResponse({ type: PushTokenListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getMyPushTokens(
    @Session() session: UserSession,
  ): Promise<PushTokenListResponseDto> {
    return this.notificationService.getMyTokens(session.user.id);
  }

  // ---------------------------------------------------------------------------
  // POST /notifications/my/push-tokens
  // ---------------------------------------------------------------------------

  /**
   * Register (or refresh) a push device token for the current user.
   *
   * Re-registering an existing token refreshes its last_seen_at timestamp
   * and re-activates it if it was previously deactivated. Idempotent.
   *
   * Tokens are used by the push delivery channel to fan-out notifications
   * to all the user's active devices.
   */
  @Post('my/push-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register or refresh a push device token',
  })
  @ApiBody({ type: RegisterPushTokenDto })
  @ApiOkResponse({ type: RegisterPushTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async registerPushToken(
    @Session() session: UserSession,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<RegisterPushTokenResponseDto> {
    return this.notificationService.registerPushToken(session.user.id, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /notifications/my/push-tokens
  // ---------------------------------------------------------------------------

  /**
   * Deactivate a push device token for the current user.
   *
   * Ownership is enforced at the DB level: only the authenticated user's
   * own tokens are affected. Deactivating a non-existent or already-inactive
   * token is a no-op (idempotent).
   *
   * The token is soft-deleted (is_active = false) rather than hard-deleted
   * so it appears in the cleanup cron candidates (Phase N-5).
   */
  @Delete('my/push-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a push device token',
  })
  @ApiBody({ type: RemovePushTokenDto })
  @ApiOkResponse({ type: RemovePushTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async removePushToken(
    @Session() session: UserSession,
    @Body() dto: RemovePushTokenDto,
  ): Promise<RemovePushTokenResponseDto> {
    return this.notificationService.removePushToken(session.user.id, dto.token);
  }

  // ---------------------------------------------------------------------------
  // POST /notifications/test/push
  // DEV / TEST ONLY — manual FCM integration testing.
  // Fenced off by DevOnlyGuard (returns 404 outside the dev/test allowlist) and
  // excluded from the public OpenAPI document.
  // ---------------------------------------------------------------------------

  /**
   * Send a test push notification to a specific FCM token.
   *
   * This endpoint is intentionally unauthenticated for ease of local testing.
   * DevOnlyGuard returns 404 whenever NODE_ENV is not in the dev/test
   * allowlist, so it is inert in production (and never advertised via a 403).
   *
   * Usage: open apps/api/public/fcm-test.html, copy the displayed FCM token,
   * then POST it here to verify the full Firebase → device delivery pipeline.
   *
   * @example
   * POST /api/notifications/test/push
   * {
   *   "token": "<fcm-registration-token>",
   *   "title": "Test Push",
   *   "body": "Hello from Notification BC"
   * }
   */
  @Post('test/push')
  @HttpCode(HttpStatus.OK)
  @AllowAnonymous()
  @UseGuards(DevOnlyGuard)
  @ApiExcludeEndpoint()
  async testPush(@Body() dto: TestPushDto): Promise<TestPushResponseDto> {
    return this.testPushService.send(dto.token, dto.title, dto.body);
  }

  // ---------------------------------------------------------------------------
  // POST /notifications/test/email
  // DEV / TEST ONLY — manual SMTP integration testing.
  // Fenced off by DevOnlyGuard (returns 404 outside the dev/test allowlist) and
  // excluded from the public OpenAPI document.
  // ---------------------------------------------------------------------------

  /**
   * Send a test email to verify the SMTP configuration end-to-end.
   *
   * This endpoint is intentionally unauthenticated for ease of local testing.
   * DevOnlyGuard returns 404 whenever NODE_ENV is not in the dev/test
   * allowlist, so it is inert in production.
   *
   * @example
   * POST /api/notifications/test/email
   * {
   *   "to": "developer@example.com",
   *   "subject": "SMTP test",
   *   "body": "Hello from Notification BC"
   * }
   */
  @Post('test/email')
  @HttpCode(HttpStatus.OK)
  @AllowAnonymous()
  @UseGuards(DevOnlyGuard)
  @ApiExcludeEndpoint()
  async testEmail(@Body() dto: TestEmailDto): Promise<TestEmailResponseDto> {
    return this.testEmailService.send(dto.to, dto.subject, dto.body);
  }
}
