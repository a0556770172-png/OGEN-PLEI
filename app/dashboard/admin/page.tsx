import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import {
  getReviewQueueApps,
  getAllAppsForAdmin,
  getAllProfiles,
  getPendingProRequests,
  getPendingSuggestionsCount,
  getTicketsNeedingReplyCount
} from "@/lib/admin-data";
import { getSiteSettingsServer } from "@/lib/settings";
import AdminDashboardClient from "@/components/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const [apps, allApps, profiles, proRequests, suggestionsPendingCount, ticketsNeedingReplyCount, siteSettings] = await Promise.all([
    getReviewQueueApps(),
    getAllAppsForAdmin(),
    getAllProfiles(),
    getPendingProRequests(),
    getPendingSuggestionsCount(),
    getTicketsNeedingReplyCount(),
    getSiteSettingsServer()
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black">פאנל ניהול</h1>
        <p className="text-gray-400">בדיקת אפליקציות ותוכנות, ניהול מפתחים ומשתמשים, אישורי PRO</p>
      </div>
      <AdminDashboardClient
        apps={apps}
        allApps={allApps}
        profiles={profiles}
        proRequests={proRequests}
        suggestionsPendingCount={suggestionsPendingCount}
        ticketsNeedingReplyCount={ticketsNeedingReplyCount}
        requireEmailVerification={siteSettings.require_email_verification}
      />
    </div>
  );
}
