export type MovementItem = {
  guid: string;
  color: string;
  images: string[];
  product_id: string;
  product_name: string;
  quantity: number;
  size: string;
  sku: string;
  variation_id: string;
};

export type Movement = {
  guid: string;
  items: MovementItem[];
  status: string[];
  type: string[];
};

export type Shop = {
  address: string;
  email: string;
  guid: string;
  logo: string | null;
  name: string;
  phone: string;
};

export type Warehouse = {
  address: string;
  guid: string;
  name: string;
};

export type ReturnMovement = Movement & { 
  destination_warehouse: Warehouse; 
}; 

export type TransferMovement = Movement & { 
  destination_shop: Shop | null; 
  destination_warehouse: Warehouse | null; 
};

export type Merchant = {
  guid: string;
  name: string;
};

export type SaleShop = Shop & {
  sales: Movement[];
};

export type ReturnShop = Shop & { 
  returns: ReturnMovement[]; 
};

export type ReceiptWarehouse = Warehouse & {
  shipments: Movement[];
};

export type WarehouseTransferWarehouse = Warehouse & {
  transfers: TransferMovement[];
};

export type ShopTransferShop = Shop & {
  transfers: TransferMovement[];
};


// SALE

export type GetMerchantSalesResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      merchant: Merchant;
      shops: SaleShop[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};


// RECEIPT

export type GetMerchantReceiptsResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      merchant: Merchant;
      warehouses: ReceiptWarehouse[];
    };
    attributes: unknown;
    server_error: string;
  };
};

// RETURN 
export type GetMerchantReturnsResponse = { 
  status: string; 
  description: string; 
  data: { 
    status: string; 
    data: { 
      merchant: Merchant; 
      shops: ReturnShop[]; 
    }; 
    attributes: unknown; 
    server_error: string; 
  }; custom_message: string; 
};


// WAREHOUSE TRANSFERS

export type GetMerchantWarehouseTransfersResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      merchant: Merchant;
      warehouses: WarehouseTransferWarehouse[];
    };
    attributes: unknown;
    server_error: string;
  };
};


// SHOP TRANSFERS
export type GetMerchantShopTransfersResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      merchant: Merchant;
      shops: ShopTransferShop[];
    };
    attributes: unknown;
    server_error: string;
  };
};

// FRONTEND

export type MovementType =
  | "SALE"
  | "RECEIPT"
  | "RETURN"
  | "TRANSFER";

export type MovementStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED";

export type MovementLocation = {
  id: string,
  name: string;
  type: 
  | "SHOP" 
  | "WAREHOUSE" 
  | "CUSTOMER" 
  | "EXTERNAL";
};

export type FrontendMovement = {
  id: string;
  type: MovementType;
  status: MovementStatus;
  items: MovementItem[];
  from: MovementLocation;
  to: MovementLocation;
};

export type CreateStockMovementItem = {
  product_variations_id: string;
  quantity: number;
};

export type CreateStockMovementRequest = {
  merchants_id: string,
  type: MovementType;

  shops_id?: string;
  warehouse_id?: string;

  shops_id_2?: string;
  warehouse_id_2?: string;

  items?: CreateStockMovementItem[];
};

export type CreateStockMovementResponse = {
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

export type CreateStockMovementItemRequest = {
  stock_movements_id: string;
  product_variations_id: string;
  quantity: number;
};

export type CreateStockMovementItemsResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      response?: unknown;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type UpdateStockMovementStatusRequest = {
  guid: string;

  shops_id?: string;
  shops_id_2?: string;

  warehouse_id?: string;
  warehouse_id_2?: string;

  status: MovementStatus;
  type: MovementType;
};

export type UpdateStockMovementStatusResponse = {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      message: string;
      "movement type"?: string;
    };

    attributes: unknown;
    server_error: string;
  };

  custom_message: string;
};

export type UpdateStockMovementRequest = {
  stock_movement_id: string;

  shops_id?: string;
  shops_id_2?: string;

  warehouse_id?: string;
  warehouse_id_2?: string;

  type: MovementType;
};

export type UpdateStockMovementResponse = {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      message: string;
      response?: unknown;
    };

    attributes: unknown;
    server_error: string;
  };

  custom_message: string;
};

export type DeleteStockMovementRequest = {
  stock_movement_id: string;
};

export type DeleteStockMovementResponse = {
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

export type DeleteStockMovementItemRequest = {
  movement_item_id: string;
};

export type DeleteStockMovementItemResponse = {
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
