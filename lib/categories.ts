import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Category } from "@/types/database";
import { memo } from "@/lib/memo";

// שליפת רשימת הקטגוריות מה-DB (לא רשימה קבועה בקוד יותר) - משמש קומפוננטות שרת.
export async function getCategoriesServer(): Promise<Category[]> {
  return memo("categories", 30_000, async () => {
    const admin = createAdminSupabase();
    const { data } = await admin.from("categories").select("*").order("sort_order", { ascending: true });
    return (data as Category[]) ?? [];
  });
}
