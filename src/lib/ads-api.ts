import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";

export type AdTarget = "all" | "customer" | "restaurant" | "rider";
export type AdPlacement = "home_top" | "home_middle" | "search_top" | "order_success";

export type Ad = {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  link_url?: string;
  placement: AdPlacement;
  target_audience: AdTarget;
  priority: number;
  active: boolean;
  starts_at?: string;
  ends_at?: string;
  created_at: string;
};

export async function fetchAds(params?: Record<string, any>) {
  return listTable<Ad>("audit_logs", { entity: "eq.ad", order: "priority.desc,created_at.desc", ...params });
}

export async function createAd(ad: Omit<Ad, "id" | "created_at">) {
  return createRecord<Ad>("audit_logs", { ...ad, entity: "ad" } as any);
}

export async function updateAd(id: string, patch: Partial<Ad>) {
  return patchRecord<Ad>("audit_logs", id, patch as any);
}

export async function deleteAd(id: string) {
  return deleteRecord("audit_logs", id);
}
