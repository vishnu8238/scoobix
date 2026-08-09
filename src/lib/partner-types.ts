export type PartnerOrderStatus = "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "REJECTED";

export type PartnerOrder = {
  id: string;
  customer: string;
  address: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: PartnerOrderStatus;
  placedAgo: string;
  rider?: string;
  paymentMethod: string;
};

export const PARTNER_STATUS_FLOW: PartnerOrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];
