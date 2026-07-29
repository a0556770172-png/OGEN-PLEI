import HomeHero from "@/components/HomeHero";
import AppGrid from "@/components/AppGrid";
import { getApprovedApps, getIconUrl } from "@/lib/apps-data";
import { getCategoriesServer } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [apps, categories] = await Promise.all([getApprovedApps(), getCategoriesServer()]);
  const withIcons = await Promise.all(
    apps.map(async (app) => ({ app, iconUrl: await getIconUrl(app.icon_key) }))
  );

  return (
    <div className="flex flex-col gap-12">
      <HomeHero total={apps.length} />
      <AppGrid items={withIcons} categories={categories} />
    </div>
  );
}
