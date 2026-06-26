import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderingContractsModule } from '../ordering-contracts.module';
import { OrderingRpcController } from './ordering-rpc.controller';

@Module({
  imports: [ConfigModule, OrderingContractsModule],
  controllers: [OrderingRpcController],
})
export class OrderingRpcModule {}
