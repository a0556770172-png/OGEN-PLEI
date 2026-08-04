import { ScrollText } from "lucide-react";
import SiteRulesContent from "@/components/SiteRulesContent";
import { getSiteSettingsServer } from "@/lib/settings";

export const metadata = {
  title: "חוקי האתר"
};

export const dynamic = "force-dynamic";

// עמוד קבוע שנגיש בכל עת דרך תפריט הניווט (למחוברים ולא-מחוברים כאחד) - אותו תוכן בדיוק
// שמוצג בשער החובה החד-פעמי (components/SiteRulesGate.tsx), דרך SiteRulesContent המשותף.
export default async function SiteRulesPage() {
  const settings = await getSiteSettingsServer();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">חוקי האתר</h1>
            <p className="text-sm text-gray-500">חוקי עוגן פליי - מוצגים לכל משתמש פעם אחת בכניסה הראשונה, וזמינים כאן תמיד לעיון חוזר</p>
          </div>
        </div>
        <div className="text-sm leading-relaxed text-gray-300">
          <SiteRulesContent html={settings.site_rules_html} />
        </div>
      </div>
    </div>
  );
}
