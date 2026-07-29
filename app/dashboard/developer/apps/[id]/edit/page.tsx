import { redirect } from "next/navigation";
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

  const categories = await getCategoriesServer();

  return (
    <div className="mx-auto max-w-2xl">
      <EditAppForm app={app} isPro={profile.is_pro} categories={categories} />
    </div>
  );
}
