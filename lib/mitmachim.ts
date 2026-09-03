// עזרי חיבור לפורום "מתמחים טופ" (mitmachim.top).

export interface MitmachimInfo {
  valid: boolean;
  url: string | null;
  handle: string | null; // שם המשתמש בפורום, אם ניתן לחלץ מהקישור
}

// מאמת קישור למתמחים טופ ומחלץ את שם המשתמש (אם הקישור הוא /user/<שם>).
export function parseMitmachimUrl(raw: string | null | undefined): MitmachimInfo {
  if (!raw || typeof raw !== "string") return { valid: false, url: null, handle: null };
  let input = raw.trim();
  if (!input) return { valid: false, url: null, handle: null };
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { valid: false, url: null, handle: null };
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "mitmachim.top") return { valid: false, url: null, handle: null };

  // NodeBB: פרופיל משתמש נמצא ב-/user/<slug>
  const m = u.pathname.match(/\/user\/([^/?#]+)/i);
  const handle = m ? decodeURIComponent(m[1]) : null;

  return { valid: true, url: `https://mitmachim.top${u.pathname}${u.search}`, handle };
}
