import type {
  IdentitySessionIntrospectRequest,
  IdentitySessionIntrospectResponse,
  IdentityUserContactRequest,
  IdentityUserContactResponse,
} from '@uitfood/contracts';

export interface IdentityRpcGateway {
  introspectSession(
    input: IdentitySessionIntrospectRequest,
  ): Promise<IdentitySessionIntrospectResponse>;
  getUserContact(
    input: IdentityUserContactRequest,
  ): Promise<IdentityUserContactResponse>;
}
