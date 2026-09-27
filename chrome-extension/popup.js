// ITEM_LABELS, DEFAULT_SITE_URL ו-normalizeSiteUrl מגיעים מ-config.js (נטען לפני הקובץ הזה).

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
  // הקטגוריות מגיעות מהאתר - ראו ההסבר ב-background.js
  const labels = summary?.labels || ITEM_LABELS;
  for (const key of Object.keys(labels)) {
    const count = items[key] ?? 0;
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("span");
    label.textContent = labels[key];
    const badge = document.createElement("span");
    badge.className = `count ${count === 0 ? "zero" : ""}`;
    badge.textContent = String(count);
    row.append(label, badge);
    rows.appendChild(row);
  }
  if (summary?.profile?.username) {
    el("who").textContent = `מחובר/ת כ: ${summary.profile.username}`;
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

async function siteBase() {
  const { siteUrl } = await getStored(["siteUrl"]);
  return normalizeSiteUrl(siteUrl);
}

async function init() {
  const { accessToken, loginError } = await getStored(["accessToken", "loginError"]);
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
      // ההתחברות עוברת דרך האתר עצמו (ראו app/api/staff/token), שגם מוודא שהחשבון הוא צוות
      // פיקוח/ניהול - לחשבון רגיל לא מוחזר טוקן בכלל.
      const res = await fetch(`${await siteBase()}/api/staff/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant: "password", email, password }),
        cache: "no-store"
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.accessToken) {
        throw new Error(json.error || `שגיאת התחברות (${res.status})`);
      }
      await setStored({ accessToken: json.accessToken, refreshToken: json.refreshToken, role: json.role, loginError: null });
      el("password").value = "";

      showSummaryView();
      chrome.runtime.sendMessage({ type: "poll-now" }, () => showSummaryView());
    } catch (err) {
      el("loginError").textContent =
        err instanceof TypeError ? "אין חיבור לאתר - בדקו את החיבור לאינטרנט" : err.message || "שגיאה בהתחברות";
    } finally {
      el("loginBtn").disabled = false;
      el("loginBtn").textContent = "התחברות";
    }
  });

  el("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") el("loginBtn").click();
  });

  el("refreshBtn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "poll-now" }, () => showSummaryView());
  });

  el("openBtn")?.addEventListener("click", async () => {
    const { role, dashboardPath } = await getStored(["role", "dashboardPath"]);
    chrome.tabs.create({ url: `${await siteBase()}${dashboardPath || (role === "admin" ? "/dashboard/admin" : "/dashboard/moderator")}` });
  });

  el("logoutBtn")?.addEventListener("click", async () => {
    await setStored({ accessToken: null, refreshToken: null, lastSummary: null, lastCounts: null, role: null });
    chrome.action.setBadgeText({ text: "" });
    showLoginView();
  });
}

init();
