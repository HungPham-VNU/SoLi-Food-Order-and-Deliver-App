import type { CreateImageDto } from '@/shared/contracts/image.dto';

export const IMAGE_MANAGEMENT_PORT = Symbol('IMAGE_MANAGEMENT_PORT');

export interface IImageManagementPort {
  create(input: CreateImageDto): Promise<unknown>;
}
