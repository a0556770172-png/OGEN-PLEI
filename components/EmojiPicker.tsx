"use client";
import { useEffect, useRef, useState } from "react";

// בורר אימוג'ים קל, בלי ספרייה חיצונית: קטגוריות, רשת לחיצה, ו"אחרונים" שנשמרים בדפדפן.
const CATEGORIES: { id: string; icon: string; label: string; emojis: string[] }[] = [
  {
    id: "smileys",
    icon: "😀",
    label: "חיוכים",
    emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😋 😛 😜 🤪 😝 🤗 🤭 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🤧 🥵 🥶 😵 🤯 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😲 😳 🥺 😢 😭 😱 😖 😞 😓 😩 😫 🥱 😤 😡 😠".split(" ")
  },
  {
    id: "gestures",
    icon: "👍",
    label: "ידיים",
    emojis: "👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 👏 🙌 👐 🤲 🙏 💪 🫶 🫡 ✍️ 🤌 👀 👂 🧠".split(" ")
  },
  {
    id: "hearts",
    icon: "❤️",
    label: "לבבות",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 ✨ ⭐ 🌟 💫 🔥 🎉 🎊 🎁 🏆 🥇 ✅ ❌ ⚠️ ❓ ❗ 💡".split(" ")
  },
  {
    id: "things",
    icon: "📱",
    label: "חפצים",
    emojis: "📱 💻 🖥️ ⌨️ 🖱️ 💾 📁 📂 📄 📎 🔗 🔒 🔓 🔑 🛠️ ⚙️ 🔧 🔍 📷 🎧 🎵 🎮 📚 📖 ✏️ 📝 📅 ⏰ 📧 📦 🚀 🌐 🔔 💬".split(" ")
  },
  {
    id: "nature",
    icon: "🌸",
    label: "טבע ואוכל",
    emojis: "☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ 🌈 🌸 🌹 🌻 🌲 🍀 🍎 🍌 🍇 🍓 🍕 🍔 🍟 🍰 🍪 ☕ 🍷 🥤 🐶 🐱 🐭 🐻 🦁 🐵 🐢 🦋".split(" ")
  }
];

const RECENT_KEY = "ogen-emoji-recent";
const MAX_RECENT = 16;

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(emoji: string) {
  try {
    const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage חסום - פשוט לא נשמור "אחרונים"
  }
}

export default function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("smileys");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  // סגירה בלחיצה מחוץ לבורר או ב-Escape
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function pick(emoji: string) {
    pushRecent(emoji);
    setRecent(readRecent());
    onPick(emoji);
  }

  const cat = CATEGORIES.find((c) => c.id === active) ?? CATEGORIES[0];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="בחירת אימוג'י"
      className="absolute bottom-full right-0 z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
    >
      <div className="flex border-b border-border/70 bg-surface2/50">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            aria-label={c.label}
            onClick={() => setActive(c.id)}
            className={`flex-1 py-2 text-lg transition ${active === c.id ? "bg-primary/20" : "hover:bg-surface2"}`}
          >
            {c.icon}
          </button>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="border-b border-border/70 px-2 py-1.5">
          <p className="px-1 pb-0.5 text-[10px] font-bold text-gray-500">אחרונים</p>
          <div className="flex flex-wrap gap-0.5">
            {recent.map((e) => (
              <button key={e} type="button" onClick={() => pick(e)} className="h-8 w-8 rounded-lg text-xl transition hover:bg-surface2">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {cat.emojis.map((e) => (
          <button key={e} type="button" onClick={() => pick(e)} className="h-9 rounded-lg text-xl transition hover:bg-surface2 active:scale-90">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
