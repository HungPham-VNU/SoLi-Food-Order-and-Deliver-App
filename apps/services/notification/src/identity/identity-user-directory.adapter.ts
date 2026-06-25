import { Inject, Injectable } from '@nestjs/common';
import type { IUserDirectoryPort } from '@/shared/ports/user-directory.port';
import type { IdentityRpcGateway } from './identity.interfaces';
import { IDENTITY_RPC_GATEWAY } from './identity.tokens';

@Injectable()
export class IdentityUserDirectoryAdapter implements IUserDirectoryPort {
  constructor(
    @Inject(IDENTITY_RPC_GATEWAY) private readonly identity: IdentityRpcGateway,
  ) {}

  async findEmail(userId: string): Promise<string | null> {
    const contact = await this.identity.getUserContact({ userId });
    return contact.email;
  }
}
