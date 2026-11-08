import HomeHero from "@/components/HomeHero";
import AppGrid from "@/components/AppGrid";
import UpdatesPopup from "@/components/UpdatesPopup";
import ReferralHomeBanner from "@/components/ReferralHomeBanner";
import ForumMoveTour from "@/components/ForumMoveTour";
import { getApprovedAppsLite, getIconUrl, slimForCard } from "@/lib/apps-data";
import { isApk } from "@/lib/appKind";
import { getCategoriesServer } from "@/lib/categories";
import { getUsersStats } from "@/lib/users-data";
import { getTotalSiteVisits } from "@/lib/site-stats";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import { getUserAppUpdates } from "@/lib/updates";
import { getSiteSettingsServer } from "@/lib/settings";

export const dynamic = "force-dynamic";

// כמה כרטיסים נשלחים בדף עצמו; כל השאר נטענים ברקע (api/apps/rest) מיד אחרי שהעמוד מוצג - טעינה ראשונה קטנה בהרבה
const INITIAL_CARDS = 60;

export default async function HomePage() {
  const [apps, categories, usersStats, totalVisits, siteSettings, { user, profile }] = await Promise.all([
    getApprovedAppsLite(),
    getCategoriesServer(),
    getUsersStats(),
    getTotalSiteVisits(),
    getSiteSettingsServer(),
    // פיצ'ר 5: למשתמש מחובר - אילו אפליקציות שהוריד קיבלו עדכון גרסה (ל-Badge בכרטיס
    // ולחלונית הכניסה). לא תלוי באף אחת מהשאילתות האחרות כאן, אז נכנס לאותה אצווה מקבילה.
    getCurrentProfile()
  ]);
  const withIcons = await Promise.all(
    apps.map(async (app) => ({ app: slimForCard(app), iconUrl: await getIconUrl(app.icon_key) }))
  );

  const apkCount = apps.filter((a) => isApk(a)).length;
  const totalDownloads = apps.reduce((sum, app) => sum + (app.downloads_count ?? 0), 0);

  const updates = user ? [...(await getUserAppUpdates(user.id)).values()] : [];
  const updateAppIds = updates.map((u) => u.appId);
  // צוות (מנהל/פיקוח) יכול לערוך את פוסט הפרסום של כל אפליקציה ישירות מהחנות - ראו AppModal.
  const viewerIsStaff = !!profile && isStaff(profile);

  return (
    <div className="flex flex-col gap-12">
      {updates.length > 0 && <UpdatesPopup updates={updates} />}
      <ReferralHomeBanner />
      <ForumMoveTour />
      <HomeHero
        total={apps.length}
        totalDownloads={totalDownloads}
        totalUsers={usersStats.totalUsers}
        totalVisits={totalVisits}
        forumButtonVisible={siteSettings.forum_button_visible}
      />
      <AppGrid items={withIcons.slice(0, INITIAL_CARDS)} totalCount={apps.length} totals={{ apps: apkCount, software: apps.length - apkCount }} categories={categories} updateAppIds={updateAppIds} viewerIsStaff={viewerIsStaff} loggedIn={!!user} />
    </div>
  );
}
