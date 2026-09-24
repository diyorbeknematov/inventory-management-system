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
  merchants_id: string;

  shops_id: string | null;
  shops_id_2: string | null;

  warehouse_id: string | null;
  warehouse_id_2: string | null;

  type: string[];
  status: string[];
  created_at: string;
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


// GET STOCK MOVEMENTS

export type GetStockMovementsResponse = {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      movements: Movement[];
    };

    attributes: unknown;
    server_error: string;
  };

  custom_message: string;
};


// GET STOCK MOVEMENT ITEMS

export type GetStockMovementItemsRequest = {
  movement_id: string;
};

export type GetStockMovementItemsResponse = {
  status: string;
  description: string;

  data: {
    status: string;

    data: {
      items: MovementItem[];
    };

    attributes: unknown;
    server_error: string;
  };

  custom_message: string;
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
  id: string;
  name: string;
  type:
    | "SHOP"
    | "WAREHOUSE"
    | "CUSTOMER"
    | "EXTERNAL";
};

export type FrontendMovement = {
  id: string;
  merchantId: string;
  type: MovementType;
  status: MovementStatus;
  created_at: string;
  items: MovementItem[];
  from: MovementLocation;
  to: MovementLocation;
};


// CREATE MOVEMENT

export type CreateStockMovementItem = {
  product_variations_id: string;
  quantity: number;
};

export type CreateStockMovementRequest = {
  merchants_id?: string;

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


// CREATE MOVEMENT ITEM

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


// UPDATE MOVEMENT STATUS

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


// UPDATE MOVEMENT

export type UpdateStockMovementRequest = {
  stock_movement_id: string;

  shops_id?: string;
  shops_id_2?: string;

  warehouse_id?: string;
  warehouse_id_2?: string;

  type: MovementType;
  items?: CreateStockMovementItem[],
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


// DELETE MOVEMENT

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


// DELETE MOVEMENT ITEM

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
