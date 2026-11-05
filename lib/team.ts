import { createAdminSupabase } from "./supabase/admin";
import { memo } from "./memo";

// האם הגיוס לצוות הפיקוח פתוח (מתג של המנהל בפאנל "מועמדויות לצוות"). ברירת מחדל: פתוח.
export async function isTeamRecruitOpen(): Promise<boolean> {
  return memo("team-recruit-open", 20_000, async () => {
    const { data } = await createAdminSupabase().from("site_settings").select("team_recruit_open").eq("id", true).maybeSingle();
    return (data as any)?.team_recruit_open ?? true;
  });
}
