// תאריך+שעה קצר להודעות: היום -> "14:32"; השבוע -> "יום ג' 14:32"; אחרת -> "12.9 14:32".
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return time;
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) {
    const day = d.toLocaleDateString("he-IL", { weekday: "short" });
    return `${day} ${time}`;
  }
  return `${d.getDate()}.${d.getMonth() + 1} ${time}`;
}

// טקסט מלא ל-title (ריחוף): "יום שלישי, 12 בספטמבר 2026, 14:32".
export function fullMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
