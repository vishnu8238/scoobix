import { insforge } from "@/lib/insforge";

export const supabase = insforge.database;
export type SupabaseClient = typeof insforge.database;
