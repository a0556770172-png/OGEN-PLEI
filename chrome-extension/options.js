function el(id) { return document.getElementById(id); }

chrome.storage.local.get(["siteUrl"], ({ siteUrl }) => {
  el("siteUrl").value = siteUrl || DEFAULT_SITE_URL;
});

el("saveBtn").addEventListener("click", () => {
  const value = el("siteUrl").value.trim() || DEFAULT_SITE_URL;
  chrome.storage.local.set({ siteUrl: value }, () => {
    el("saved").style.display = "block";
    setTimeout(() => (el("saved").style.display = "none"), 1500);
    chrome.runtime.sendMessage({ type: "poll-now" });
  });
});
