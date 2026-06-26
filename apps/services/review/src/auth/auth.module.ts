import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InternalAuthService } from './internal-auth.service';

@Module({
  imports: [ConfigModule],
  providers: [InternalAuthService],
  exports: [InternalAuthService],
})
export class AuthModule {}
