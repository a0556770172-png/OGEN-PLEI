import { createClient } from "@supabase/supabase-js";

// לקוח עם מפתח ה-service role — עוקף RLS לגמרי.
// שימוש אך ורק בתוך Route Handlers בשרת, לעולם לא בצד לקוח!
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
