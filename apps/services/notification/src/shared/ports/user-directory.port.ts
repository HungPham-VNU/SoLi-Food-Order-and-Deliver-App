export const USER_DIRECTORY_PORT = Symbol('USER_DIRECTORY_PORT');

export interface IUserDirectoryPort {
  findEmail(userId: string): Promise<string | null>;
}
