import { createServerSupabase } from "./supabase/server";
import { createDownloadUrl, BUCKETS } from "./r2";
import type { AppRow } from "@/types/database";

export async function getApprovedApps(): Promise<AppRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username)")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  return (data as unknown as AppRow[]) ?? [];
}

export async function getAppById(id: string): Promise<AppRow | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username, points, is_pro)")
    .eq("id", id)
    .single();
  return (data as unknown as AppRow) ?? null;
}

export async function getIconUrl(iconKey: string | null): Promise<string | null> {
  if (!iconKey) return null;
  try {
    return await createDownloadUrl(BUCKETS.assets, iconKey);
  } catch {
    return null;
  }
}
