import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import EditAppForm from "@/components/EditAppForm";
import { getCategoriesServer } from "@/lib/categories";
import type { AppRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EditAppPage({ params }: { params: { id: string } }) {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");

  const staff = isStaff(profile);
  // מפתח עורך את שלו, או צוות (מנהל/פיקוח) עורך של כל אחד - ראו app/api/apps/[id]/route.ts
  // ואת נתיבי הגרסאות, שכבר מאשרים צוות בצד השרת.
  if (!staff && profile.role !== "developer" && profile.role !== "admin") redirect("/");

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username, is_pro)")
    .eq("id", params.id)
    .single();
  const app = data as (AppRow & { developer?: { username: string; is_pro: boolean } }) | null;

  if (!app) notFound();

  const isOwner = app.developer_id === user.id;
  if (!isOwner && !staff) redirect("/profile");

  // אפליקציה שמקורה בהצעה ציבורית שאושרה: מי שהציע אותה לא יכול לערוך, אבל צוות כן.
  if (app.source === "public_suggestion" && !staff) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">לא ניתן לערוך אפליקציה זו</h1>
          <p className="text-sm text-gray-400">
            "{app.name}" פורסמה מתוך הצעת אפליקציה ציבורית שאושרה ע"י הצוות, ולא מהעלאה ישירה שלך מהדשבורד הפרטי -
            לכן אין אפשרות לערוך את פרטיה או להעלות לה גרסאות חדשות. רק אפליקציות שאתה מעלה ישירות (דרך "העלאת
            אפליקציה") ניתנות לעריכה.
          </p>
          <Link href="/profile" className="btn-primary mt-2">חזרה לפרופיל</Link>
        </div>
      </div>
    );
  }

  const categories = await getCategoriesServer();
  // מכסת גודל הקובץ לגרסה חדשה נגזרת מהתוכנית של בעל האפליקציה, לא של העורך.
  const ownerIsPro = isOwner ? profile.is_pro : !!app.developer?.is_pro;

  return (
    <div className="mx-auto max-w-2xl">
      {!isOwner && staff && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary-light">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          אתה עורך כצוות את פוסט הפרסום של <b className="mx-1 text-white">{app.developer?.username ?? "מפתח"}</b> — כל שינוי יישמר על שמו.
        </div>
      )}
      <EditAppForm app={app} isPro={ownerIsPro} categories={categories} />
    </div>
  );
}
