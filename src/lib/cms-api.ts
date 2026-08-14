import { listTable, createRecord, patchRecord } from "./insforge-crud";

export type Story = {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  target_audience: "riders" | "partners" | "all";
  status: "draft" | "published" | "archived";
  published_at?: string;
  created_at: string;
};

export async function fetchStories(params?: Record<string, any>) {
  return listTable<Story>("audit_logs", { select: "*", entity: "eq.story", order: "created_at.desc", ...params });
}

export async function createStory(story: Omit<Story, "id" | "created_at">) {
  return createRecord<Story>("audit_logs", { ...story, entity: "story" } as any);
}

export async function updateStory(id: string, patch: Partial<Story>) {
  return patchRecord<Story>("audit_logs", id, patch as any);
}
