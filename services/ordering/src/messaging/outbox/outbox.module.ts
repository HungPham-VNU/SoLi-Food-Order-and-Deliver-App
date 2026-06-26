import { Module } from '@nestjs/common';
import { OutboxWriter } from './outbox.writer';

/**
 * OutboxModule — provides ONLY the dependency-free `OutboxWriter`.
 *
 * Producer modules (catalog, ordering, payment, review) import this to record
 * events in their own transactions. It deliberately imports nothing heavy, so a
 * producer can depend on it without pulling in MessagingModule's consumers
 * (which import the catalog/ordering contracts modules) — avoiding a Nest DI
 * cycle. The full MessagingModule (relay + publisher + consumers + bridge) is
 * imported once by AppModule.
 */
@Module({
  providers: [OutboxWriter],
  exports: [OutboxWriter],
})
export class OutboxModule {}
