import { createServerSupabase } from "./supabase/server";
import { getCachedUser } from "./auth-cache";
import type { Profile } from "@/types/database";

export async function getCurrentProfile(): Promise<{ user: any; profile: Profile | null }> {
  const supabase = createServerSupabase();
  const user = await getCachedUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile: (profile as Profile) ?? null };
}
