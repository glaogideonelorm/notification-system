import { env } from "../../config/env";
import { NotFoundError, ServiceUnavailableError } from "../../core/errors";

export interface UserPreferences {
  email: boolean;
  push: boolean;
}

export interface UserServiceUser {
  id: string;
  name: string;
  email: string;
  push_token?: string | null;
  preferences: UserPreferences;
}

export interface UserServiceClient {
  getUserById(userId: string): Promise<UserServiceUser>;
}

export class HttpUserServiceClient implements UserServiceClient {
  async getUserById(userId: string): Promise<UserServiceUser> {
    if (!env.USER_SERVICE_BASE_URL) {
      throw new ServiceUnavailableError("User service not configured");
    }

    const res = await fetch(
      `${env.USER_SERVICE_BASE_URL}/api/v1/users/${userId}`,
    );

    if (res.status === 404) {
      throw new NotFoundError("User not found");
    }

    if (!res.ok) {
      throw new ServiceUnavailableError("User service error");
    }

    return (await res.json()) as UserServiceUser;
  }
}
