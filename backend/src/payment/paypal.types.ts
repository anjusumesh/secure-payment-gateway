export interface PaypalOrder {
  id: string;
}

export interface PaypalCaptureOrderResponse {
  status: string;
  purchase_units: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>;
    };
  }>;
}

export interface PaypalWebhookVerifyResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}

export interface PaypalWebhookEvent {
  event_type: string;
  resource: {
    id: string;
    status?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
    status_details?: { reason?: string };
  };
}
