import { createServerSupabase } from "./supabase/server";
import { createAdminSupabase } from "./supabase/admin";
import type { Profile } from "@/types/database";

export async function requireProfile(): Promise<{ user: any; profile: Profile } | { error: string; status: number }> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר", status: 401 };

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return { error: "פרופיל לא נמצא", status: 404 };
  if (profile.banned) return { error: "החשבון שלך חסום", status: 403 };

  return { user, profile: profile as Profile };
}

// פיקוח (moderator) הוא כעת דגל (is_moderator) שמתווסף על גבי role, לא ערך role בפני עצמו -
// כך שמפתח שהתמנה לצוות פיקוח לא מאבד את מעמד המפתח שלו.
export function isStaff(profile: { role: string; is_moderator?: boolean }) {
  return profile.role === "admin" || !!profile.is_moderator;
}
