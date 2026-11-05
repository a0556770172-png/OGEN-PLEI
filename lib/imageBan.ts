import type { Profile } from "@/types/database";
import { isStaff } from "./auth-helpers";

export const IMAGES_BANNED_MESSAGE = "הצוות חסם אותך מהעלאת תמונות באתר, ולכן לא ניתן להעלות תמונה. לבירור אפשר לפנות לתמיכה.";

// משתמש שנחסם מהעלאת תמונות (profiles.images_banned) - צוות לא מושפע לעולם, כדי שיוכל לתקן תמונות.
export function isImagesBanned(profile: Pick<Profile, "images_banned" | "role"> & { is_moderator?: boolean }): boolean {
  return !!profile.images_banned && !isStaff(profile);
}
