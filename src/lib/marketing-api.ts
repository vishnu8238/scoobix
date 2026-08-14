import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";

export type Campaign = {
  id: string;
  name: string;
  type: string;
  promo_code?: string;
  status: string;
  used_count: number;
  revenue_generated: number;
  created_at: string;
  archived: boolean;
};

export async function listCampaigns(params?: any) {
  return listTable<Campaign>("marketing_campaigns", { order: "created_at.desc", ...params });
}
