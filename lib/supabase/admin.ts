import { createClient } from "@supabase/supabase-js";
import { serverSupabaseUrl } from "./url";
import { noStoreFetch } from "./noStoreFetch";

// לקוח עם מפתח ה-service role — עוקף RLS לגמרי.
// שימוש אך ורק בתוך Route Handlers בשרת, לעולם לא בצד לקוח!
export function createAdminSupabase() {
  return createClient(
    serverSupabaseUrl(),
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: noStoreFetch } }
  );
}
