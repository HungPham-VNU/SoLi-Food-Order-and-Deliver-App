import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { ManagementController } from '@/management/management.controller';
import { MessagingModule } from '@/messaging/messaging.module';
import { ConsumersModule } from '@/messaging/consumers/consumers.module';
import { RestaurantModule } from '@/restaurant/restaurant.module';
import { ZonesModule } from '@/restaurant/zones/zones.module';
import { MenuModule } from '@/menu/menu.module';
import { ModifiersModule } from '@/menu/modifiers/modifiers.module';
import { NutritionModule } from '@/nutrition/nutrition.module';
import { SearchModule } from '@/search/search.module';
import { DietaryTagsModule } from '@/dietary-tags/dietary-tags.module';

/**
 * Catalog service root module — write-path extraction (Phase 6 step 3, half 1).
 *
 * Wires the domain (restaurant, zones, menu, modifiers + AI search indexing),
 * their `@MessagePattern` RPC controllers, the messaging runtime (outbox relay +
 * publisher), and the inbound review-rating projection consumer. (Full search
 * query side + nutrition arrive in half 2.)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    MessagingModule,
    RestaurantModule,
    ZonesModule,
    MenuModule,
    ModifiersModule,
    NutritionModule,
    SearchModule,
    DietaryTagsModule,
    ConsumersModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}
