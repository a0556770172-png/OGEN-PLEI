import { createServerSupabase } from "./supabase/server";
import { getCachedUser } from "./auth-cache";
import { createAdminSupabase } from "./supabase/admin";
import type { Profile } from "@/types/database";

export async function requireProfile(): Promise<{ user: any; profile: Profile } | { error: string; status: number }> {
  const supabase = createServerSupabase();
  const user = await getCachedUser();
  if (!user) return { error: "יש להתחבר", status: 401 };

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return { error: "פרופיל לא נמצא", status: 404 };

  if (profile.banned) {
    // חסימה זמנית שפג תוקפה - משחררים אוטומטית בלי צורך בפעולה ידנית של הצוות.
    if (profile.ban_expires_at && new Date(profile.ban_expires_at).getTime() <= Date.now()) {
      await admin
        .from("profiles")
        .update({ banned: false, ban_reason: null, ban_expires_at: null, banned_at: null })
        .eq("id", user.id);
      return { user, profile: { ...profile, banned: false, ban_reason: null, ban_expires_at: null, banned_at: null } as Profile };
    }
    return { error: "החשבון שלך חסום", status: 403 };
  }

  return { user, profile: profile as Profile };
}

// פיקוח (moderator) הוא כעת דגל (is_moderator) שמתווסף על גבי role, לא ערך role בפני עצמו -
// כך שמפתח שהתמנה לצוות פיקוח לא מאבד את מעמד המפתח שלו.
export function isStaff(profile: { role: string; is_moderator?: boolean }) {
  return profile.role === "admin" || !!profile.is_moderator;
}

// חבר צוות (מנהל או פיקוח) מוגן מפעולות חסימה/מחיקה של חבר צוות אחר - בדיוק מה ש-isStaff
// בודק, רק על ה"מטרה" של הפעולה ולא על מי שמבצע אותה. נוסף אחרי שנמצא שכמה endpoints
// (forum/ban, bot/ban) העתיקו רק את חצי הבדיקה (role==="admin" בלבד, בלי is_moderator) -
// פיקוח אחד יכול היה לחסום פיקוח אחר. endpoints חדשים שחוסמים/מוחקים משתמש - ישתמשו בזה
// במקום לכתוב את הבדיקה מההתחלה.
export function isProtectedStaffTarget(target: { role: string; is_moderator?: boolean }) {
  return isStaff(target);
}
