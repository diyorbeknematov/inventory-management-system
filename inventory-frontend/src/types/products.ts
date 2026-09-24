export type Variation = {
  guid: string;
  products_id: string;
  sku: string;
  images: string[];
  size: string;
  color: string;
  product_name: string;
};

export type Product = {
  guid: string;
  name: string;
  images: string[];
  category_id: string;
};

export type Category = {
  guid: string;
  name: string;
  description: string;
  category_id?: string;
  products: Product[];
  subcategories: Category[];
};

export type CreateVariationState = {
  id: string;
  size: string;
  color: string;
  images: string[];
};

export type GetProductsResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      products: Product[];
      categories: Category[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type GetProductVariationsResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      variations: Variation[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export interface CreateProductVariation {
  size?: string;
  color?: string;
  images?: string[];
}

export interface CreateProductRequest {
  name: string;
  merchants_id: string;
  category_id: string;
  images?: string[];
  product_variations?: CreateProductVariation[];
}

export interface CreateVariationRequest {
  products_id: string;
  size?: string;
  color?: string;
  images?: string[];
}

export interface CreateVariationResponse {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response: Variation;
    };
    attributes: null;
    server_error: string;
  };
  custom_message: string;
}

export interface CreateProductResponse {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response: Product | null;
    };
    attributes: null;
    server_error: string;
  };
  custom_message: string;
}

export interface UpdateProductRequest {
  product_id: string;
  name: string;
  category_id: string;
  images?: string[];
}

export interface UpdateProductResponse {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response: Product | null;
    };
    attributes: null;
    server_error: string;
  };
  custom_message: string;
}

export interface DeleteProductResponse {
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
}

export interface UpdateVariationRequest {
  variation_id: string;
  size?: string;
  color?: string;
  images?: string[];
}

export interface UpdateVariationResponse {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      data: Variation;
    };
    attributes: null;
    server_error: string;
  };
  custom_message: string;
}

export interface DeleteVariationRequest {
  variation_id: string;
}

export interface DeleteVariationResponse {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      data: unknown;
    };
    attributes: null;
    server_error: string;
  };
  custom_message: string;
}
