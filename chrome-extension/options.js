function el(id) { return document.getElementById(id); }

chrome.storage.local.get(["siteUrl"], ({ siteUrl }) => {
  el("siteUrl").value = normalizeSiteUrl(siteUrl);
});

el("saveBtn").addEventListener("click", () => {
  const value = normalizeSiteUrl(el("siteUrl").value);
  chrome.storage.local.set({ siteUrl: value }, () => {
    el("saved").style.display = "block";
    setTimeout(() => (el("saved").style.display = "none"), 1500);
    chrome.runtime.sendMessage({ type: "poll-now" });
  });
});
