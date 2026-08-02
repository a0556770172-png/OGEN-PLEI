import HomeHero from "@/components/HomeHero";
import AppGrid from "@/components/AppGrid";
import { getApprovedApps, getIconUrl } from "@/lib/apps-data";
import { getCategoriesServer } from "@/lib/categories";
import { getUsersStats } from "@/lib/users-data";
import { getTotalSiteVisits } from "@/lib/site-stats";

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

  return (
    <div className="flex flex-col gap-12">
      <HomeHero
        total={apps.length}
        totalDownloads={totalDownloads}
        totalUsers={usersStats.totalUsers}
        totalVisits={totalVisits}
      />
      <AppGrid items={withIcons} categories={categories} />
    </div>
  );
}
