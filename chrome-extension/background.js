importScripts("config.js");

const ALARM_NAME = "ogen-play-poll";
// חשוב: כרום (Manifest V3) לא מאפשר ל-alarm חוזר לפעול יותר מפעם בדקה - זו מגבלה טכנית
// קשיחה של גוגל (לא ניתנת לעקיפה מתוסף רגיל, גם לא בלתי-ארוז). לכן זו התדירות המעשית
// המקסימלית האמיתית, גם שהמשתמש ביקש "כל כמה שניות" - דקה זו הכי קרוב שאפשר בפועל.
const POLL_PERIOD_MINUTES = 1;

const ITEM_LABELS = {
  review: "אפליקציות ממתינות לבדיקה",
  pro: "בקשות PRO ממתינות",
  suggestions: "הצעות אפליקציות ממתינות",
  tickets: "הודעות ממתינות למענה",
  deletionRequests: "בקשות מחיקת משתמשים",
  council: "ועדות שנפתחו אוטומטית",
  reports: "דיווחים על אפליקציות"
};

async function getStored(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
async function setStored(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function refreshAccessToken(siteUrl) {
  const { refreshToken } = await getStored(["refreshToken"]);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const json = await res.json();
    if (!res.ok || !json.access_token) return null;
    await setStored({ accessToken: json.access_token, refreshToken: json.refresh_token });
    return json.access_token;
  } catch {
    return null;
  }
}

async function fetchSummary(siteUrl, accessToken) {
  const res = await fetch(`${siteUrl.replace(/\/$/, "")}/api/staff/notifications-summary`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.status === 200, status: res.status, json };
}

async function poll() {
  const { accessToken, siteUrl, lastCounts, notifDismissedUntil } = await getStored([
    "accessToken",
    "siteUrl",
    "lastCounts",
    "notifDismissedUntil"
  ]);
  const url = siteUrl || DEFAULT_SITE_URL;

  if (!accessToken) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  let { ok, status, json } = await fetchSummary(url, accessToken);

  if (!ok && status === 401) {
    const newToken = await refreshAccessToken(url);
    if (newToken) {
      ({ ok, status, json } = await fetchSummary(url, newToken));
    }
  }

  if (!ok) {
    // טוקן לא תקף/פג ואי אפשר לרענן - מסמנים למשתמש שצריך להתחבר מחדש דרך אייקון התוסף
    if (status === 401 || status === 403) {
      await setStored({ accessToken: null, refreshToken: null, loginError: json?.error || null });
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    }
    return;
  }

  await setStored({ lastSummary: json, lastFetchedAt: Date.now() });

  const total = json.total ?? 0;
  chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#c99b3f" });

  // משווים לכל קטגוריה בנפרד מול הפעם האחרונה - כדי להודיע ספציפית "יש X חדש" ולא רק
  // "המספר הכללי עלה" בלי לדעת על מה בדיוק.
  const prev = lastCounts || {};
  const newItems = json.items || {};
  const increases = [];
  for (const key of Object.keys(ITEM_LABELS)) {
    const before = prev[key] ?? 0;
    const now = newItems[key] ?? 0;
    if (now > before) {
      increases.push({ key, label: ITEM_LABELS[key], delta: now - before, now });
    }
  }

  if (increases.length > 0) {
    const title = increases.length === 1 ? increases[0].label : "יש התראות חדשות בעוגן פליי";
    const message = increases.map((i) => `${i.label}: ${i.now} (חדש: +${i.delta})`).join("\n");
    chrome.notifications.create(`ogen-play-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
      priority: 2
    });
  }

  await setStored({ lastCounts: newItems });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_PERIOD_MINUTES });
  poll();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_PERIOD_MINUTES });
  poll();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) poll();
});

// מאפשר לעמוד ה-popup/login לבקש בדיקה מיידית (למשל מיד אחרי התחברות מוצלחת), בלי לחכות
// לדקה הבאה של ה-alarm.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "poll-now") {
    poll().then(() => sendResponse({ ok: true }));
    return true;
  }
});
