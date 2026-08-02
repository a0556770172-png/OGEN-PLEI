import { createAdminSupabase } from "./supabase/admin";

export async function getTotalSiteVisits(): Promise<number> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("site_stats").select("total_visits").eq("id", 1).maybeSingle();
  return data?.total_visits ?? 0;
}
