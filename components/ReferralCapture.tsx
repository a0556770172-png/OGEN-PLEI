"use client";
import { useEffect } from "react";
import { persistRefCode } from "@/lib/referralClient";

// רכיב שקוף - יושב ב-layout ותופס פרמטר ?ref=<שם המשתמש של המפנה> מכל עמוד שאליו נחת
// המבקר דרך קישור שיתוף, ושומר אותו בעוגייה ל-30 יום. דף ההרשמה קורא משם (lib/referralClient)
// ומצרף ל-signUp, והטריגר handle_new_user (0033_referrals.sql) קושר את referred_by.
export default function ReferralCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) persistRefCode(ref);
    } catch {
      // ignore
    }
  }, []);
  return null;
}
