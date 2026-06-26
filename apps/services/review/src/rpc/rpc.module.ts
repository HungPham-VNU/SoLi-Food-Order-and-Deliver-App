import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ReviewModule } from '@/review/review.module';
import { ReviewRpcController } from './review-rpc.controller';

@Module({
  imports: [AuthModule, ReviewModule],
  controllers: [ReviewRpcController],
})
export class RpcModule {}
