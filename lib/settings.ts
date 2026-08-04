import { createAdminSupabase } from "@/lib/supabase/admin";

export interface SiteSettings {
  require_email_verification: boolean;
  // null = עדיין לא נערך ידנית ע"י הצוות - יוצג lib/siteRulesDefault.ts כברירת מחדל.
  site_rules_html: string | null;
  site_rules_version: number;
  site_rules_update_note: string | null;
}

// שליפת הגדרות האתר הגלובליות (שורה אחת בלבד בטבלה) - משמש קומפוננטות שרת.
export async function getSiteSettingsServer(): Promise<SiteSettings> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("site_settings")
    .select("require_email_verification, site_rules_html, site_rules_version, site_rules_update_note")
    .eq("id", true)
    .single();
  return {
    require_email_verification: data?.require_email_verification ?? false,
    site_rules_html: data?.site_rules_html ?? null,
    site_rules_version: data?.site_rules_version ?? 1,
    site_rules_update_note: data?.site_rules_update_note ?? null
  };
}
