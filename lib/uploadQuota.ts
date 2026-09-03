import { createAdminSupabase } from "./supabase/admin";
import { REFERRAL } from "./constants";
import type { Profile } from "@/types/database";

type QuotaProfile = Pick<Profile, "id" | "size_override_mb" | "referral_size_override_credits">;

// תקרת הגודל האפקטיבית (MB) להעלאה של משתמש נתון מול מכסת הבסיס שלו, בהתחשב ב:
//   1. הרשאת גודל חד-פעמית שאדמין נתן ידנית (size_override_mb)
//   2. קרדיט חריגת 150MB שנצבר מהפניות (referral_size_override_credits)
export function effectiveMaxUploadMb(profile: QuotaProfile, baseMaxMb: number): number {
  const adminOverride =
    profile.size_override_mb && profile.size_override_mb > baseMaxMb ? profile.size_override_mb : 0;
  const referralOverride =
    (profile.referral_size_override_credits ?? 0) > 0 && REFERRAL.sizeOverrideMb > baseMaxMb
      ? REFERRAL.sizeOverrideMb
      : 0;
  return Math.max(baseMaxMb, adminOverride, referralOverride);
}

// נקרא אחרי העלאה מוצלחת. אם הקובץ חרג מהמכסה הרגילה - "שורף" הרשאה אחת:
// קודם קרדיט הפניה (המשתמש הרוויח אותו בעצמו, וייתכן שיש כמה), ורק אם הוא לא
// מספיק לכסות את הקובץ - את הרשאת האדמין החד-פעמית.
export async function consumeOversizeGrant(
  profile: QuotaProfile,
  fileSizeBytes: number,
  baseMaxMb: number
): Promise<void> {
  if (fileSizeBytes <= baseMaxMb * 1024 * 1024) return; // נשאר בתוך המכסה הרגילה - לא נצרך כלום

  const admin = createAdminSupabase();
  const credits = profile.referral_size_override_credits ?? 0;

  if (credits > 0 && fileSizeBytes <= REFERRAL.sizeOverrideMb * 1024 * 1024) {
    await admin.from("profiles").update({ referral_size_override_credits: credits - 1 }).eq("id", profile.id);
    return;
  }

  if (profile.size_override_mb && profile.size_override_mb > baseMaxMb) {
    await admin.from("profiles").update({ size_override_mb: null }).eq("id", profile.id);
  }
}
