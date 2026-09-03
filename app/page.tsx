import HomeHero from "@/components/HomeHero";
import AppGrid from "@/components/AppGrid";
import UpdatesPopup from "@/components/UpdatesPopup";
import ReferralHomeBanner from "@/components/ReferralHomeBanner";
import { getApprovedApps, getIconUrl } from "@/lib/apps-data";
import { getCategoriesServer } from "@/lib/categories";
import { getUsersStats } from "@/lib/users-data";
import { getTotalSiteVisits } from "@/lib/site-stats";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import { getUserAppUpdates } from "@/lib/updates";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [apps, categories, usersStats, totalVisits] = await Promise.all([
    getApprovedApps(),
    getCategoriesServer(),
    getUsersStats(),
    getTotalSiteVisits()
  ]);
  const withIcons = await Promise.all(
    apps.map(async (app) => ({ app, iconUrl: await getIconUrl(app.icon_key) }))
  );

  const totalDownloads = apps.reduce((sum, app) => sum + (app.downloads_count ?? 0), 0);

  // פיצ'ר 5: למשתמש מחובר - אילו אפליקציות שהוריד קיבלו עדכון גרסה (ל-Badge בכרטיס
  // ולחלונית הכניסה).
  const { user, profile } = await getCurrentProfile();
  const updates = user ? [...(await getUserAppUpdates(user.id)).values()] : [];
  const updateAppIds = updates.map((u) => u.appId);
  // צוות (מנהל/פיקוח) יכול לערוך את פוסט הפרסום של כל אפליקציה ישירות מהחנות - ראו AppModal.
  const viewerIsStaff = !!profile && isStaff(profile);

  return (
    <div className="flex flex-col gap-12">
      {updates.length > 0 && <UpdatesPopup updates={updates} />}
      <ReferralHomeBanner />
      <HomeHero
        total={apps.length}
        totalDownloads={totalDownloads}
        totalUsers={usersStats.totalUsers}
        totalVisits={totalVisits}
      />
      <AppGrid items={withIcons} categories={categories} updateAppIds={updateAppIds} viewerIsStaff={viewerIsStaff} />
    </div>
  );
}
