import { createAdminSupabase } from "./supabase/admin";
import { publicAssetUrl } from "./r2";

export interface AdConfig {
  interstitialEnabled: boolean;
  floatingEnabled: boolean;
  imageUrl: string | null;
  linkUrl: string;
  skipAfterSeconds: number;
  staffDailyLimit: number;
  clickCount: number;
}

const DEFAULT_LINK = "https://etgarbacheder.netlify.app/?src=ogenplai&c=%D7%A2%D7%95%D7%92%D7%9F-%D7%A4%D7%9C%D7%99%D7%99";

// select("*") בכוונה: אם המיגרציה עוד לא רצה, מחזירים ברירת מחדל בטוחה במקום להפיל את הדף.
export async function getAdConfig(): Promise<AdConfig> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("site_ad_config").select("*").eq("id", true).maybeSingle();
  return {
    interstitialEnabled: data?.interstitial_enabled ?? true,
    floatingEnabled: data?.floating_enabled ?? true,
    imageUrl: data?.image_key ? publicAssetUrl(data.image_key) : null,
    linkUrl: data?.link_url || DEFAULT_LINK,
    skipAfterSeconds: data?.skip_after_seconds ?? 4,
    staffDailyLimit: data?.staff_daily_limit ?? 2,
    clickCount: data?.click_count ?? 0
  };
}
