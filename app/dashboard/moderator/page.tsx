import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getReviewQueueApps, getPendingSuggestionsCount, getTicketsNeedingReplyCount } from "@/lib/admin-data";
import ModeratorDashboardClient from "@/components/ModeratorDashboardClient";

export const dynamic = "force-dynamic";

export default async function ModeratorDashboard() {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");
  // פיקוח הוא דגל (is_moderator) שמתווסף על גבי role - כך שמפתח/משתמש רגיל שהתמנה
  // לפיקוח מגיע לכאן, ולא מאבד את הגישה לאזור המפתח שלו אם יש לו כזה.
  if (!profile.is_moderator && profile.role !== "admin") redirect("/");

  const [apps, suggestionsPendingCount, ticketsNeedingReplyCount] = await Promise.all([
    getReviewQueueApps(),
    getPendingSuggestionsCount(),
    getTicketsNeedingReplyCount()
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black">פאנל פיקוח</h1>
        <p className="text-gray-400">בדיקת אפליקציות ותוכנות, הצעות אפליקציות ופניות תמיכה</p>
      </div>
      <ModeratorDashboardClient
        apps={apps}
        suggestionsPendingCount={suggestionsPendingCount}
        ticketsNeedingReplyCount={ticketsNeedingReplyCount}
      />
    </div>
  );
}
