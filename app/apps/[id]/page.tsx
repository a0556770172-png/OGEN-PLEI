import { notFound } from "next/navigation";
import { getAppById, getIconUrl } from "@/lib/apps-data";
import { getCategoriesServer } from "@/lib/categories";
import { formatFileSize } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import DownloadButton from "@/components/DownloadButton";
import { Package, User, Calendar, HardDrive } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({ params }: { params: { id: string } }) {
  const app = await getAppById(params.id);
  if (!app) notFound();

  const iconUrl = await getIconUrl(app.icon_key);
  const categories = await getCategoriesServer();
  const category = categories.find((c) => c.value === app.category)?.label ?? app.category;
  const isPaused = app.download_paused || (app.download_paused_until ? new Date(app.download_paused_until).getTime() > Date.now() : false);

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
            <div className="mt-5">
              <DownloadButton appId={app.id} status={app.status} downloadsCount={app.downloads_count} isPaused={isPaused} />
            </div>
          </div>
        </div>

        {app.description_html && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-lg font-bold text-white">תיאור מלא</h2>
            <div className="rich-content text-gray-300" dangerouslySetInnerHTML={{ __html: app.description_html }} />
          </div>
        )}
      </div>
    </div>
  );
}
