import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Category } from "@/types/database";

// שליפת רשימת הקטגוריות מה-DB (לא רשימה קבועה בקוד יותר) - משמש קומפוננטות שרת.
export async function getCategoriesServer(): Promise<Category[]> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("categories").select("*").order("sort_order", { ascending: true });
  return (data as Category[]) ?? [];
}
