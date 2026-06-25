import { Inject, Injectable } from '@nestjs/common';
import {
  USER_DIRECTORY_PORT,
  type IUserDirectoryPort,
} from '@/shared/ports/user-directory.port';

/** @deprecated Inject USER_DIRECTORY_PORT directly. */
@Injectable()
export class UserEmailRepository {
  constructor(
    @Inject(USER_DIRECTORY_PORT)
    private readonly userDirectory: IUserDirectoryPort,
  ) {}

  findEmailByUserId(userId: string): Promise<string | null> {
    return this.userDirectory.findEmail(userId);
  }
}
