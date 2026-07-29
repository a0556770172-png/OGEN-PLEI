import { createAdminSupabase } from "@/lib/supabase/admin";

export interface SiteSettings {
  require_email_verification: boolean;
}

// שליפת הגדרות האתר הגלובליות (שורה אחת בלבד בטבלה) - משמש קומפוננטות שרת.
export async function getSiteSettingsServer(): Promise<SiteSettings> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("site_settings").select("require_email_verification").eq("id", true).single();
  return { require_email_verification: data?.require_email_verification ?? false };
}
