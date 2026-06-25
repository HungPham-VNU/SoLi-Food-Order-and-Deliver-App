import { Module } from '@nestjs/common';
import { OutboxWriter } from './outbox.writer';

/**
 * OutboxModule — provides the dependency-free `OutboxWriter`.
 *
 * Catalog domain modules (restaurant, menu, zones, …) import this to record
 * `catalog.*.changed.v1` events in the same transaction as the business write.
 * Kept import-free so domain modules don't pull in the relay/consumer graph.
 */
@Module({
  providers: [OutboxWriter],
  exports: [OutboxWriter],
})
export class OutboxModule {}
