export type LoginResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      data: {
        token: {
          access_token: string;
          expires_at: string;
          refresh_token: string;
        };
        user_data: {
          client_type_id: string;
          email: string;
          full_name: string;
          login: string;
          merchants_id: string | null;
          role_id: string;
          user_id: string;
        };
      };
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

