import { redirect } from "next/navigation";

// "אזור מפתח" עבר להיות חלק מעמוד "הפרופיל שלי" - הנתיב הזה נשאר רק כהפניה
// לטובת קישורים ישנים ששמורים אצל משתמשים.
export default function DeveloperDashboardRedirect() {
  redirect("/profile");
}
