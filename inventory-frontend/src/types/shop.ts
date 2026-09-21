export type ShopStock = {
  base_price: number;
  color: string;
  discount_type: string[];
  discount_value: number;
  final_price: number;
  images: string[];
  product_id: string;
  product_name: string;
  quantity: number;
  size: string;
  sku: string;
  variation_id: string;
};

export type Shop = {
  guid: string;
  name: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  stocks: ShopStock[];
};

export type GetMerchantShopsResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      merchant: {
        guid: string;
        name: string;
      };
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

