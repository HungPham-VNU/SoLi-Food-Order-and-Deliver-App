import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  IDENTITY_RPC_PATTERNS,
  type IdentityHttpRequest,
  type IdentityPromoteToRestaurantRequest,
  type IdentitySessionIntrospectRequest,
  type IdentityUserContactRequest,
} from '@uitfood/contracts';
import { IdentityAuthHttpService } from '@/auth/identity-auth-http.service';
import { IdentityDirectoryService } from '@/auth/identity-directory.service';
import { IdentitySessionService } from '@/auth/identity-session.service';
import { asIdentityRpcException } from './identity-rpc.errors';

@Controller()
export class IdentityRpcController {
  constructor(
    private readonly authHttp: IdentityAuthHttpService,
    private readonly sessions: IdentitySessionService,
    private readonly directory: IdentityDirectoryService,
  ) {}

  @MessagePattern(IDENTITY_RPC_PATTERNS.proxyAuthHttp)
  async proxyAuthHttp(@Payload() payload: IdentityHttpRequest) {
    try {
      return await this.authHttp.handle(payload);
    } catch (error) {
      throw asIdentityRpcException(error);
    }
  }

  @MessagePattern(IDENTITY_RPC_PATTERNS.introspectSession)
  async introspectSession(
    @Payload() payload: IdentitySessionIntrospectRequest,
  ) {
    try {
      return await this.sessions.introspect(payload);
    } catch (error) {
      throw asIdentityRpcException(error);
    }
  }

  @MessagePattern(IDENTITY_RPC_PATTERNS.getUserContact)
  async getUserContact(@Payload() payload: IdentityUserContactRequest) {
    try {
      return await this.directory.getContact(payload);
    } catch (error) {
      throw asIdentityRpcException(error);
    }
  }

  @MessagePattern(IDENTITY_RPC_PATTERNS.promoteUserToRestaurant)
  async promoteUserToRestaurant(
    @Payload() payload: IdentityPromoteToRestaurantRequest,
  ) {
    try {
      return await this.directory.promoteToRestaurant(payload);
    } catch (error) {
      throw asIdentityRpcException(error);
    }
  }
}
