import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  createEnvelope,
  EVENT_NAMES,
  IDENTITY_USER_CONTACT_CHANGED_V1,
  IDENTITY_USER_ROLE_CHANGED_V1,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import { IDENTITY_DATABASE } from '@/drizzle/database.constants';
import type { IdentityDatabase } from '@/drizzle/database.module';
import { outboxEvents } from './auth.schema';

interface IdentityUserSnapshot {
  id: string;
  email?: string | null;
  phoneNumber?: string | null;
  emailVerified?: boolean | null;
  phoneNumberVerified?: boolean | null;
  role?: string | null;
}

@Injectable()
export class IdentityEventPublisher {
  private readonly logger = new Logger(IdentityEventPublisher.name);

  constructor(
    @Inject(IDENTITY_DATABASE) private readonly database: IdentityDatabase,
  ) {}

  async publishContactChanged(
    user: IdentityUserSnapshot | null | undefined,
    metadata: EventMetadata = {},
  ): Promise<void> {
    if (!user?.id) return;
    await this.writeEnvelope(
      createEnvelope({
        eventType: EVENT_NAMES.IdentityUserContactChanged,
        eventVersion: IDENTITY_USER_CONTACT_CHANGED_V1.version,
        aggregateId: user.id,
        aggregateVersion: 0,
        producer: 'identity-service',
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        traceparent: metadata.traceparent,
        payload: {
          userId: user.id,
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          emailVerified: Boolean(user.emailVerified),
          phoneNumberVerified: Boolean(user.phoneNumberVerified),
        },
      }),
    );
  }

  async publishRoleChanged(
    user: IdentityUserSnapshot | null | undefined,
    metadata: EventMetadata = {},
  ): Promise<void> {
    if (!user?.id) return;
    await this.writeEnvelope(
      createEnvelope({
        eventType: EVENT_NAMES.IdentityUserRoleChanged,
        eventVersion: IDENTITY_USER_ROLE_CHANGED_V1.version,
        aggregateId: user.id,
        aggregateVersion: 0,
        producer: 'identity-service',
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        traceparent: metadata.traceparent,
        payload: {
          userId: user.id,
          role: user.role ?? null,
        },
      }),
    );
  }

  private async writeEnvelope(
    envelope: DomainEventEnvelope,
    executor: IdentityDatabase = this.database,
  ): Promise<void> {
    try {
      await executor
        .insert(outboxEvents)
        .values({
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          eventVersion: envelope.eventVersion,
          aggregateId: envelope.aggregateId,
          aggregateVersion: envelope.aggregateVersion,
          envelope,
          occurredAt: new Date(envelope.occurredAt),
        })
        .onConflictDoNothing({ target: outboxEvents.eventId });
    } catch (error) {
      this.logger.error(
        `Failed to write Identity outbox event ${envelope.eventType} for ${envelope.aggregateId}: ${
          (error as Error).message
        }`,
      );
      throw error;
    }
  }
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string | null;
  traceparent?: string | null;
}
