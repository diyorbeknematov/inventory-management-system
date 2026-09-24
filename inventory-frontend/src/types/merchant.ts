export type Merchant = {
  guid: string;
  name: string;
};

export type GetMerchantsResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      merchants: Merchant[];
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type CreateMerchantRequest = {
  name: string;
};

export type CreateMerchantResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      data?: unknown;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type UpdateMerchantRequest = {
  merchant_id: string;
  name: string;
};

export type UpdateMerchantResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      data?: unknown;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};

export type DeleteMerchantRequest = {
  merchant_id: string;
};

export type DeleteMerchantResponse = {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      message: string;
      data?: unknown;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
};