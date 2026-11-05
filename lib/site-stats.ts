import { createAdminSupabase } from "./supabase/admin";
import { memo } from "./memo";

export async function getTotalSiteVisits(): Promise<number> {
  return memo("site-visits", 20_000, async () => {
    const admin = createAdminSupabase();
    const { data } = await admin.from("site_stats").select("total_visits").eq("id", 1).maybeSingle();
    return data?.total_visits ?? 0;
  });
}
