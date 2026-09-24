export type Category = {
  guid: string;
  name: string;
  description: string;
  category_id: string | null;
};

export type GetCategoriesResponse = {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      categories: Category[];
    };

    attributes: unknown;
    server_error: string;
  };

  custom_message: string;
};

export interface CreateCategoryResponse {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      message: string;
      response: Category | null;
    };

    attributes: null;
    server_error: string;
  };

  custom_message: string;
}

export type UpdateCategoryResponse = {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      message: string;
      response: Category | null;
    };

    attributes: null;
    server_error: string;
  };

  custom_message: string;
};

export type DeleteCategoryResponse = {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      message: string;
    };

    attributes: null;
    server_error: string;
  };

  custom_message: string;
};
