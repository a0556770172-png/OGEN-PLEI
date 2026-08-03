function el(id) { return document.getElementById(id); }

const params = new URLSearchParams(location.search);
let increases = [];
try {
  increases = JSON.parse(params.get("data") || "[]");
} catch {
  increases = [];
}

const list = el("list");
for (const item of increases) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<span>${item.label}</span><b>${item.now} (חדש: +${item.delta})</b>`;
  list.appendChild(row);
}
if (increases.length === 0) {
  list.innerHTML = `<div class="row"><span>יש עדכון חדש שממתין לטיפול</span></div>`;
}

el("openBtn").addEventListener("click", async () => {
  const { siteUrl } = await new Promise((resolve) => chrome.storage.local.get(["siteUrl"], resolve));
  chrome.tabs.create({ url: (siteUrl || DEFAULT_SITE_URL || "").replace(/\/$/, "") + "/dashboard/admin" });
  window.close();
});

el("closeBtn").addEventListener("click", () => window.close());
