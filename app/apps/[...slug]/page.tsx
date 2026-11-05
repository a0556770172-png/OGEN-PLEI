import { Suspense, cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { getAppByKey, getIconUrl } from "@/lib/apps-data";
import { assignSlug } from "@/lib/appSlug";
import { appPath } from "@/lib/appPath";
import { publicAssetUrl } from "@/lib/r2";
import AppUploadForm from "@/components/AppUploadForm";
import { getCategoriesServer } from "@/lib/categories";
import { formatFileSize } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import DownloadButton from "@/components/DownloadButton";
import ReportsMenu from "@/components/ReportsMenu";
import AppLikeButton from "@/components/AppLikeButton";
import AppReviews from "@/components/AppReviews";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import NotifyButton from "@/components/NotifyButton";
import UpdateAppButton from "@/components/UpdateAppButton";
import UpdatedBadge from "@/components/UpdatedBadge";
import AppSourceTag from "@/components/AppSourceTag";
import { Package, User, Calendar, HardDrive, Flag, Smartphone, Wifi, WifiOff, HelpCircle, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

// תגית "אופליין/אונליין" - אותו לוגיקה גם ל-badge בדף הפרטים וגם לכל מקום דומה שירצה להשתמש בה.
const OFFLINE_SUPPORT_LABEL: Record<string, { label: string; icon: typeof Wifi }> = {
  offline: { label: "פועלת גם אופליין", icon: WifiOff },
  online: { label: "חייבת אינטרנט", icon: Wifi },
  unknown: { label: "תמיכה באופליין לא ידועה", icon: HelpCircle }
};

// הכתובת: /apps/<slug> (slug יכול להכיל לוכסן: UserName/myapp), או /apps/<id> בקישורים ישנים.
// הסיומת /update פותחת את עמוד "עדכן את האפליקציה". הכתובת הקנונית היא תמיד ה-slug -
// כל כתובת אחרת (id ישן, אותיות גדולות וכו') מופנית אליה בהפניה קבועה (בעיקר לטובת גוגל).
function parseSlugParam(segments: string[]): { key: string; isUpdate: boolean } {
  const decoded = segments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const isUpdate = decoded.length > 1 && decoded[decoded.length - 1] === "update";
  const parts = isUpdate ? decoded.slice(0, -1) : decoded;
  return { key: parts.join("/"), isUpdate };
}

const loadApp = cache(getAppByKey);

export async function generateMetadata({ params }: { params: { slug: string[] } }): Promise<Metadata> {
  const { key, isUpdate } = parseSlugParam(params.slug);
  const app = await loadApp(key);
  if (!app || app.status !== "approved" || isUpdate) return { robots: { index: false } };
  const desc = app.short_description || `הורדת ${app.name} בעוגן פליי - מאגר אפליקציות ותוכנות מאובטח.`;
  const iconUrl = await getIconUrl(app.icon_key);
  return {
    title: `${app.name} - הורדה`,
    description: desc,
    alternates: { canonical: appPath(app) },
    openGraph: { title: app.name, description: desc, type: "website", ...(iconUrl ? { images: [{ url: iconUrl }] } : {}) }
  };
}

export default async function AppDetailPage({ params }: { params: { slug: string[] } }) {
  const { key, isUpdate } = parseSlugParam(params.slug);
  const app = await loadApp(key);
  if (!app) notFound();

  // אפליקציה ישנה בלי slug - יוצרים עכשיו, ומעבירים לכתובת הקריאה.
  if (!app.slug) {
    app.slug = await assignSlug(app.id);
  }
  const canonical = appPath(app) + (isUpdate ? "/update" : "");
  if (app.slug && key !== app.slug) permanentRedirect(canonical);

  if (isUpdate) {
    // "עדכן את האפליקציה" - עמוד העלאת גרסה חדשה לאפליקציה ציבורית (כל משתמש מחובר).
    if (app.status !== "approved" || app.source !== "public_suggestion") redirect(appPath(app));
    const { user: updateUser } = await getCurrentProfile();
    if (!updateUser) redirect(`/login?redirect=${encodeURIComponent(canonical)}`);
    return (
      <Suspense fallback={null}>
        <AppUploadForm mode="update" targetApp={app} />
      </Suspense>
    );
  }

  const iconUrl = await getIconUrl(app.icon_key);
  const categories = await getCategoriesServer();
  const { user, profile } = await getCurrentProfile();
  // צוות (מנהל/פיקוח) - וגם הבעלים עצמו - יכולים לערוך את פוסט הפרסום ישירות מכאן.
  const canEditPost = !!profile && (isStaff(profile) || app.developer_id === user?.id);

  // מנוי התראות לגרסה חדשה - רק לאפליקציה פרטית מאושרת, ורק אם המשתמש לא הבעלים.
  const canNotify = !!user && app.status === "approved" && app.source !== "public_suggestion" && app.developer_id !== user.id;
  let notifySubscribed = false;
  if (canNotify) {
    const { count } = await createAdminSupabase()
      .from("notification_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("type", "app")
      .eq("target_id", app.id);
    notifySubscribed = (count ?? 0) > 0;
  }
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

  const screenshotUrls: string[] = [];
  for (const k of app.screenshot_keys ?? []) {
    try {
      screenshotUrls.push(publicAssetUrl(k));
    } catch {
      // מפתח לא תקין - מדלגים
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative mx-auto flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-surface2 ring-1 ring-border sm:mx-0">
            {iconUrl ? (
              <Image src={iconUrl} alt={app.name} fill sizes="112px" priority className="object-cover" />
            ) : (
              <Package className="h-12 w-12 text-primary-light" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-right">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-black text-white sm:text-3xl">{app.name}</h1>
              <StatusBadge status={app.status} />
              <AppSourceTag source={app.source} />
              <UpdatedBadge lastUpdatedAt={app.last_updated_at} />
            </div>
            <p className="mb-4 text-gray-400">{app.short_description}</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 sm:justify-start">
              <Link href={`/users/${app.developer_id}`} className="inline-flex items-center gap-1 transition hover:text-primary-light hover:underline"><User className="h-3.5 w-3.5" /> הועלה ע"י {app.developer?.username ?? "מפתח"}</Link>
              <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {formatFileSize(app.file_size_bytes)}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> גרסה {app.version}</span>
              <span>{category}</span>
              {app.min_android_version && (
                <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> {app.min_android_version}</span>
              )}
              {app.offline_support && OFFLINE_SUPPORT_LABEL[app.offline_support] && (
                <span className="inline-flex items-center gap-1">
                  {(() => {
                    const Icon = OFFLINE_SUPPORT_LABEL[app.offline_support].icon;
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  {OFFLINE_SUPPORT_LABEL[app.offline_support].label}
                </span>
              )}
            </div>
            {app.developer_name && (
              <p className="mt-1.5 text-xs text-gray-500">מפתח/חברת הפיתוח המקורית: <span className="text-gray-300">{app.developer_name}</span></p>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <DownloadButton
                appId={app.id}
                slug={app.slug}
                status={app.status}
                downloadsCount={app.downloads_count}
                isPaused={isPaused}
                extra={
                  <>
                    <ReportsMenu appId={app.id} />
                    <AppLikeButton appId={app.id} />
                  </>
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {app.status === "approved" && app.source === "public_suggestion" && <UpdateAppButton appId={app.id} />}
              {canNotify && (
                <NotifyButton
                  type="app"
                  targetId={app.id}
                  label="קבל התראה על גרסה חדשה"
                  subscribed={notifySubscribed}
                  size="sm"
                />
              )}
              {canEditPost && (
                <Link
                  href={`/dashboard/developer/apps/${app.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold transition hover:bg-gold/20"
                >
                  <Pencil className="h-3.5 w-3.5" /> עריכת פוסט הפרסום
                </Link>
              )}
            </div>
          </div>
        </div>

        {app.description_html && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-lg font-bold text-white">תיאור מלא</h2>
            <div className="rich-content text-gray-300" dangerouslySetInnerHTML={{ __html: app.description_html }} />
          </div>
        )}

        {screenshotUrls.length > 0 && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-lg font-bold text-white">צילומי מסך</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {screenshotUrls.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`צילום מסך ${i + 1} של ${app.name}`}
                    loading="lazy"
                    className="h-72 w-auto rounded-xl border border-border bg-surface2 object-contain"
                  />
                </a>
              ))}
            </div>
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

        <AppReviews appId={app.id} viewerIsStaff={!!profile && isStaff(profile)} />
      </div>
    </div>
  );
}
