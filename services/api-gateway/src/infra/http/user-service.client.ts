import { env } from "../../config/env";
import { NotFoundError, ServiceUnavailableError } from "../../core/errors";

export interface UserPreferences {
  email: boolean;
  push: boolean;
}

export interface UserServiceUser {
  user_id: string;
  name: string;
  email: string;
  push_token?: string | null;
  preferences: UserPreferences;
}

interface UserServiceResponse {
  success: boolean;
  message: string;
  data: UserServiceUser;
  error: null | string;
  meta: {
    total: number;
    limit: number;
    page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface UserServiceClient {
  getUserById(userId: string): Promise<UserServiceUser>;
}

export class HttpUserServiceClient implements UserServiceClient {
  async getUserById(userId: string): Promise<UserServiceUser> {
    if (!env.USER_SERVICE_URL) {
      throw new ServiceUnavailableError("User service not configured");
    }

    const res = await fetch(
      `${env.USER_SERVICE_URL}/api/v1/users/${userId}`,
    );

    if (res.status === 404) {
      throw new NotFoundError("User not found");
    }

    if (!res.ok) {
      throw new ServiceUnavailableError("User service error");
    }

    if (!res.ok) {
      throw new ServiceUnavailableError("User service error");
    }

    // Parse the wrapped response and extract the data
    const response = (await res.json()) as UserServiceResponse;
    
    if (!response.success) {
      throw new ServiceUnavailableError(response.error || "User service error");
    }

    return response.data;
  }
}
