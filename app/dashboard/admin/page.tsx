import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import {
  getReviewQueueApps,
  getAllAppsForAdmin,
  getAllProfiles,
  getPendingProRequests,
  getPendingSuggestionsCount,
  getTicketsNeedingReplyCount,
  getPendingDeletionRequests,
  getOpenAutoApprovedCouncilCount,
  getBanAppeals,
  getReferralEvents
} from "@/lib/admin-data";
import { getSiteSettingsServer } from "@/lib/settings";
import { getSiteReviews } from "@/lib/siteReviews";
import AdminDashboardClient from "@/components/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const [apps, allApps, profiles, proRequests, suggestionsPendingCount, ticketsNeedingReplyCount, deletionRequests, councilAutoApprovedCount, siteSettings, banAppeals, referralEvents] =
    await Promise.all([
      getReviewQueueApps(),
      getAllAppsForAdmin(),
      getAllProfiles(),
      getPendingProRequests(),
      getPendingSuggestionsCount(),
      getTicketsNeedingReplyCount(),
      getPendingDeletionRequests(),
      getOpenAutoApprovedCouncilCount(),
      getSiteSettingsServer(),
      getBanAppeals(),
      getReferralEvents()
    ]);

  const siteReviewsData = await getSiteReviews({ includeHidden: true });

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
        deletionRequests={deletionRequests}
        councilAutoApprovedCount={councilAutoApprovedCount}
        requireEmailVerification={siteSettings.require_email_verification}
        currentProfile={profile}
        banAppeals={banAppeals}
        referralEvents={referralEvents}
        siteReviews={siteReviewsData.reviews}
      />
    </div>
  );
}
