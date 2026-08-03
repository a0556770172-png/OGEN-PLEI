const ITEM_LABELS = {
  review: "אפליקציות ממתינות לבדיקה",
  pro: "בקשות PRO ממתינות",
  suggestions: "הצעות אפליקציות ממתינות",
  tickets: "הודעות ממתינות למענה",
  deletionRequests: "בקשות מחיקת משתמשים",
  council: "ועדות שנפתחו אוטומטית",
  reports: "דיווחים על אפליקציות"
};

function el(id) { return document.getElementById(id); }

async function getStored(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
async function setStored(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function renderSummary(summary) {
  const rows = el("rows");
  rows.innerHTML = "";
  const items = summary?.items || {};
  for (const key of Object.keys(ITEM_LABELS)) {
    const count = items[key] ?? 0;
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span>${ITEM_LABELS[key]}</span><span class="count ${count === 0 ? "zero" : ""}">${count}</span>`;
    rows.appendChild(row);
  }
}

async function showSummaryView() {
  el("loginView").style.display = "none";
  el("summaryView").style.display = "block";
  const { lastSummary, lastFetchedAt, lastPollError } = await getStored(["lastSummary", "lastFetchedAt", "lastPollError"]);
  if (lastSummary) renderSummary(lastSummary);
  if (lastFetchedAt) {
    const time = new Date(lastFetchedAt).toLocaleTimeString("he-IL");
    el("lastUpdated").textContent = lastPollError
      ? `הרענון האחרון (${time}) נכשל: ${lastPollError}`
      : `עדכון אחרון: ${time}`;
    el("lastUpdated").style.color = lastPollError ? "#f87171" : "";
  }
}

function showLoginView(errorMsg) {
  el("summaryView").style.display = "none";
  el("loginView").style.display = "block";
  el("loginError").textContent = errorMsg || "";
}

async function init() {
  const { accessToken, loginError, siteUrl } = await getStored(["accessToken", "loginError", "siteUrl"]);
  if (accessToken) {
    showSummaryView();
    chrome.runtime.sendMessage({ type: "poll-now" }, () => showSummaryView());
  } else {
    showLoginView(loginError);
  }

  el("loginBtn").addEventListener("click", async () => {
    const email = el("email").value.trim();
    const password = el("password").value;
    el("loginError").textContent = "";
    if (!email || !password) {
      el("loginError").textContent = "יש להזין אימייל וסיסמה";
      return;
    }
    el("loginBtn").disabled = true;
    el("loginBtn").textContent = "מתחבר...";
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (!res.ok || !json.access_token) {
        throw new Error(json.error_description || json.msg || "פרטי התחברות שגויים");
      }
      await setStored({ accessToken: json.access_token, refreshToken: json.refresh_token, loginError: null });

      // מוודאים מיד שהמשתמש הזה בכלל צוות פיקוח/ניהול - אם לא, ה-endpoint יחזיר 403 והתוסף
      // ינקה את הטוקן וידרוש התחברות מחדש עם החשבון הנכון.
      const url = (siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "");
      const checkRes = await fetch(`${url}/api/staff/notifications-summary`, {
        headers: { Authorization: `Bearer ${json.access_token}` }
      });
      if (!checkRes.ok) {
        const checkJson = await checkRes.json().catch(() => ({}));
        await setStored({ accessToken: null, refreshToken: null });
        // מצב דיבאג זמני: מציגים גם את השדות debug* אם קיימים בתשובה, כדי לאבחן במקום לנחש
        const debugParts = Object.keys(checkJson)
          .filter((k) => k.startsWith("debug"))
          .map((k) => `${k}=${checkJson[k]}`)
          .join(", ");
        throw new Error((checkJson.error || "החשבון הזה אינו צוות פיקוח/ניהול") + (debugParts ? ` [${debugParts}]` : ""));
      }

      showSummaryView();
      chrome.runtime.sendMessage({ type: "poll-now" }, () => showSummaryView());
    } catch (err) {
      el("loginError").textContent = err.message || "שגיאה בהתחברות";
    } finally {
      el("loginBtn").disabled = false;
      el("loginBtn").textContent = "התחברות";
    }
  });

  el("refreshBtn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "poll-now" }, () => showSummaryView());
  });

  el("logoutBtn")?.addEventListener("click", async () => {
    await setStored({ accessToken: null, refreshToken: null, lastSummary: null, lastCounts: null });
    chrome.action.setBadgeText({ text: "" });
    showLoginView();
  });
}

init();
