import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  identityPromoteToRestaurantRequestSchema,
  identityUserContactRequestSchema,
  type IdentityPromoteToRestaurantRequest,
  type IdentityPromoteToRestaurantResponse,
  type IdentityUserContactRequest,
  type IdentityUserContactResponse,
} from '@uitfood/contracts';
import { IDENTITY_DATABASE } from '@/drizzle/database.constants';
import type { IdentityDatabase } from '@/drizzle/database.module';
import { user } from './auth.schema';
import { IdentityEventPublisher } from './identity-event.publisher';

@Injectable()
export class IdentityDirectoryService {
  constructor(
    @Inject(IDENTITY_DATABASE) private readonly database: IdentityDatabase,
    private readonly events: IdentityEventPublisher,
  ) {}

  async getContact(
    input: IdentityUserContactRequest,
  ): Promise<IdentityUserContactResponse> {
    const request = identityUserContactRequestSchema.parse(input);
    const rows = await this.database
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      })
      .from(user)
      .where(eq(user.id, request.userId))
      .limit(1);

    const found = rows[0];
    if (!found) {
      return {
        userId: request.userId,
        name: null,
        email: null,
        phoneNumber: null,
        role: null,
      };
    }

    return {
      userId: found.id,
      name: found.name,
      email: found.email,
      phoneNumber: found.phoneNumber,
      role: found.role,
    };
  }

  async promoteToRestaurant(
    input: IdentityPromoteToRestaurantRequest,
  ): Promise<IdentityPromoteToRestaurantResponse> {
    const request = identityPromoteToRestaurantRequestSchema.parse(input);
    const rows = await this.database
      .select()
      .from(user)
      .where(eq(user.id, request.userId))
      .limit(1);
    const current = rows[0];
    if (!current) throw new NotFoundException('User was not found.');

    if (current.role !== 'restaurant') {
      await this.database
        .update(user)
        .set({ role: 'restaurant' })
        .where(eq(user.id, request.userId));
      await this.events.publishRoleChanged(
        { ...current, role: 'restaurant' },
        {
          correlationId: request.correlationId,
          causationId: request.causationId,
          traceparent: request.traceparent,
        },
      );
    }

    return {
      userId: request.userId,
      role: 'restaurant',
      changed: current.role !== 'restaurant',
    };
  }
}
