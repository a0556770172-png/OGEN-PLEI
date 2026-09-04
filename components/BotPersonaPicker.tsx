"use client";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { BOT_PERSONAS } from "@/lib/botPersonas";

// בורר סגנון העוזר. מוצג בכניסה לשיחה חדשה, וגם כפאנל "שנה סגנון" תוך כדי שיחה.
export default function BotPersonaPicker({
  value,
  onPick,
  compact = false,
  onSkip
}: {
  value: string | null;
  onPick: (id: string) => void;
  compact?: boolean;
  onSkip?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div className="text-center">
          <p className="text-base font-black text-white">איזה עוזר בא לך?</p>
          <p className="mt-0.5 text-xs text-gray-400">אפשר לשנות בכל רגע תוך כדי שיחה.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {BOT_PERSONAS.map((p, i) => {
          const active = value === p.id;
          return (
            <motion.button
              key={p.id}
              type="button"
              initial={compact ? false : { opacity: 0, y: 8 }}
              animate={compact ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: compact ? 0 : 0.05 + i * 0.05 }}
              onClick={() => onPick(p.id)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-right transition ${
                active
                  ? "border-primary bg-primary/10 shadow-glow"
                  : "border-border bg-surface2 hover:border-primary/40 hover:bg-surface"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${
                  active ? "bg-primary/20" : "bg-surface"
                }`}
              >
                {p.emoji}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{p.name}</span>
                  <span className="text-[11px] text-gray-500">· {p.tagline}</span>
                  {active && <Check className="ms-auto h-4 w-4 text-primary-light" />}
                </span>
                {!compact && <span className="mt-0.5 block text-xs leading-relaxed text-gray-400">{p.blurb}</span>}
              </span>
            </motion.button>
          );
        })}
      </div>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mx-auto text-xs font-semibold text-gray-500 transition hover:text-white"
        >
          המשך עם הסגנון הרגיל
        </button>
      )}
    </div>
  );
}
