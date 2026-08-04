import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { createServerSupabase } from "@/lib/supabase/server";
import EditAppForm from "@/components/EditAppForm";
import { getCategoriesServer } from "@/lib/categories";
import type { AppRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EditAppPage({ params }: { params: { id: string } }) {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");
  if (profile.role !== "developer" && profile.role !== "admin") redirect("/");

  const supabase = createServerSupabase();
  const { data } = await supabase.from("apps").select("*").eq("id", params.id).single();
  const app = data as AppRow | null;

  if (!app || app.developer_id !== user.id) redirect("/profile");

  // אפליקציה שמקורה בהצעה ציבורית שאושרה (לא הועלתה ישירות מהדשבורד הפרטי) לא ניתנת
  // לעריכה בכלל ע"י מי שהציע אותה - רק העלאה פרטית מקבלת עריכת פרטים/היסטוריית גרסאות.
  if (app.source === "public_suggestion" && profile.role !== "admin") {
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

  return (
    <div className="mx-auto max-w-2xl">
      <EditAppForm app={app} isPro={profile.is_pro} categories={categories} />
    </div>
  );
}
