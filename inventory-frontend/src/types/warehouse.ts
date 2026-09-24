export type Warehouse = {
  guid: string;
  name: string;
  merchants_id: string;
  address: string;
};

export type GetWarehousesResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      warehouses: Warehouse[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type CreateWarehouseRequest = {
  name: string;
  merchants_id?: string;
  address?: string;
};

export type CreateWarehouseResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response: Warehouse | null;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type CreateWarehouseStockRequest = {
  warehouse_id: string;
  product_variations_id: string;
  quantity: number;
};

export type CreateWarehouseStockResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      guid: string;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type UpdateWarehouseRequest = {
  warehouse_id: string;
  name: string;
  address?: string;
};

export type UpdateWarehouseResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response: Warehouse | null;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type DeleteWarehouseResponse = {
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

export type WarehouseStockItem = {
  guid: string;
  product_variations_id: string;
  quantity: number;
  variation_id: string;
  products_id: string;
  sku: string;
  variation_images: string[] | null;
  size: string | null;
  color: string | null;
  product_id: string;
  product_name: string;
};

export type GetWarehouseStocksResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      stocks: WarehouseStockItem[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};
