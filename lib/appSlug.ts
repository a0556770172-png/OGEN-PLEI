import { createAdminSupabase } from "./supabase/admin";
import { cleanPackageName, slugPart } from "./appPath";

async function slugTaken(admin: ReturnType<typeof createAdminSupabase>, slug: string, excludeId?: string): Promise<boolean> {
  let q = admin.from("apps").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (excludeId) q = q.neq("id", excludeId);
  const { count } = await q;
  return (count ?? 0) > 0;
}

// בונה slug ייחודי: שם חבילה אם יש וחופשי; אחרת "שם-מעלה/שם-אפליקציה" (עם מספור אם כבר קיים).
export async function generateSlug(opts: {
  packageName?: string | null;
  username?: string | null;
  name: string;
  excludeId?: string;
}): Promise<string> {
  const admin = createAdminSupabase();
  const pkg = cleanPackageName(opts.packageName);
  if (pkg) {
    const s = pkg.toLowerCase();
    if (!(await slugTaken(admin, s, opts.excludeId))) return s;
  }
  const owner = slugPart(opts.username || "") || "user";
  let namePart = slugPart(opts.name) || "app";
  // "update" שמור לעמוד העדכון (/apps/.../update)
  if (namePart === "update") namePart = "update-app";
  const base = `${owner}/${namePart}`;
  if (!(await slugTaken(admin, base, opts.excludeId))) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!(await slugTaken(admin, candidate, opts.excludeId))) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

// מקצה slug לאפליקציה ושומר אותו. מחזיר את ה-slug (או null אם נכשל - לא מפיל את הקורא).
export async function assignSlug(appId: string): Promise<string | null> {
  try {
    const admin = createAdminSupabase();
    const { data: app } = await admin
      .from("apps")
      .select("id, name, slug, package_name, developer:profiles!apps_developer_id_fkey(username)")
      .eq("id", appId)
      .single();
    if (!app) return null;
    if (app.slug) return app.slug as string;
    const dev = (app as any).developer;
    const username = Array.isArray(dev) ? dev[0]?.username : dev?.username;
    const slug = await generateSlug({ packageName: app.package_name, username, name: app.name, excludeId: app.id });
    const { error } = await admin.from("apps").update({ slug }).eq("id", app.id).is("slug", null);
    if (error) return null;
    return slug;
  } catch {
    return null;
  }
}
