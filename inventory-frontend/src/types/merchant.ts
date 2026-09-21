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