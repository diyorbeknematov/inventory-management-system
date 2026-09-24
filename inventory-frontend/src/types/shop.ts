export type Shop = {
  guid: string;
  name: string;
  merchants_id: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
};

export type GetShopsResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      shops: Shop[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type CreateShopRequest = {
  name: string;
  merchants_id: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export type CreateShopResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response: Shop | null;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type CreateShopInventoryRequest = {
  shops_id: string;
  product_variations_id: string;
  quantity: number;
  base_price: number;
  discount_type: string[];
  discount_value: number;
};

export type CreateShopInventoryResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      guid: string;
      final_price: number;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type UpdateShopRequest = {
  shop_id: string;
  name: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export type UpdateShopResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response: Shop | null;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type DeleteShopResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type ShopStock = {
  guid: string;
  product_variations_id: string;
  quantity: number;
  base_price: number;
  discount_value: number;
  discount_type: string[];
  final_price: number;
  variation_id: string;
  products_id: string;
  sku: string;
  variation_images: string[] | null;
  size: string | null;
  color: string | null;
  product_id: string;
  product_name: string;
};

export type GetShopStocksResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      stocks: ShopStock[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};
