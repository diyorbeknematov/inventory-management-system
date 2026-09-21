export type User = {
  guid: string;
  login: string;
  full_name: string;
  email: string;
  merchants_id: string | null;
  merchant_name: string | null;
  role_id: string;
  role_name: string;
  scope_id: string | null;
  scope_type: string | null;
  shop_name: string | null;
  warehouse_name: string | null;
};

export type GetUsersResponse = {
  status: string;
    description: string;
    data: {
      status: string;
      data: {
        users: User[];
      };
      attributes: unknown;
      server_error: string;
    };
};

export type CreateUserRequest = {
  username: string;
  password: string;
  merchants_id: string;
  role_id: string;
  scope_type?: string;
  scope_id?: string;
};

export type CreateUserResponse = {
  status: string;
    description: string;
    data: {
      status: string;
      data: {
        message: unknown;
      };
      attributes: unknown;
      server_error: string;
    };
};

export type UpdateProfileRequest = {
  user_id: string;
  full_name?: string;
  email?: string;
  login?: string;
  password?: string;
};

export type UpdateProfileResponse = {
  data: {
    message: string;
    data: unknown;
  };
};

export type DeleteUserRequest = {
  user_id: string;
};

export type DeleteUserResponse = {
  data: {
    message: string;
    data: unknown;
  };
};
