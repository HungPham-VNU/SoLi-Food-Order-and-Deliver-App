import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { USER_DIRECTORY_PORT } from '@/shared/ports/user-directory.port';
import { UserDirectoryAdapter } from './user-directory.adapter';

@Module({
  imports: [DatabaseModule],
  providers: [
    UserDirectoryAdapter,
    {
      provide: USER_DIRECTORY_PORT,
      useExisting: UserDirectoryAdapter,
    },
  ],
  exports: [USER_DIRECTORY_PORT],
})
export class IdentityModule {}
