import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  NOTIFICATION_RPC_PATTERNS,
  getNotificationInboxRequestSchema,
  markNotificationReadRequestSchema,
  notificationUserRequestSchema,
  registerPushTokenRequestSchema,
  removePushTokenRequestSchema,
  testEmailRequestSchema,
  testPushRequestSchema,
  updateNotificationPreferencesRequestSchema,
  type GetNotificationInboxRequest,
  type MarkNotificationReadRequest,
  type NotificationUserRequest,
  type RegisterPushTokenRequest,
  type RemovePushTokenRequest,
  type TestEmailRequest,
  type TestPushRequest,
  type UpdateNotificationPreferencesRequest,
} from '@uitfood/contracts';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { NotificationService } from '@/notification/services/notification.service';
import { TestEmailService } from '@/notification/services/test-email.service';
import { TestPushService } from '@/notification/services/test-push.service';
import { asNotificationRpcException } from './notification-rpc.errors';

@Controller()
export class NotificationRpcController {
  constructor(
    private readonly internalAuth: InternalAuthService,
    private readonly notifications: NotificationService,
    private readonly testPush: TestPushService,
    private readonly testEmail: TestEmailService,
  ) {}

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.getInbox)
  async getInbox(@Payload() payload: GetNotificationInboxRequest) {
    try {
      const input = getNotificationInboxRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return this.notifications.getInbox(claims.sub, input.query);
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.getUnreadCount)
  async getUnreadCount(@Payload() payload: NotificationUserRequest) {
    try {
      const input = notificationUserRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return { count: await this.notifications.getUnreadCount(claims.sub) };
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.markAllRead)
  async markAllRead(@Payload() payload: NotificationUserRequest) {
    try {
      const input = notificationUserRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return { count: await this.notifications.markAllRead(claims.sub) };
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.markRead)
  async markRead(@Payload() payload: MarkNotificationReadRequest) {
    try {
      const input = markNotificationReadRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return {
        success: await this.notifications.markRead(
          claims.sub,
          input.notificationId,
        ),
      };
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.getPreferences)
  async getPreferences(@Payload() payload: NotificationUserRequest) {
    try {
      const input = notificationUserRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return this.notifications.getPreferences(claims.sub);
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.updatePreferences)
  async updatePreferences(
    @Payload() payload: UpdateNotificationPreferencesRequest,
  ) {
    try {
      const input = updateNotificationPreferencesRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return this.notifications.updatePreferences(
        claims.sub,
        input.preferences,
      );
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.listPushTokens)
  async listPushTokens(@Payload() payload: NotificationUserRequest) {
    try {
      const input = notificationUserRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return this.notifications.getMyTokens(claims.sub);
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.registerPushToken)
  async registerPushToken(@Payload() payload: RegisterPushTokenRequest) {
    try {
      const input = registerPushTokenRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return this.notifications.registerPushToken(claims.sub, input.token);
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.removePushToken)
  async removePushToken(@Payload() payload: RemovePushTokenRequest) {
    try {
      const input = removePushTokenRequestSchema.parse(payload);
      const claims = this.internalAuth.verifyNotificationToken(
        input.internalAuth,
      );
      return this.notifications.removePushToken(claims.sub, input.token.token);
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.testPush)
  async sendTestPush(@Payload() payload: TestPushRequest) {
    try {
      const input = testPushRequestSchema.parse(payload);
      return this.testPush.send(
        input.push.token,
        input.push.title,
        input.push.body,
      );
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }

  @MessagePattern(NOTIFICATION_RPC_PATTERNS.testEmail)
  async sendTestEmail(@Payload() payload: TestEmailRequest) {
    try {
      const input = testEmailRequestSchema.parse(payload);
      return this.testEmail.send(
        input.email.to,
        input.email.subject,
        input.email.body,
      );
    } catch (error) {
      throw asNotificationRpcException(error);
    }
  }
}
