export type ShopSelect = {
  guid: string;
  name: string;
};

export type GetShopsForSelectResponse = {
  status: string;
    description: string;
    data: {
      status: string;
      data: {
        shops: ShopSelect[];
      };
      attributes: unknown;
      server_error: string;
    };
};

export type WarehouseSelect = {
  guid: string;
  name: string;
};

export type GetWarehousesForSelectResponse = {
  status: string;
    description: string;
    data: {
      status: string;
      data: {
        warehouses: WarehouseSelect[];
      };
      attributes: unknown;
      server_error: string;
    };
};

export type ProductVariationSelect = {
  guid: string;
  products_id: string;
  sku: string;
  size: string | null;
  color: string | null;
};

export type ProductSelect = {
  guid: string;
  name: string;
  category_id: string;
  variations: ProductVariationSelect[] | null;
};

export type GetProductsForSelectResponse = {
  status: string;
    description: string;
    data: {
      status: string;
      data: {
        products: ProductSelect[];
      };
      attributes: unknown;
      server_error: string;
    };
};

export type MerchantSelect = {
  guid: string;
  name: string;
}

export type GetMerchantsForSelectResponse = {
  status: string;
    description: string;
    data: {
      status: string;
      data: {
        merchants: MerchantSelect[];
      };
      attributes: unknown;
      server_error: string;
    };
};

export type RoleSelect = {
  guid: string,
  name: string,
}

export type GetRolesForSelectResponse = {
  status: string;
    description: string;
    data: {
      status: string;
      data: {
        roles: RoleSelect[];
      };
      attributes: unknown;
      server_error: string;
    };
}


