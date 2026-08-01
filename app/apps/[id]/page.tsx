import { notFound } from "next/navigation";
import { getAppById, getIconUrl } from "@/lib/apps-data";
import { getCategoriesServer } from "@/lib/categories";
import { formatFileSize } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import DownloadButton from "@/components/DownloadButton";
import ReportAppButton from "@/components/ReportAppButton";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { Package, User, Calendar, HardDrive, Flag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({ params }: { params: { id: string } }) {
  const app = await getAppById(params.id);
  if (!app) notFound();

  const iconUrl = await getIconUrl(app.icon_key);
  const categories = await getCategoriesServer();
  const category = categories.find((c) => c.value === app.category)?.label ?? app.category;
  const isPaused = app.download_paused || (app.download_paused_until ? new Date(app.download_paused_until).getTime() > Date.now() : false);

  // דיווחים מאושרים בלבד - שקיפות למשתמשים על בעיות שצוות הפיקוח אישר שהן אמיתיות.
  const admin = createAdminSupabase();
  const { data: approvedReports } = await admin
    .from("app_reports")
    .select("id, reason, reviewed_at")
    .eq("app_id", app.id)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="mx-auto flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-surface2 ring-1 ring-border sm:mx-0">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt={app.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-12 w-12 text-primary-light" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-right">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-black text-white sm:text-3xl">{app.name}</h1>
              <StatusBadge status={app.status} />
            </div>
            <p className="mb-4 text-gray-400">{app.short_description}</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 sm:justify-start">
              <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {app.developer?.username ?? "מפתח"}</span>
              <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {formatFileSize(app.file_size_bytes)}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> גרסה {app.version}</span>
              <span>{category}</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <DownloadButton appId={app.id} status={app.status} downloadsCount={app.downloads_count} isPaused={isPaused} />
              <ReportAppButton appId={app.id} />
            </div>
          </div>
        </div>

        {app.description_html && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-lg font-bold text-white">תיאור מלא</h2>
            <div className="rich-content text-gray-300" dangerouslySetInnerHTML={{ __html: app.description_html }} />
          </div>
        )}

        {approvedReports && approvedReports.length > 0 && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <Flag className="h-4 w-4 text-red-400" /> דיווחים מאושרים על האפליקציה
            </h2>
            <div className="flex flex-col gap-2">
              {approvedReports.map((r) => (
                <div key={r.id} className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-gray-300">
                  {r.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
